import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import spec from '../../../../../shared/generated/openapi.json';
import { aiModel, aiModelViews, costOf, typicalCost } from '../../../shared/ai/modelCatalog';
import { getAuthContext, withInProcessAuth } from '../../../shared/auth';
import { apiIndex, classifyCall, describeOperation } from '../lib/portalCalls';
import {
  AssistantService,
  announcesMore,
  CONTINUE_NUDGE,
  describeStep,
} from '../services/AssistantService';
import type { ChatModel, ChatTurnResult } from '../services/ChatModel';

describe('classifyCall', () => {
  it('runs reads and previews, prepares writes, and never touches settings', () => {
    expect(classifyCall('GET', '/api/search?q=gold')).toBe('read');
    expect(classifyCall('POST', '/api/authoring/dashboard/d1/rebind/preview')).toBe('read');
    expect(classifyCall('POST', '/api/authoring/dashboard/d1/repair/plan')).toBe('read');
    expect(classifyCall('POST', '/api/tags/batch')).toBe('read');
    expect(classifyCall('POST', '/api/authoring/dashboard/d1/propose')).toBe('read');
    expect(classifyCall('POST', '/api/authoring/new/propose')).toBe('read');
    expect(classifyCall('POST', '/api/authoring/dashboard/d1/rebind')).toBe('action');
    expect(classifyCall('DELETE', '/api/groups/g')).toBe('action');
    expect(classifyCall('GET', '/api/settings/api-keys')).toBe('blocked');
    expect(classifyCall('POST', '/api/assistant/chat')).toBe('blocked');
    expect(classifyCall('GET', '/search')).toBe('blocked');
  });

  it('indexes every callable operation and describes one with its body', () => {
    const index = apiIndex(spec as never);
    expect(index).toContain('GET /api/search - ');
    expect(index).not.toContain('/api/settings');
    const described = describeOperation(
      spec as never,
      'POST',
      '/api/authoring/{assetType}/{assetId}/rebind'
    );
    expect(described).toContain('rebinds');
    expect(describeOperation(spec as never, 'GET', '/api/nope')).toContain('No operation');
  });
});

describe('model catalog', () => {
  it('offers five, prices a call, and hides OpenAI without a key', () => {
    const views = aiModelViews({});
    expect(views.map((m) => m.key)).toEqual([
      'haiku-4-5',
      'sonnet-4-6',
      'sonnet-5',
      'opus-5',
      'openai',
    ]);
    expect(views.find((m) => m.key === 'openai')).toMatchObject({ available: false });
    expect(
      aiModelViews({ PLANNER_BASE_URL: 'https://api.openai.com/v1', PLANNER_API_KEY: 'k' }).find(
        (m) => m.key === 'openai'
      )?.available
    ).toBe(true);
    expect(costOf(aiModel('sonnet-4-6'), { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(
      18
    );
    expect(typicalCost(aiModel('haiku-4-5'), 'chat')).toBeLessThan(
      typicalCost(aiModel('opus-5'), 'chat')
    );
  });
});

describe('in-process identity', () => {
  it('survives the spread handlers do, and cannot come from a parsed body', async () => {
    const event = withInProcessAuth({ headers: {}, path: '/api/search' } as any, {
      userId: 'u1',
      accountId: '1',
    });
    expect(await getAuthContext({ ...event, pathParameters: {} })).toMatchObject({ userId: 'u1' });
    const forged = JSON.parse(JSON.stringify(event));
    expect(Object.getOwnPropertySymbols(forged)).toEqual([]);
  });
});

/** A model that plays back scripted turns. */
function scripted(turns: Array<Partial<ChatTurnResult>>): ChatModel & { seen: number } {
  let i = 0;
  return {
    seen: 0,
    async turn() {
      this.seen += 1;
      const next = turns[i++] ?? { text: 'Done.' };
      return {
        text: next.text ?? '',
        toolCalls: next.toolCalls ?? [],
        raw: undefined,
        usage: next.usage ?? { inputTokens: 1_000, outputTokens: 100 },
      };
    },
  };
}

describe('AssistantService', () => {
  const model = aiModel('haiku-4-5');

  it('reads, previews, shows lineage, and prepares the write against its preview', async () => {
    const dispatch = vi.fn(async ({ path }: { path: string }) => ({
      status: 200,
      body: JSON.stringify({
        success: true,
        // The planner proposes a copy onto gold with no edits.
        data: path.endsWith('/propose')
          ? { intent: 'rebind', mode: 'clone', rebinds: [], ops: [], problems: [], unmapped: [] }
          : { path },
      }),
    }));
    const chat = scripted([
      {
        toolCalls: [
          {
            id: 't1',
            name: 'call_portal_api',
            input: { method: 'GET', path: '/api/search?q=margin' },
          },
          {
            id: 't2',
            name: 'call_portal_api',
            input: { method: 'GET', path: '/api/data-catalog/calculated-fields/margin%3A%3Aabc' },
          },
        ],
      },
      {
        toolCalls: [
          {
            id: 't3',
            name: 'call_portal_api',
            input: {
              method: 'POST',
              path: '/api/authoring/dashboard/d1/rebind/preview',
              body: { rebinds: [] },
            },
          },
          {
            id: 't4',
            name: 'show_plan',
            input: {
              title: 'The copy on gold',
              datasets: [{ name: 'Orders (gold)', id: 'ds-gold', status: 'existing' }],
              asset: { kind: 'dashboard', name: 'Margin', id: 'd1', status: 'new' },
              brief: 'A copy of the margin dashboard reading orders gold, nothing else changed.',
              target: { edit: { assetType: 'dashboard', assetId: 'd1' } },
            },
          },
          { id: 't4b', name: 'prepare_plan', input: { why: 'Clones onto gold.' } },
          {
            id: 't5',
            name: 'show_to_person',
            input: { kind: 'asset', title: 'Today', assetType: 'dashboard', assetId: 'd1' },
          },
        ],
      },
      { text: 'Here is the copy; run it when it looks right.' },
    ]);
    const result = await new AssistantService(chat, model, dispatch).respond([
      { role: 'user', text: 'copy the margin dashboard onto gold' },
    ]);

    expect(result.reply).toBe('Here is the copy; run it when it looks right.');
    expect(result.calls.map((c) => c.path)).toEqual([
      '/api/search?q=margin',
      '/api/data-catalog/calculated-fields/margin%3A%3Aabc',
      '/api/authoring/dashboard/d1/rebind/preview',
      '/api/authoring/dashboard/d1/propose',
    ]);
    const kinds = result.artifacts.map((a) => a.kind);
    expect(kinds).toEqual(['lineage', 'preview', 'plan', 'asset']);
    expect(result.artifacts[0]).toMatchObject({ fieldKey: 'margin::abc' });
    const preview = result.artifacts[1]!;
    // The plan's build was already previewed with the same body: not previewed twice.
    expect(result.actions).toEqual([
      expect.objectContaining({
        title: 'Copy the dashboard',
        why: 'Clones onto gold.',
        path: '/api/authoring/dashboard/d1/rebind',
        body: { mode: 'clone', rebinds: [] },
        previewId: preview.id,
        planId: result.artifacts[2]!.id,
      }),
    ]);
    expect(dispatch).toHaveBeenCalledTimes(4);
    expect(result.rounds).toBe(3);
    expect(result.cost).toBeCloseTo(costOf(model, { inputTokens: 3_000, outputTokens: 300 }));
  });

  it('refuses a write through call_portal_api and a blocked path, without dispatching', async () => {
    const dispatch = vi.fn();
    const chat = scripted([
      {
        toolCalls: [
          {
            id: 'a',
            name: 'call_portal_api',
            input: { method: 'POST', path: '/api/authoring/dashboard/d1/rebind' },
          },
          {
            id: 'b',
            name: 'call_portal_api',
            input: { method: 'GET', path: '/api/settings/api-keys' },
          },
        ],
      },
      { text: 'I prepared nothing.' },
    ]);
    const result = await new AssistantService(chat, model, dispatch as any).respond([
      { role: 'user', text: 'do it' },
    ]);
    expect(dispatch).not.toHaveBeenCalled();
    expect(result.calls).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  it('stops after its step budget and says so', async () => {
    const loop = {
      toolCalls: [
        { id: 'x', name: 'describe_operation', input: { method: 'GET', path: '/api/search' } },
      ],
    };
    const chat = scripted(Array.from({ length: 20 }, () => loop));
    const result = await new AssistantService(chat, model, vi.fn() as any).respond([
      { role: 'user', text: 'loop' },
    ]);
    expect(result.rounds).toBe(12);
    expect(result.reply).toContain('ran out of steps');
  });

  it('runs the planner itself, with the authoring model, waits for its job, and says what it is doing', async () => {
    const statuses = ['queued', 'processing', 'completed'];
    const dispatch = vi.fn(
      async ({ method, path }: { method: string; path: string; body?: unknown }) => {
        if (method === 'POST') {
          return {
            status: 202,
            body: JSON.stringify({ success: true, data: { jobId: 'planner-1' } }),
          };
        }
        if (path.endsWith('/result')) {
          return {
            status: 200,
            body: JSON.stringify({ success: true, data: { reason: 'gold fits' } }),
          };
        }
        return {
          status: 200,
          body: JSON.stringify({
            success: true,
            data: { status: statuses.shift() ?? 'completed' },
          }),
        };
      }
    );
    const chat = scripted([
      {
        toolCalls: [
          {
            id: 'p',
            name: 'call_portal_api',
            input: {
              method: 'POST',
              path: '/api/authoring/dashboard/d1/propose',
              body: { ask: 'onto gold' },
            },
          },
        ],
      },
      { text: 'The planner says gold fits.' },
    ]);
    const steps: string[] = [];
    const result = await new AssistantService(chat, model, dispatch, {
      authoringModel: 'opus-5',
      onProgress: (s) => {
        steps.push(s);
      },
      sleep: async () => {},
    }).respond([{ role: 'user', text: 'run the propose' }]);

    expect(dispatch.mock.calls[0]![0]).toMatchObject({
      method: 'POST',
      body: { ask: 'onto gold', model: 'opus-5' },
    });
    expect(dispatch.mock.calls.at(-1)![0]).toMatchObject({ path: '/api/jobs/planner-1/result' });
    expect(result.calls[0]).toMatchObject({ status: 200, ok: true });
    expect(steps).toEqual([
      'Thinking',
      'Asking the planner',
      'Asking the planner: waiting for it to answer',
      'Thinking about what it found',
    ]);
    expect(result.reply).toBe('The planner says gold fits.');
  });

  it("hands the model a failed job's reason, and gives up waiting at the deadline", async () => {
    let clock = 0;
    const failing = vi.fn(async ({ method }: { method: string }) =>
      method === 'POST'
        ? { status: 202, body: JSON.stringify({ data: { jobId: 'j' } }) }
        : {
            status: 200,
            body: JSON.stringify({ data: { status: 'failed', message: 'AccessDenied' } }),
          }
    );
    const propose = {
      toolCalls: [
        {
          id: 'p',
          name: 'call_portal_api',
          input: { method: 'POST', path: '/api/authoring/new/propose', body: {} },
        },
      ],
    };
    const failed = await new AssistantService(
      scripted([propose, { text: 'It failed.' }]),
      model,
      failing,
      {
        sleep: async () => {},
      }
    ).respond([{ role: 'user', text: 'go' }]);
    expect(failed.calls[0]).toMatchObject({ status: 500, ok: false });

    const slow = vi.fn(async ({ method }: { method: string }) =>
      method === 'POST'
        ? { status: 202, body: JSON.stringify({ data: { jobId: 'j' } }) }
        : { status: 200, body: JSON.stringify({ data: { status: 'processing' } }) }
    );
    const waited = await new AssistantService(
      scripted([propose, { text: 'Still going.' }]),
      model,
      slow,
      {
        sleep: async (ms) => {
          clock += ms;
        },
        now: () => clock,
      }
    ).respond([{ role: 'user', text: 'go' }]);
    expect(waited.calls[0]).toMatchObject({ status: 202 });
    expect(clock).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it('names each step in words', () => {
    expect(describeStep('GET', '/api/search?q=x')).toBe('Searching');
    expect(describeStep('POST', '/api/authoring/dashboard/d/rebind/preview')).toBe(
      'Previewing the change'
    );
    expect(describeStep('GET', '/api/data-catalog/calculated-fields/k')).toBe(
      'Tracing calculated fields'
    );
  });

  it('does not stop on a promise: pushes once to keep going, then accepts the answer', async () => {
    const seen: string[][] = [];
    const chat: ChatModel = {
      async turn(_system, turns) {
        seen.push(
          turns.map((t) => (t.role === 'tool' ? 'tool' : `${t.role}:${'text' in t ? t.text : ''}`))
        );
        const texts = [
          'The planner could not map the columns. Let me check the exact column names and try a simpler approach.',
          'Order Date is spelled with a space; here is the mapping.',
        ];
        return {
          text: texts[seen.length - 1] ?? 'Done.',
          toolCalls: [],
          raw: undefined,
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    const result = await new AssistantService(chat, model, vi.fn() as any).respond([
      { role: 'user', text: 'run the propose' },
    ]);
    expect(seen).toHaveLength(2);
    expect(seen[1]!.at(-1)).toBe(`user:${CONTINUE_NUDGE}`);
    expect(result.reply).toBe('Order Date is spelled with a space; here is the mapping.');
    expect(result.rounds).toBe(2);
  });

  it('pushes twice at most, on a promise or on asking leave, and never for an answer that ends as an answer', async () => {
    const promises = scripted([
      { text: "I'll try again." },
      { text: 'Found the folder. Shall I add the analysis to it?' },
      { text: "I'll try again." },
    ]);
    const pushed = await new AssistantService(promises, model, vi.fn() as any).respond([
      { role: 'user', text: 'x' },
    ]);
    expect(pushed.rounds).toBe(3);
    expect(announcesMore('Which folder, Sales or Finance?')).toBe(false);
    expect(announcesMore('Created it. Would you like me to share it with the sales team?')).toBe(
      true
    );
    expect(announcesMore('margin is revenue minus cost. It feeds margin_pct.')).toBe(false);
    expect(announcesMore('Found 3 dashboards. Let me know which one to copy.')).toBe(false);
    expect(
      announcesMore('The planner failed. Let me check the exact column names and try again.')
    ).toBe(true);
    expect(announcesMore("Next, I'll preview the copy.")).toBe(true);
  });

  it('refuses to prepare a new dataset for a listing that already has linked ones, unless asked', async () => {
    const dispatch = vi.fn(async ({ path }: { method: string; path: string }) =>
      path.startsWith(
        `/api/context/entities/${encodeURIComponent('listing:l-orders')}/related?relations=reads-listing&direction=in`
      )
        ? {
            status: 200,
            body: JSON.stringify({
              data: {
                hits: [
                  {
                    entityId: 'dataset:ds-gold',
                    type: 'dataset',
                    name: 'Orders (gold)',
                    summary: 'dataset: Orders (gold)',
                    attributes: { importMode: 'SPICE' },
                    via: [{ relation: 'reads-listing', direction: 'in' }],
                  },
                ],
              },
            }),
          }
        : { status: 404, body: '' }
    );
    const create = (personAskedForNew?: boolean) => ({
      toolCalls: [
        {
          id: 'c',
          name: 'propose_action',
          input: {
            title: 'Create a dataset',
            why: 'Over orders_gold',
            method: 'POST',
            path: '/api/smus/assets/l-orders/dataset',
            body: {},
            ...(personAskedForNew ? { personAskedForNew } : {}),
          },
        },
      ],
    });
    const refused = await new AssistantService(
      scripted([create(), { text: 'Use Orders (gold).' }]),
      model,
      dispatch
    ).respond([{ role: 'user', text: 'use one of the SMUS datasets' }]);
    expect(refused.actions).toEqual([]);
    expect(refused.reply).toBe('Use Orders (gold).');
    const asked = await new AssistantService(
      scripted([create(true), { text: 'Prepared.' }]),
      model,
      dispatch
    ).respond([{ role: 'user', text: 'make me a new dataset' }]);
    expect(asked.actions).toHaveLength(1);
  });

  it('draws the plan, judges each new field, and ties the action to the plan', async () => {
    const dispatch = vi.fn(async ({ path }: { method: string; path: string }) =>
      path === '/api/authoring/dashboard/d1/propose'
        ? {
            status: 200,
            body: JSON.stringify({
              data: {
                intent: 'rebind',
                mode: 'clone',
                name: 'Sales (gold)',
                rebinds: [{ identifier: 'orders', targetDataSetId: 'ds-gold' }],
                ops: [],
                problems: [],
                unmapped: [],
              },
            }),
          }
        : path === '/api/authoring/dashboard/d1/rebind/preview'
          ? { status: 200, body: JSON.stringify({ data: { canApply: true, definition: {} } }) }
          : path === '/api/authoring/datasets/ds-gold/columns'
            ? {
                status: 200,
                body: JSON.stringify({
                  data: { columns: [{ name: 'net_margin' }, { name: 'revenue' }] },
                }),
              }
            : { status: 404, body: '' }
    );
    let told = '';
    const chat: ChatModel = {
      async turn(_s, turns) {
        const last = turns[turns.length - 1];
        if (last?.role === 'tool') {
          told ||= last.results[0]?.content ?? '';
          return {
            text: '',
            toolCalls: [{ id: 'a', name: 'prepare_plan', input: { why: 'Copy on gold' } }],
            raw: undefined,
            usage: { inputTokens: 1, outputTokens: 1 },
          };
        }
        if (
          last?.role === 'assistant' ||
          turns.some((t) => t.role === 'tool' && t.results[0]?.id === 'a')
        ) {
          return {
            text: 'Done.',
            toolCalls: [],
            raw: undefined,
            usage: { inputTokens: 1, outputTokens: 1 },
          };
        }
        return {
          text: '',
          toolCalls: [
            {
              id: 'p',
              name: 'show_plan',
              input: {
                title: 'Sales on gold',
                sources: [{ listing: 'orders_gold', project: 'sales_prod' }],
                datasets: [{ name: 'Orders (gold)', id: 'ds-gold', status: 'existing' }],
                calculatedFields: [
                  {
                    name: 'Net Margin',
                    expression: '{revenue} - {cost}',
                    status: 'new',
                    dataset: 'ds-gold',
                  },
                  {
                    name: 'unit_price',
                    expression: '{revenue} / {qty}',
                    status: 'new',
                    dataset: 'ds-gold',
                  },
                  {
                    name: 'share',
                    expression: 'sum({revenue}) / sum({revenue}, [])',
                    status: 'new',
                  },
                ],
                asset: { kind: 'dashboard', name: 'Sales (gold)', status: 'new' },
                brief: 'Copy the sales dashboard onto the orders gold dataset as Sales (gold).',
                target: { edit: { assetType: 'dashboard', assetId: 'd1' } },
              },
            },
          ],
          raw: undefined,
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
    };
    const guidance = {
      fieldStrategy: 'source' as const,
      architecture: '',
      datasets: '',
      explorations: '',
      visuals: '',
    };
    const result = await new AssistantService(chat, model, dispatch, { guidance }).respond([
      { role: 'user', text: 'build it' },
    ]);
    const plan = result.artifacts.find((a) => a.kind === 'plan');
    const fields = result.artifacts.find((a) => a.kind === 'fields') as any;
    expect(plan).toBeDefined();
    expect(fields.fields.map((f: any) => [f.name, f.verdict, f.column])).toEqual([
      ['Net Margin', 'use-column', 'net_margin'],
      ['unit_price', 'push-down', undefined],
      ['share', 'analysis', undefined],
    ]);
    expect(told).toContain('Drop the use-column fields');
    expect(told).toContain('materialise them in the source');
    expect(result.actions[0]).toMatchObject({ planId: plan!.id });
  });

  it('refuses a plan that names an existing dataset without its id', async () => {
    const { parsePlan } = await import('../services/AssistantService');
    expect(
      parsePlan({
        datasets: [{ name: 'Orders', status: 'existing' }],
        asset: { kind: 'analysis', name: 'x', status: 'new' },
      })
    ).toContain('needs its id');
  });

  it('refuses a plan with no usable target, and gives the planner the reason when its draft fails', async () => {
    const dispatch = vi.fn(async ({ path }: { method: string; path: string; body?: any }) =>
      path === '/api/authoring/new/propose'
        ? {
            status: 200,
            body: JSON.stringify({
              data: {
                visuals: [
                  {
                    type: 'BarChart',
                    title: 'Margin by region',
                    identifier: 'orders',
                    category: 'region',
                    values: [{ column: 'margin' }],
                  },
                ],
                filters: [],
                proposal: {
                  reason: 'Margin by region.',
                  model: { provider: 'bedrock', model: 'm' },
                },
              },
            }),
          }
        : path === '/api/authoring/new/preview'
          ? {
              status: 200,
              body: JSON.stringify({
                data: { canApply: false, issues: [{ message: 'dataset ds-x not found' }] },
              }),
            }
          : { status: 404, body: '' }
    );
    const create = (target: unknown) => ({
      toolCalls: [
        {
          id: 'c',
          name: 'show_plan',
          input: {
            title: 'Margin',
            datasets: [{ name: 'Orders', id: 'ds-x', status: 'existing' }],
            asset: { kind: 'analysis', name: 'Margin', status: 'new' },
            brief: 'Margin by region as a bar chart.',
            target: { create: target },
          },
        },
      ],
    });
    const chat = scripted([
      create({ assetType: 'analysis', name: 'Margin', dataSetIds: ['ds-x'] }),
      create({
        assetType: 'analysis',
        name: 'Margin',
        datasets: [{ identifier: 'orders', dataSetId: 'ds-x' }],
      }),
      { text: 'The dataset does not exist.' },
    ]);
    const told: string[] = [];
    const spy = chat.turn.bind(chat);
    chat.turn = async (system, turns, tools) => {
      const last = turns[turns.length - 1];
      if (last?.role === 'tool') told.push(last.results[0]?.content ?? '');
      return spy(system, turns, tools);
    };
    const result = await new AssistantService(chat, model, dispatch, {
      authoringModel: 'sonnet-4-6',
    }).respond([{ role: 'user', text: 'make it' }]);

    expect(result.actions).toEqual([]);
    expect(result.artifacts.some((a) => a.kind === 'plan')).toBe(false);
    // The malformed target never reached the API.
    expect(told[0]).toContain('needs its target');
    expect(told[1]).toContain('could not draft a build that works');
    expect(told[1]).toContain('dataset ds-x not found');
    // Three drafts, each checked by its preview; the later asks carry the reason.
    const calls = dispatch.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.path)).toEqual([
      '/api/authoring/new/propose',
      '/api/authoring/new/preview',
      '/api/authoring/new/propose',
      '/api/authoring/new/preview',
      '/api/authoring/new/propose',
      '/api/authoring/new/preview',
    ]);
    expect((calls[0] as any).body).toMatchObject({ model: 'sonnet-4-6' });
    expect((calls[2] as any).body.ask).toContain('previous draft could not be built');
  });

  it('names the planner model an answer used', async () => {
    const { plannerModelOf } = await import('../services/AssistantService');
    expect(
      plannerModelOf(
        JSON.stringify({
          data: { model: { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-4-6' } },
        })
      )
    ).toEqual({
      provider: 'bedrock',
      model: 'us.anthropic.claude-sonnet-4-6',
    });
    expect(
      plannerModelOf(
        JSON.stringify({ data: { proposal: { model: { provider: 'openai', model: 'gpt-5' } } } })
      )?.model
    ).toBe('gpt-5');
    expect(plannerModelOf('not json')).toBeUndefined();
  });
});
