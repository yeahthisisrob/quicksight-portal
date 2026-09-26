import { ResumeEntrySchema, RunFinishedOutcomeSchema } from '@ag-ui/core/schemas';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { aiModel } from '../../../shared/ai/modelCatalog';
import { describeRunInput, parseRunInput } from '../lib/runInput';
import { AssistantService } from '../services/AssistantService';
import type { ChatModel, ChatSystem, ChatTurnResult } from '../services/ChatModel';

const model = aiModel('haiku-4-5');

function scripted(
  turns: Array<Partial<ChatTurnResult>>
): ChatModel & { systems: ChatSystem[]; seen: number } {
  let i = 0;
  return {
    seen: 0,
    systems: [],
    async turn(system) {
      this.seen += 1;
      this.systems.push(system);
      const next = turns[i++] ?? { text: 'Done.' };
      return {
        text: next.text ?? '',
        toolCalls: next.toolCalls ?? [],
        raw: undefined,
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
  };
}

const ASK = {
  toolCalls: [
    {
      id: 'q1',
      name: 'ask_person',
      input: {
        question: 'Which dataset should the analysis read?',
        options: [
          {
            label: 'Orders (gold)',
            entityId: 'dataset:ds-gold',
            description: 'SPICE, used by 4 dashboards',
          },
          { label: 'Orders (direct)', entityId: 'dataset:ds-direct' },
        ],
      },
    },
  ],
};

describe('AG-UI run protocol', () => {
  it('ends the run on a question, as an interrupt AG-UI itself accepts, with the graph summaries on the options', async () => {
    const chat = scripted([ASK, { text: 'never reached' }]);
    const dispatch = vi.fn(async ({ path }: { method: string; path: string }) => ({
      status: 200,
      body: JSON.stringify({
        data: {
          entity: {
            summary: path.includes('ds-gold')
              ? 'dataset: Orders (gold), SPICE'
              : 'dataset: Orders (direct)',
            path: '/assets/datasets',
          },
        },
      }),
    }));
    const result = await new AssistantService(chat, model, dispatch).respond([
      { role: 'user', text: 'build it' },
    ]);

    expect(chat.seen).toBe(1);
    expect(result.reply).toBe('Which dataset should the analysis read?');
    expect(RunFinishedOutcomeSchema.parse(result.outcome)).toBeTruthy();
    expect(result.outcome.type).toBe('interrupt');
    const interrupt =
      result.outcome.type === 'interrupt' ? result.outcome.interrupts[0]! : undefined;
    expect(interrupt).toMatchObject({ reason: 'input_required', toolCallId: 'q1' });
    expect((interrupt!.metadata as any).options).toEqual([
      {
        id: 'dataset:ds-gold',
        label: 'Orders (gold)',
        description: 'SPICE, used by 4 dashboards',
        entityId: 'dataset:ds-gold',
        summary: 'dataset: Orders (gold), SPICE',
        path: '/assets/datasets',
      },
      expect.objectContaining({ id: 'dataset:ds-direct', summary: 'dataset: Orders (direct)' }),
    ]);
    expect((interrupt!.responseSchema as any).properties.selected).toMatchObject({
      items: { enum: ['dataset:ds-gold', 'dataset:ds-direct'] },
      minItems: 1,
      maxItems: 1,
    });
  });

  it('finishes with a success outcome when nothing is asked, and refuses a second question', async () => {
    const plain = await new AssistantService(
      scripted([{ text: 'margin is revenue minus cost.' }]),
      model,
      vi.fn()
    ).respond([{ role: 'user', text: 'what is margin' }]);
    expect(RunFinishedOutcomeSchema.parse(plain.outcome)).toEqual({ type: 'success' });

    const twice = scripted([{ toolCalls: [...ASK.toolCalls, { ...ASK.toolCalls[0]!, id: 'q2' }] }]);
    const dispatch = vi.fn(async () => ({ status: 404, body: '' }));
    const result = await new AssistantService(twice, model, dispatch).respond([
      { role: 'user', text: 'x' },
    ]);
    expect(result.outcome.type === 'interrupt' && result.outcome.interrupts).toHaveLength(1);
  });

  it('hands the model the working draft, what ran, and the answer, as live context', async () => {
    const input = parseRunInput({
      threadId: 't-1',
      state: {
        drafts: [
          {
            title: 'Create the analysis',
            method: 'POST',
            path: '/api/authoring/new',
            body: { name: 'Margin' },
          },
        ],
        ran: [
          {
            title: 'Share it',
            method: 'POST',
            path: '/api/assets/x/permissions',
            status: 'done',
            result: { ok: true },
          },
        ],
      },
      resume: [
        { interruptId: 'i-1', status: 'resolved', payload: { selected: ['dataset:ds-gold'] } },
      ],
    });
    if (typeof input === 'string') throw new Error(input);
    expect(ResumeEntrySchema.parse(input.resume![0])).toBeTruthy();

    const chat = scripted([{ text: 'Revised the draft.' }]);
    await new AssistantService(chat, model, vi.fn()).respond(
      [{ role: 'user', text: 'add a region filter' }],
      input
    );
    const context = chat.systems[0]!.context ?? '';
    expect(context).toContain('Working draft');
    expect(context).toContain(
      '"Create the analysis" POST /api/authoring/new body: {"name":"Margin"}'
    );
    expect(context).toContain(
      '"Share it" POST /api/assets/x/permissions: done result: {"ok":true}'
    );
    expect(context).toContain('answered your question i-1: {"selected":["dataset:ds-gold"]}');
  });

  it('validates and bounds the run input', () => {
    expect(parseRunInput({ resume: [{ interruptId: 'i', status: 'maybe' }] })).toContain(
      "status 'resolved' or 'cancelled'"
    );
    expect(parseRunInput({ threadId: '' })).toBe('threadId must be a non-empty string');
    const big = parseRunInput({
      state: {
        drafts: [
          { title: 't', method: 'POST', path: '/p', body: { definition: 'x'.repeat(20_000) } },
        ],
        ran: [{ title: 'bad' }],
      },
    });
    if (typeof big === 'string') throw new Error(big);
    expect(String(big.state!.drafts[0]!.body)).toMatch(/^\[\d+ characters, not carried/);
    expect(big.state!.ran).toEqual([]);
    expect(describeRunInput({})).toBe('');
  });

  it('sends back a write that leaves out a filter the person asked for or the plan promised', async () => {
    const { missingFilters, describeBuilt } = await import('../services/AssistantService');
    const create = { assetType: 'analysis', name: 'x', datasets: [] };
    expect(
      missingFilters('/api/authoring/new', create, 'one table and a region filter', [])
    ).toContain('asked for a filter');
    expect(
      missingFilters(
        '/api/authoring/new',
        { ...create, filters: [{ identifier: 'o', column: 'region' }] },
        'a region filter',
        []
      )
    ).toBeUndefined();
    expect(missingFilters('/api/authoring/new', create, 'one simple table', [])).toBeUndefined();
    const plan = {
      id: 'p',
      kind: 'plan',
      title: 't',
      sources: [],
      datasets: [],
      asset: { kind: 'analysis', name: 'x', status: 'new' },
      filters: [{ column: 'Region' }, { column: 'order_date' }],
    };
    expect(
      missingFilters(
        '/api/authoring/{assetType}/{assetId}/rebind',
        { mode: 'update', rebinds: [], ops: [{ op: 'addFilter', column: 'region' }] },
        'go',
        [plan as never]
      )
    ).toContain('promised filters on order_date');
    expect(missingFilters('/api/folders/{folderId}/members', {}, 'filter', [])).toBeUndefined();

    expect(
      describeBuilt({
        outline: [
          {
            elements: [
              { kind: 'visual', elementId: 'v1' },
              { kind: 'filterControl', elementId: 'c1', title: 'Region', placement: 'controlBar' },
            ],
          },
        ],
      })
    ).toBe('1 visual; controls: Region');
  });

  it('in a real run, sends a create without the asked-for filter back to the model', async () => {
    const told: string[] = [];
    const create = {
      toolCalls: [
        {
          id: 'c1',
          name: 'propose_action',
          input: {
            title: 'Create',
            why: 'x',
            method: 'POST',
            path: '/api/authoring/new',
            body: {
              assetType: 'analysis',
              name: 'x',
              datasets: [{ identifier: 'o', dataSetId: 'd' }],
              folderId: 'f',
            },
          },
        },
      ],
    };
    const chat = scripted([create, { text: 'Adding the filter.' }]);
    const turn = chat.turn.bind(chat);
    chat.turn = async (system, turns, tools) => {
      const last = turns[turns.length - 1];
      if (last?.role === 'tool') told.push(last.results[0]?.content ?? '');
      return turn(system, turns, tools);
    };
    const result = await new AssistantService(chat, model, vi.fn()).respond([
      { role: 'user', text: 'one simple table and a region filter' },
    ]);
    expect(result.actions).toEqual([]);
    expect(told[0]).toContain('asked for a filter');
  });
});
