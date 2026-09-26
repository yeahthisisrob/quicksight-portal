/**
 * The assistant's side of the API for stories: the model list, a chat that
 * queues a job and answers from a script, and the things it draws (a
 * preview, an asset, a calculated field's lineage).
 */
import { definitionFixtures } from '@/entities/definition';

import type { MockRoute } from '../../../../../.storybook/mocks/api';

const MODEL_CATALOG = {
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

const MARGIN_DETAIL = {
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
  outcome: { type: 'success' },
  helpers: [
    {
      role: 'planner',
      label: 'Claude Sonnet 4.6',
      modelId: 'us.anthropic.claude-sonnet-4-6',
      provider: 'bedrock',
    },
  ],
};

/** A plan on the governed dataset: the listing, the linked dataset it reuses, and a new analysis. */
const PLAN_ON_GOVERNED = {
  id: 'art-plan',
  kind: 'plan',
  title: 'Margin by region on orders_gold',
  sources: [{ listing: 'orders_gold', project: 'sales_prod', table: 'published.orders_gold' }],
  datasets: [{ name: 'Orders (gold)', id: 'ds-orders-gold', status: 'existing' }],
  calculatedFields: [
    {
      name: 'Net Margin',
      expression: '{revenue} - {cost}',
      status: 'new',
      dataset: 'ds-orders-gold',
    },
    {
      name: 'Unit price',
      expression: '{revenue} / {qty}',
      status: 'new',
      dataset: 'ds-orders-gold',
    },
    { name: 'Share of region', expression: 'sum({revenue}) / sum({revenue}, [])', status: 'new' },
  ],
  filters: [
    { column: 'order_date', title: 'Period' },
    { column: 'region', title: 'Region' },
  ],
  asset: { kind: 'analysis', name: 'Margin by region', status: 'new' },
} as const;

/** A plan that needs a dataset: a new one over the listing, through the Athena source the portal picked. */
export const PLAN_NEW_DATASET = {
  id: 'art-plan-new',
  kind: 'plan',
  title: 'Customers on a new dataset',
  sources: [{ listing: 'dim_customer', project: 'sales_prod', table: 'published.dim_customer' }],
  datasets: [{ name: 'dim_customer', status: 'new', dataSource: 'Athena (primary)' }],
  asset: { kind: 'dashboard', name: 'Customer overview', id: 'cust-overview', status: 'edited' },
} as const;

/** Without SMUS: straight from datasets to the asset. */
export const PLAN_WITHOUT_SMUS = {
  id: 'art-plan-plain',
  kind: 'plan',
  title: 'Sales overview, copied',
  datasets: [{ name: 'Sales', id: 'ds-sales', status: 'existing' }],
  asset: { kind: 'dashboard', name: 'Sales overview (copy)', status: 'new' },
} as const;

/** The verdicts for PLAN_ON_GOVERNED under a push-down-to-the-source strategy. */
const FIELD_VERDICTS = {
  id: 'art-fields',
  kind: 'fields',
  title: 'Calculated fields this adds',
  fields: [
    {
      name: 'Net Margin',
      expression: '{revenue} - {cost}',
      dataset: 'ds-orders-gold',
      verdict: 'use-column',
      column: 'net_margin',
      note: 'Row-level, and the dataset already has net_margin (DECIMAL, "Revenue less cost, in USD"): use it rather than recomputing.',
    },
    {
      name: 'Unit price',
      expression: '{revenue} / {qty}',
      dataset: 'ds-orders-gold',
      verdict: 'push-down',
      note: 'Row-level: it works here for now, and per your guidance belongs upstream, materialised in the source (for example gold).',
    },
    {
      name: 'Share of region',
      expression: 'sum({revenue}) / sum({revenue}, [])',
      verdict: 'analysis',
      note: 'Computed per visual (aggregation), so it belongs in the analysis.',
    },
  ],
} as const;

/** An answer that plans first: the lineage, the field verdicts, then the change to confirm. */
export const PLANNED_ANSWER = {
  ...SCRIPTED_ANSWER,
  reply:
    'orders_gold already has a linked dataset, Orders (gold), so the new analysis reads it; nothing new is created upstream. Net Margin exists as the net_margin column, so I used it. Unit price is row-level: it works in the analysis for now, and per your guidance it should be materialised in gold as a follow-up.',
  calls: [
    { method: 'GET', path: 'context_search "orders gold"', status: 200, ok: true },
    { method: 'GET', path: 'context_related listing:l-orders', status: 200, ok: true },
  ],
  artifacts: [PLAN_ON_GOVERNED, FIELD_VERDICTS],
  actions: [
    {
      id: 'act-plan',
      title: 'Create the analysis',
      why: 'Creates "Margin by region" on Orders (gold) with Unit price and Share of region.',
      method: 'POST',
      path: '/api/authoring/new',
      body: {
        assetType: 'analysis',
        name: 'Margin by region',
        datasets: [{ identifier: 'orders', dataSetId: 'ds-orders-gold' }],
      },
      planId: PLAN_ON_GOVERNED.id,
    },
  ],
};

/** A question (AG-UI interrupt): which of two governed datasets, drawn as cards. */
const DATASET_QUESTION = {
  id: 'int-dataset',
  reason: 'input_required',
  message: 'Which dataset should the margin analysis read?',
  toolCallId: 'q1',
  responseSchema: {
    type: 'object',
    properties: {
      selected: {
        type: 'array',
        items: { type: 'string', enum: ['dataset:ds-orders-gold', 'dataset:ds-orders-direct'] },
        minItems: 1,
        maxItems: 1,
      },
    },
    required: ['selected'],
  },
  metadata: {
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'dataset:ds-orders-gold',
        label: 'Orders (gold)',
        description: 'Linked to the orders_gold listing; refreshed nightly.',
        entityId: 'dataset:ds-orders-gold',
        summary:
          'dataset: Orders (gold) (SPICE, 14 columns, used by 4 dashboards, project sales_prod)',
        path: '/assets/datasets?search=Orders%20(gold)',
      },
      {
        id: 'dataset:ds-orders-direct',
        label: 'Orders gold (direct)',
        description: 'Reads Athena live; slower, always current.',
        entityId: 'dataset:ds-orders-direct',
        summary: 'dataset: Orders gold (direct) (DIRECT_QUERY, 14 columns, no dashboards yet)',
        path: '/assets/datasets?search=Orders%20gold%20(direct)',
      },
    ],
  },
} as const;

/** Which filters, several at once, or something typed. */
export const FILTERS_QUESTION = {
  id: 'int-filters',
  reason: 'input_required',
  message: 'Which filters should the control bar carry?',
  metadata: {
    multi: true,
    allowOther: true,
    options: [
      { id: 'order_date', label: 'Order date', description: 'A date-range picker.' },
      { id: 'region', label: 'Region', description: 'A dropdown of the 6 regions.' },
      { id: 'product_line', label: 'Product line', description: 'A dropdown.' },
    ],
  },
} as const;

/** An answer that stops on a question. */
export const QUESTION_ANSWER = {
  ...SCRIPTED_ANSWER,
  reply: 'orders_gold has **two** linked datasets. The analysis can read either:',
  calls: [{ method: 'GET', path: 'context_related listing:l-orders', status: 200, ok: true }],
  artifacts: [],
  actions: [],
  helpers: undefined,
  outcome: { type: 'interrupt', interrupts: [DATASET_QUESTION] },
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
