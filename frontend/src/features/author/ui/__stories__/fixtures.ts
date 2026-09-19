/**
 * Story fixtures for the Author page: a fake flow object for the step
 * stories and the HTTP routes the full-page story runs against.
 */

import {
  buildWireframeModel,
  definitionFixtures,
  diffWireframeModels,
  type RebindDraft,
  type WireframeModel,
} from '@/entities/definition';

import type { DefinitionDataset, RebindPlan } from '@/shared/api/modules/authoring';
import type { SmusAsset } from '@/shared/api/modules/smus';

import type { MockRoute } from '../../../../../.storybook/mocks/api';
import { requestBody } from '../../../../../.storybook/mocks/api';
import { initialAuthorFlowState, stepStatus } from '../../model/authorFlow';
import type { AuthorFlow } from '../../model/useAuthorFlow';

export const SOURCE = { type: 'dashboard' as const, id: 'sales-overview', name: 'Sales overview' };
export const SILVER = 'arn:aws:quicksight:us-east-1:1:dataset/sales-silver';
export const GOLD_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/sales-gold';

const usage = (partial: Partial<Record<string, number>> = {}) => ({
  visual: 0,
  filter: 0,
  calculatedField: 0,
  parameter: 0,
  control: 0,
  other: 0,
  ...partial,
});

/** The synthetic grid dashboard declares `sales` and `targets`. */
export const DATASETS: DefinitionDataset[] = [
  {
    identifier: 'sales',
    dataSetArn: SILVER,
    dataSetId: 'sales-silver',
    columns: [
      { name: 'channel', usage: usage({ visual: 1 }) },
      { name: 'customer_name', usage: usage({ visual: 1 }) },
      { name: 'margin', usage: usage({ visual: 1 }) },
      { name: 'order_date', usage: usage({ visual: 1, control: 1 }) },
      { name: 'order_id', usage: usage({ visual: 1 }) },
      { name: 'order_value', usage: usage({ visual: 1 }) },
      { name: 'region', usage: usage({ visual: 1, filter: 1 }) },
      { name: 'revenue', usage: usage({ visual: 3 }) },
      { name: 'segment', usage: usage({ visual: 1 }) },
    ],
    calculatedFields: ['margin_pct'],
  },
  {
    identifier: 'targets',
    dataSetArn: 'arn:aws:quicksight:us-east-1:1:dataset/targets',
    dataSetId: 'targets',
    columns: [{ name: 'target_revenue', usage: usage({ visual: 1 }) }],
    calculatedFields: [],
  },
];

export const GOLD_COLUMNS = [
  { name: 'channel', type: 'STRING' },
  { name: 'customer_name', type: 'STRING' },
  { name: 'margin', type: 'DECIMAL' },
  { name: 'Order Date', type: 'DATETIME' },
  { name: 'order_id', type: 'STRING' },
  { name: 'order_value', type: 'DECIMAL' },
  { name: 'region', type: 'STRING' },
  { name: 'net_revenue', type: 'DECIMAL' },
  { name: 'segment', type: 'STRING' },
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** A faithful copy of the server's rules, so stories react like the app. */
export function planFor(
  rebinds: Array<{
    identifier: string;
    targetDataSetId: string;
    columnMap?: Record<string, string>;
  }>
): RebindPlan {
  const datasets = rebinds
    .map((rebind) => {
      const source = DATASETS.find((d) => d.identifier === rebind.identifier);
      if (!source) return null;
      const map = rebind.columnMap ?? {};
      const used = new Set<string>();
      const columns = source.columns.map((column) => {
        const mapped = map[column.name];
        if (mapped !== undefined) {
          const hit = GOLD_COLUMNS.find((g) => g.name === mapped);
          if (hit) {
            used.add(hit.name);
            return {
              ...column,
              status: 'mapped' as const,
              resolvedTo: hit.name,
              targetType: hit.type,
            };
          }
          return { ...column, status: 'missing' as const };
        }
        const exact = GOLD_COLUMNS.find((g) => g.name === column.name);
        if (exact) {
          used.add(exact.name);
          return {
            ...column,
            status: 'matched' as const,
            resolvedTo: exact.name,
            targetType: exact.type,
          };
        }
        const near = GOLD_COLUMNS.filter((g) => normalize(g.name) === normalize(column.name));
        if (near.length === 1) {
          return {
            ...column,
            status: 'suggested' as const,
            suggestion: near[0]!.name,
            targetType: near[0]!.type,
          };
        }
        return { ...column, status: 'missing' as const };
      });
      const summary = { matched: 0, mapped: 0, suggested: 0, missing: 0 };
      for (const c of columns) summary[c.status] += 1;
      return {
        identifier: rebind.identifier,
        current: { dataSetId: source.dataSetId, dataSetArn: source.dataSetArn },
        target: {
          dataSetId: rebind.targetDataSetId,
          dataSetArn: GOLD_ARN,
          name: 'sales_gold',
          columnCount: GOLD_COLUMNS.length,
        },
        columns,
        unusedTargetColumns: GOLD_COLUMNS.map((g) => g.name).filter((n) => !used.has(n)),
        summary,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
  return {
    assetType: 'dashboard',
    assetId: SOURCE.id,
    name: SOURCE.name,
    datasets,
    canApply: datasets.every((d) => d.summary.suggested === 0 && d.summary.missing === 0),
  };
}

/** Rewrites column names in a definition the way the server's preview does. */
export function rewrite(
  definition: unknown,
  identifier: string,
  map: Record<string, string>
): unknown {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      if (record.DataSetIdentifier === identifier && typeof record.ColumnName === 'string') {
        return { ...record, ColumnName: map[record.ColumnName] ?? record.ColumnName };
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(record)) out[k] = walk(v);
      return out;
    }
    return node;
  };
  return walk(definition);
}

export const FULL_MAP = { revenue: 'net_revenue', order_date: 'Order Date' };

export const SMUS_ASSETS: SmusAsset[] = [
  {
    listingId: 'lst-sales-gold',
    assetId: 'ast-1',
    name: 'sales_gold',
    assetType: 'amazon.datazone.GlueTableAssetType',
    description: 'Curated sales facts, refreshed nightly.',
    projectId: 'prj-1',
    projectName: 'analytics_prod',
    url: 'https://example.invalid/catalog/assets/lst-sales-gold',
    table: { catalog: 'AwsDataCatalog', database: 'published_sales', name: 'sales_gold' },
    columns: GOLD_COLUMNS.map((c) => ({ name: c.name, type: c.type.toLowerCase() })),
    datasets: [{ id: 'sales-gold', name: 'sales_gold', matchType: 'source-table' }],
  },
  {
    listingId: 'lst-customers',
    assetId: 'ast-2',
    name: 'customer_dim',
    assetType: 'amazon.datazone.GlueTableAssetType',
    projectId: 'prj-1',
    projectName: 'analytics_prod',
    table: { database: 'published_sales', name: 'customer_dim' },
    columns: [
      { name: 'customer_id', type: 'string' },
      { name: 'customer_name', type: 'string' },
      { name: 'segment', type: 'string' },
    ],
    datasets: [],
  },
  {
    listingId: 'lst-targets',
    assetId: 'ast-3',
    name: 'revenue_targets',
    assetType: 'amazon.datazone.GlueTableAssetType',
    projectId: 'prj-2',
    projectName: 'analytics_dev',
    table: { database: 'published_finance', name: 'revenue_targets' },
    columns: [{ name: 'target_revenue', type: 'decimal' }],
    datasets: [{ id: 'targets', name: 'targets', matchType: 'name' }],
  },
];

const SOURCES = [
  {
    id: SOURCE.id,
    name: SOURCE.name,
    tags: [
      { key: 'quicksight-portal:template', value: 'true' },
      { key: 'team', value: 'sales' },
    ],
  },
  {
    id: 'exec-summary',
    name: 'Executive summary',
    tags: [{ key: 'quicksight-portal:template', value: 'true' }],
  },
  { id: 'ops-daily', name: 'Ops daily', tags: [] },
  { id: 'finance-close', name: 'Finance close', tags: [{ key: 'team', value: 'finance' }] },
];

export function exportFor(definition: unknown, tags = SOURCES[0]!.tags) {
  return {
    apiResponses: {
      list: { data: { DashboardId: SOURCE.id, Name: SOURCE.name } },
      definition: { data: { Definition: definition } },
      tags: { data: tags },
    },
  };
}

/** Every route the page can hit, with realistic answers. */
export const TEMPLATES = [
  {
    id: 't-net-margin',
    name: 'net_margin',
    expression: '{revenue} - {cost} - {returns}',
    dataType: 'DECIMAL',
    description: 'Margin after returns, the finance-approved definition.',
    tags: ['finance'],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-10T00:00:00Z',
  },
  {
    id: 't-order-month',
    name: 'order_month',
    expression: 'truncDate("MM", {order_date})',
    dataType: 'DATETIME',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

export function authorRoutes(overrides: MockRoute[] = []): MockRoute[] {
  return [
    ...overrides,
    {
      method: 'get',
      url: '/data-catalog/templates/calculated-fields',
      respond: () => ({ body: { success: true, data: { templates: TEMPLATES } } }),
    },
    {
      method: 'get',
      url: /\/assets\/(dashboards|analyses)\/paginated/,
      respond: (config) => {
        const search = String(config.params?.search ?? '').toLowerCase();
        const templatesOnly = Boolean(config.params?.includeTags);
        const items = SOURCES.filter(
          (s) =>
            (!search || s.name.toLowerCase().includes(search)) &&
            (!templatesOnly || s.tags.some((t) => t.key === 'quicksight-portal:template'))
        );
        const key = String(config.url).includes('analyses') ? 'analyses' : 'dashboards';
        return {
          body: {
            success: true,
            data: {
              [key]: items,
              pagination: { page: 1, pageSize: 25, totalItems: items.length, totalPages: 1 },
            },
          },
        };
      },
    },
    {
      method: 'get',
      url: /\/assets\/datasources\/paginated/,
      respond: () => ({
        body: {
          success: true,
          data: {
            datasources: [
              { id: 'athena-lakehouse', name: 'Athena (lakehouse)', type: 'ATHENA' },
              { id: 'redshift-wh', name: 'Redshift warehouse', type: 'REDSHIFT' },
            ],
            pagination: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
          },
        },
      }),
    },
    {
      method: 'get',
      url: /\/assets\/datasets\/paginated/,
      respond: (config) => {
        const search = String(config.params?.search ?? '').toLowerCase();
        const all = [
          { id: 'sales-gold', name: 'sales_gold' },
          { id: 'sales-bronze', name: 'sales_bronze' },
          { id: 'targets', name: 'targets' },
        ];
        return {
          body: {
            success: true,
            data: {
              datasets: all.filter((d) => d.name.includes(search)),
              pagination: { page: 1, pageSize: 25, totalItems: 3, totalPages: 1 },
            },
          },
        };
      },
    },
    {
      method: 'get',
      url: /\/assets\/(dashboard|analysis)\/[^/]+\/cached$/,
      respond: () => ({
        body: { success: true, data: exportFor(definitionFixtures.gridDashboardDefinition) },
      }),
    },
    {
      method: 'get',
      url: /\/authoring\/.*\/datasets$/,
      respond: () => ({
        body: {
          success: true,
          data: {
            assetType: 'dashboard',
            assetId: SOURCE.id,
            name: SOURCE.name,
            datasets: DATASETS,
          },
        },
      }),
    },
    {
      method: 'post',
      url: '/rebind/plan',
      respond: (config) => ({
        body: { success: true, data: planFor(requestBody(config).rebinds) },
      }),
    },
    {
      method: 'post',
      url: '/rebind/preview',
      respond: (config) => {
        const rebinds = requestBody(config).rebinds as Array<{
          identifier: string;
          columnMap?: Record<string, string>;
        }>;
        let definition: unknown = definitionFixtures.gridDashboardDefinition;
        for (const r of rebinds) definition = rewrite(definition, r.identifier, r.columnMap ?? {});
        return { body: { success: true, data: { plan: planFor(rebinds as any), definition } } };
      },
    },
    {
      method: 'post',
      url: /\/rebind$/,
      respond: (config) => {
        const { mode, name, rebinds } = requestBody(config);
        return {
          body: {
            success: true,
            data: {
              assetType: 'dashboard',
              assetId: mode === 'clone' ? 'sales-overview-gold' : SOURCE.id,
              name,
              arn: 'arn:x',
              mode,
              versionNumber: 2,
              plan: planFor(rebinds),
            },
          },
        };
      },
    },
    {
      method: 'post',
      url: '/propose',
      respond: () => {
        const rebinds = [
          {
            identifier: 'sales',
            targetDataSetId: 'sales-gold',
            columnMap: FULL_MAP,
            reason: 'The ask names the gold sales table',
          },
        ];
        return {
          body: {
            success: true,
            data: {
              ask: 'copy this onto sales gold',
              intent: 'rebind',
              mode: 'clone',
              name: 'Sales overview (gold)',
              reason:
                'The ask names the gold sales table; every column resolves after two renames.',
              rebinds,
              unmapped: [],
              ops: [],
              plan: planFor(rebinds),
              model: { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-4-6' },
            },
          },
        };
      },
    },
    {
      method: 'get',
      url: '/smus/assets',
      respond: () => ({
        body: {
          success: true,
          data: { configured: true, projectFilter: ['prj-1', 'prj-2'], assets: SMUS_ASSETS },
        },
      }),
    },
    {
      method: 'post',
      url: /\/smus\/assets\/[^/]+\/dataset$/,
      respond: (config) => ({
        body: {
          success: true,
          data: {
            dataSetId: 'customer-dim',
            name: requestBody(config).name ?? 'customer_dim',
            arn: 'arn:x',
          },
        },
      }),
    },
    { method: 'post', url: /\/tags\//, respond: () => ({ body: { success: true, data: {} } }) },
    { method: 'delete', url: /\/tags\//, respond: () => ({ body: { success: true, data: {} } }) },
  ];
}

export const SMUS_NOT_CONFIGURED: MockRoute = {
  method: 'get',
  url: '/smus/assets',
  respond: () => ({
    body: { success: true, data: { configured: false, projectFilter: [], assets: [] } },
  }),
};

// ---------------------------------------------------------------------------
// A fake flow for the step stories: canned state, no-op actions.
// ---------------------------------------------------------------------------

const noop = () => {};
const noopAsync = async () => {};

export function fakeDraft(overrides: Partial<RebindDraft> = {}): RebindDraft {
  const rebinds = overrides.rebinds ?? [];
  return {
    source: SOURCE,
    loading: false,
    loadError: null,
    datasets: DATASETS,
    targets: {},
    columnMaps: {},
    mode: 'clone',
    name: `${SOURCE.name} (gold)`,
    plan: null,
    planning: false,
    planError: null,
    rebinds,
    canApply: false,
    reload: noopAsync,
    setTarget: noop,
    mapColumn: noop,
    acceptSuggestions: noop,
    setMode: noop,
    setName: noop,
    applyProposal: noop,
    ...overrides,
  };
}

export interface FakeFlowOptions {
  addedFields?: AuthorFlow['addedFields'];
  step?: AuthorFlow['state']['step'];
  draft?: Partial<RebindDraft>;
  sourceModel?: WireframeModel | null;
  previewModel?: WireframeModel | null;
  proposal?: AuthorFlow['proposal'];
  result?: AuthorFlow['state']['result'];
  publishError?: string | null;
}

export function fakeFlow(options: FakeFlowOptions = {}): AuthorFlow {
  const draft = fakeDraft(options.draft);
  const sourceModel =
    options.sourceModel === undefined
      ? buildWireframeModel(definitionFixtures.gridDashboardDefinition)
      : options.sourceModel;
  const previewModel = options.previewModel ?? null;
  const state = {
    ...initialAuthorFlowState,
    step: options.step ?? 'source',
    source: SOURCE,
    result: options.result ?? null,
    visited: ['source', 'targets', 'review', 'mockup', 'publish'] as AuthorFlow['state']['visited'],
  };
  return {
    state,
    status: stepStatus(state, { hasTargets: draft.rebinds.length > 0, canApply: draft.canApply }),
    draft,
    source: {
      loading: false,
      error: null,
      exportData: exportFor(definitionFixtures.gridDashboardDefinition),
      model: sourceModel,
      tags: SOURCES[0]!.tags,
      isTemplate: true,
    },
    selectSource: noop,
    goTo: noop,
    next: noop,
    back: noop,
    setTemplate: noopAsync,
    ask: options.proposal ? options.proposal.ask : '',
    setAsk: noop,
    proposing: false,
    proposal: options.proposal ?? null,
    proposeError: null,
    propose: noopAsync,
    preview: {
      loading: false,
      error: null,
      plan: draft.plan,
      model: previewModel,
      diff: sourceModel && previewModel ? diffWireframeModels(sourceModel, previewModel) : null,
    },
    publishing: false,
    publishError: options.publishError ?? null,
    publish: noopAsync,
    addedFields: options.addedFields ?? [],
    addTemplateField: () => {},
    removeTemplateField: () => {},
    setTemplateFieldIdentifier: () => {},
    reset: noop,
  };
}

/** A draft after the planner filled it in and every column resolves. */
export function resolvedDraft(): Partial<RebindDraft> {
  const rebinds = [{ identifier: 'sales', targetDataSetId: 'sales-gold', columnMap: FULL_MAP }];
  return {
    targets: { sales: { id: 'sales-gold', name: 'sales_gold' } },
    columnMaps: { sales: FULL_MAP },
    rebinds,
    plan: planFor(rebinds),
    canApply: true,
  };
}

/** A draft with a target chosen but two columns still undecided. */
export function undecidedDraft(): Partial<RebindDraft> {
  const rebinds = [{ identifier: 'sales', targetDataSetId: 'sales-gold' }];
  return {
    targets: { sales: { id: 'sales-gold', name: 'sales_gold' } },
    rebinds,
    plan: planFor(rebinds),
    canApply: false,
  };
}

export function previewModelFor(map: Record<string, string>): WireframeModel {
  return buildWireframeModel(rewrite(definitionFixtures.gridDashboardDefinition, 'sales', map));
}
