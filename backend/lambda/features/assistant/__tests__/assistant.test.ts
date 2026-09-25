import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import spec from '../../../../../shared/generated/openapi.json';
import { aiModel, aiModelViews, costOf, typicalCost } from '../../../shared/ai/modelCatalog';
import { getAuthContext, withInProcessAuth } from '../../../shared/auth';
import { apiIndex, classifyCall, describeOperation } from '../lib/portalCalls';
import { AssistantService, describeStep } from '../services/AssistantService';
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
      body: JSON.stringify({ success: true, data: { path } }),
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
            name: 'propose_action',
            input: {
              title: 'Publish the copy',
              why: 'Clones onto gold.',
              method: 'POST',
              path: '/api/authoring/dashboard/d1/rebind',
              body: { mode: 'clone' },
            },
          },
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
    ]);
    const kinds = result.artifacts.map((a) => a.kind);
    expect(kinds).toEqual(['lineage', 'preview', 'asset']);
    expect(result.artifacts[0]).toMatchObject({ fieldKey: 'margin::abc' });
    const preview = result.artifacts[1]!;
    expect(result.actions).toEqual([
      expect.objectContaining({ title: 'Publish the copy', previewId: preview.id }),
    ]);
    expect(dispatch).toHaveBeenCalledTimes(3);
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
    expect(result.rounds).toBe(8);
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
});
