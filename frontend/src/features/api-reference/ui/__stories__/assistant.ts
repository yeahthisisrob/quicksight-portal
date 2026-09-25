/**
 * The assistant's side of the API for stories: the model list, a chat that
 * queues a job and answers from a script, and the things it draws (a
 * preview, an asset, a calculated field's lineage).
 */
import { definitionFixtures } from '@/entities/definition';

import type { MockRoute } from '../../../../../.storybook/mocks/api';

export const MODEL_CATALOG = {
  models: [
    {
      key: 'haiku-4-5',
      label: 'Claude Haiku 4.5',
      provider: 'bedrock',
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      price: { input: 1, output: 5 },
      bestFor: 'Conversation and quick lookups. The cheapest; the chat default.',
      thinks: false,
      available: true,
      typicalCost: { authoring: 0.018, chat: 0.0375 },
    },
    {
      key: 'sonnet-4-6',
      label: 'Claude Sonnet 4.6',
      provider: 'bedrock',
      modelId: 'us.anthropic.claude-sonnet-4-6',
      price: { input: 3, output: 15 },
      bestFor: 'Authoring: rebinds, column mapping, visuals from an ask. The proven default.',
      thinks: false,
      available: true,
      typicalCost: { authoring: 0.054, chat: 0.1125 },
    },
    {
      key: 'sonnet-5',
      label: 'Claude Sonnet 5',
      provider: 'bedrock',
      modelId: 'us.anthropic.claude-sonnet-5',
      price: { input: 2, output: 10 },
      bestFor: 'Newer and cheaper per token than 4.6, and thinks before it answers.',
      thinks: true,
      available: true,
      typicalCost: { authoring: 0.066, chat: 0.0975 },
    },
    {
      key: 'opus-5',
      label: 'Claude Opus 5',
      provider: 'bedrock',
      modelId: 'us.anthropic.claude-opus-5',
      price: { input: 5, output: 25 },
      bestFor: 'The hardest asks: many datasets, messy column names, big definitions.',
      thinks: true,
      available: true,
      typicalCost: { authoring: 0.165, chat: 0.24375 },
    },
    {
      key: 'openai',
      label: 'OpenAI',
      provider: 'openai',
      modelId: 'gpt-5',
      price: { input: 1.25, output: 10 },
      bestFor: 'For teams on OpenAI. Needs PLANNER_BASE_URL and PLANNER_API_KEY on the stack.',
      thinks: true,
      available: false,
      unavailableReason: 'Set PLANNER_BASE_URL and PLANNER_API_KEY on the stack to enable.',
      typicalCost: { authoring: 0.06, chat: 0.075 },
    },
  ],
  defaults: { authoring: 'sonnet-4-6', chat: 'haiku-4-5' },
  note: 'List prices per million tokens; Bedrock bills Claude at its own rates, so estimates are rough.',
};

const MARGIN_KEY = 'margin::abc123';

export const MARGIN_DETAIL = {
  key: MARGIN_KEY,
  name: 'margin',
  expression: '{revenue} - {cost}',
  lineage: {
    truncated: false,
    nodes: [
      { id: 'col:orders_gold:revenue', name: 'revenue', kind: 'column', depth: -1 },
      { id: 'col:orders_gold:cost', name: 'cost', kind: 'column', depth: -1 },
      {
        id: `cf:${MARGIN_KEY}`,
        name: 'margin',
        kind: 'calculated',
        depth: 0,
        key: MARGIN_KEY,
        expression: '{revenue} - {cost}',
      },
      {
        id: 'cf:margin_pct::def',
        name: 'margin_pct',
        kind: 'calculated',
        depth: 1,
        key: 'margin_pct::def',
        expression: '{margin} / {revenue}',
      },
    ],
    edges: [
      { from: 'col:orders_gold:revenue', to: `cf:${MARGIN_KEY}` },
      { from: 'col:orders_gold:cost', to: `cf:${MARGIN_KEY}` },
      { from: `cf:${MARGIN_KEY}`, to: 'cf:margin_pct::def' },
    ],
  },
  variants: [],
  reads: [],
  readBy: [],
  usedIn: [],
  visuals: [],
};

const PREVIEW_ID = 'art-preview';

/** What the assistant answers, whatever it is asked: a finding, a lineage, and a change to confirm. */
export const SCRIPTED_ANSWER = {
  reply:
    'margin is revenue minus cost on orders_gold, and margin_pct is built on it. I previewed a copy of Sales overview on sales_gold: every column resolves after two renames. Check the wireframe, then run it.',
  calls: [
    { method: 'GET', path: '/api/search?q=margin&limit=5', status: 200, ok: true },
    {
      method: 'GET',
      path: `/api/data-catalog/calculated-fields/${encodeURIComponent(MARGIN_KEY)}`,
      status: 200,
      ok: true,
    },
    {
      method: 'POST',
      path: '/api/authoring/dashboard/sales-overview/rebind/preview',
      status: 200,
      ok: true,
    },
  ],
  artifacts: [
    { id: 'art-lineage', kind: 'lineage', title: 'margin', fieldKey: MARGIN_KEY },
    {
      id: PREVIEW_ID,
      kind: 'preview',
      title: 'Sales overview on sales_gold',
      method: 'POST',
      path: '/api/authoring/dashboard/sales-overview/rebind/preview',
      body: { rebinds: [{ identifier: 'sales', targetDataSetId: 'sales-gold' }] },
    },
  ],
  actions: [
    {
      id: 'act-1',
      title: 'Publish the gold copy',
      why: 'Creates "Sales overview (gold)" with the same audience, reading sales_gold.',
      method: 'POST',
      path: '/api/authoring/dashboard/sales-overview/rebind',
      body: {
        mode: 'clone',
        name: 'Sales overview (gold)',
        rebinds: [{ identifier: 'sales', targetDataSetId: 'sales-gold' }],
      },
      previewId: PREVIEW_ID,
    },
  ],
  model: {
    key: 'haiku-4-5',
    label: 'Claude Haiku 4.5',
    modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  },
  usage: { inputTokens: 24_180, outputTokens: 912 },
  cost: 0.02874,
  rounds: 3,
};

export function assistantRoutes(): MockRoute[] {
  return [
    {
      method: 'get',
      url: '/assistant/models',
      respond: () => ({ body: { success: true, data: MODEL_CATALOG } }),
    },
    {
      method: 'post',
      url: '/assistant/chat',
      respond: () => ({
        body: {
          success: true,
          data: { jobId: 'assistant-1', status: 'queued', message: 'Assistant thinking' },
        },
      }),
    },
    {
      method: 'get',
      url: /\/jobs\/assistant-1\/result$/,
      respond: () => ({ body: { success: true, data: SCRIPTED_ANSWER } }),
    },
    {
      method: 'get',
      url: /\/jobs\/assistant-1$/,
      respond: () => ({
        body: {
          success: true,
          data: {
            jobId: 'assistant-1',
            jobType: 'assistant',
            status: 'completed',
            startTime: '2026-09-25T10:00:00Z',
          },
        },
      }),
    },
    {
      method: 'get',
      url: /\/jobs\/assistant-working$/,
      respond: () => ({
        body: {
          success: true,
          data: {
            jobId: 'assistant-working',
            jobType: 'assistant',
            status: 'processing',
            message: 'Asking the planner: waiting for it to answer',
            startTime: '2026-09-25T10:00:00Z',
          },
        },
      }),
    },
    // An action that queued a job, still going: the card follows it.
    {
      method: 'get',
      url: /\/jobs\/grant-7$/,
      respond: () => ({
        body: {
          success: true,
          data: {
            jobId: 'grant-7',
            jobType: 'bulk-operation',
            status: 'processing',
            progress: 40,
            message: 'Granting 2 of 5 principals',
            startTime: '2026-09-25T10:00:00Z',
          },
        },
      }),
    },
    {
      method: 'post',
      url: /\/rebind\/preview$/,
      respond: () => ({
        body: {
          success: true,
          data: { definition: definitionFixtures.gridDashboardDefinition, warnings: [] },
        },
      }),
    },
    {
      method: 'post',
      url: /\/rebind$/,
      respond: () => ({
        body: { success: true, data: { assetId: 'sales-overview-gold', mode: 'clone' } },
      }),
    },
    {
      method: 'get',
      url: /\/data-catalog\/calculated-fields\/[^/]+$/,
      respond: () => ({ body: { success: true, data: MARGIN_DETAIL } }),
    },
  ];
}
