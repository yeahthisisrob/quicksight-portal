/**
 * Story fixtures for the Studio: a fake studio for the editor stories and
 * the HTTP routes the full-page stories run against.
 */

import {
  buildWireframeModel,
  definitionFixtures,
  diffWireframeModels,
  type RebindDraft,
} from '@/entities/definition';

import type {
  AssetInsights,
  DefinitionDataset,
  DefinitionOp,
  RebindPlan,
  RepairPlan,
} from '@/shared/api/modules/authoring';
import type { CalculatedFieldTemplate } from '@/shared/api/modules/data-catalog';
import type { SmusDatasetLink } from '@/shared/api/modules/smus';

import type { MockRoute } from '../../../../../.storybook/mocks/api';
import { requestBody } from '../../../../../.storybook/mocks/api';
import { searchRoute } from '../../../../../.storybook/mocks/search';
import { templateLibraryRoutes } from '../../../../../.storybook/mocks/templates';
import { healthBadges } from '../../lib/insights';
import { outlineFromModel } from '../../lib/ops';
import { repairSummary } from '../../model/repair';
import { initialStudioState, type StudioState } from '../../model/studio';
import type { Studio, StudioDataset } from '../../model/useStudio';
import { simulatePreview } from './simulateOps';

/** Nothing wrong with the asset: the Issues panel says so. */
const CLEAN_REPAIR_PLAN: RepairPlan = {
  issues: [],
  summary: { fixable: 0, needsChoice: 0, unfixable: 0 },
  proposed: { repairs: [], rebinds: [] },
};

/**
 * A source QuickSight refuses to write: a column that clearly got renamed,
 * one that is simply gone, a parameter nobody declared, a dataset that
 * cannot be read, and one error only QuickSight knows about.
 */
export const REPAIR_PLAN: RepairPlan = {
  issues: [
    {
      id: 'column:sales:revenue',
      kind: 'column-missing',
      severity: 'error',
      message:
        'Column revenue is not in sales_silver; net_revenue looks like the same column. Used by 3 visuals, 1 calculated field.',
      identifier: 'sales',
      dataSetId: 'sales-silver',
      columnName: 'revenue',
      usage: { visual: 3, filter: 0, calculatedField: 1, parameter: 0, control: 0, other: 0 },
      quickSight: {
        type: 'COLUMN_NOT_FOUND',
        message: "Column 'revenue' was not found",
        paths: [
          'sheets/sheet-overview/visuals/kpi-revenue',
          'sheets/sheet-overview/visuals/bar-region',
        ],
      },
      fix: { op: 'rename', identifier: 'sales', columnName: 'revenue', to: 'net_revenue' },
      alternatives: [{ op: 'dropColumn', identifier: 'sales', columnName: 'revenue' }],
    },
    {
      id: 'column:sales:promo_code',
      kind: 'column-missing',
      severity: 'error',
      message:
        'Column promo_code is not in sales_silver. Used by 1 filter; removing it takes those references out.',
      identifier: 'sales',
      dataSetId: 'sales-silver',
      columnName: 'promo_code',
      usage: { visual: 0, filter: 1, calculatedField: 0, parameter: 0, control: 0, other: 0 },
      fix: { op: 'dropColumn', identifier: 'sales', columnName: 'promo_code' },
      alternatives: [],
    },
    {
      id: 'parameter:region',
      kind: 'parameter-missing',
      severity: 'error',
      message:
        'Parameter region is used but never declared. Declaring it as a string keeps the controls and filters that read it.',
      parameterName: 'region',
      fix: { op: 'declareParameter', name: 'region', type: 'STRING' },
      alternatives: [{ op: 'dropParameter', name: 'region' }],
    },
    {
      id: 'dataset:targets',
      kind: 'dataset-missing',
      severity: 'error',
      message:
        "Dataset targets-2024 behind 'targets' cannot be read; choose a dataset for it to read instead.",
      identifier: 'targets',
      dataSetId: 'targets-2024',
      alternatives: [],
    },
    {
      id: 'quicksight:ACCESS_DENIED:4',
      kind: 'quicksight-error',
      severity: 'warning',
      message: 'The theme applied to this dashboard cannot be read.',
      quickSight: { type: 'ACCESS_DENIED', message: 'The theme cannot be read', paths: [] },
      alternatives: [],
    },
  ],
  summary: { fixable: 3, needsChoice: 1, unfixable: 1 },
  proposed: {
    repairs: [
      { op: 'dropColumn', identifier: 'sales', columnName: 'promo_code' },
      { op: 'declareParameter', name: 'region', type: 'STRING' },
    ],
    rebinds: [
      {
        identifier: 'sales',
        targetDataSetId: 'sales-silver',
        columnMap: { revenue: 'net_revenue' },
      },
    ],
  },
};

/** The route the full-page stories use; `plan` picks which source is broken. */
export function repairPlanRoute(plan: RepairPlan = CLEAN_REPAIR_PLAN): MockRoute {
  return {
    method: 'post',
    url: /\/repair\/plan$/,
    respond: () => ({ body: { success: true, data: plan } }),
  };
}

export const SOURCE = { type: 'dashboard' as const, id: 'sales-overview', name: 'Sales overview' };
const SILVER = 'arn:aws:quicksight:us-east-1:1:dataset/sales-silver';
const GOLD_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/sales-gold';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Relative to now, so "last viewed 2 days ago" stays true whenever the story runs. */
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

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
const DATASETS: DefinitionDataset[] = [
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

const GOLD_COLUMNS = [
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
function planFor(
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

const TEMPLATE_TAG_ITEM = { key: 'quicksight-portal:template', value: 'true' };

/** Dashboards as the list endpoint returns them, with activity for ranking. */
const SOURCES = [
  {
    id: SOURCE.id,
    name: SOURCE.name,
    tags: [TEMPLATE_TAG_ITEM, { key: 'team', value: 'sales' }],
    activity: { totalViews: 1840, uniqueViewers: 62, lastViewed: daysAgo(2) },
  },
  {
    id: 'exec-summary',
    name: 'Executive summary',
    tags: [TEMPLATE_TAG_ITEM],
    activity: { totalViews: 420, uniqueViewers: 15, lastViewed: daysAgo(10) },
  },
  {
    id: 'ops-daily',
    name: 'Ops daily',
    tags: [],
    activity: { totalViews: 3900, uniqueViewers: 120, lastViewed: daysAgo(1) },
  },
  {
    id: 'marketing-funnel',
    name: 'Marketing funnel',
    tags: [{ key: 'team', value: 'marketing' }],
    activity: { totalViews: 150, uniqueViewers: 20, lastViewed: daysAgo(30) },
    definitionErrors: [
      { type: 'COLUMN_NOT_FOUND', message: "Column 'promo_code' was not found" },
      { type: 'PARAMETER_NOT_FOUND', message: "Parameter 'region' was not found" },
    ],
  },
  {
    id: 'finance-close',
    name: 'Finance close',
    tags: [{ key: 'team', value: 'finance' }],
    activity: { totalViews: 12, uniqueViewers: 3, lastViewed: daysAgo(200) },
  },
  { id: 'churn-deep-dive', name: 'Churn deep dive', tags: [], activity: { totalViews: 0 } },
];

/** Views plus CloudWatch health: one slow visual, one that errors. */
const INSIGHTS: AssetInsights = {
  assetType: 'dashboard',
  assetId: SOURCE.id,
  views: { total: 1840, last30d: 310, uniqueViewers: 62, lastViewedAt: daysAgo(2) },
  health: {
    windowDays: 14,
    viewLoads: 412,
    viewLoadTimeP90Ms: 2100,
    visuals: [
      { sheetId: 'sheet-overview', visualId: 'table-detail', loadTimeP90Ms: 4800, errors: 0 },
      { sheetId: 'sheet-overview', visualId: 'line-trend', loadTimeP90Ms: 900, errors: 7 },
      { sheetId: 'sheet-overview', visualId: 'bar-region', loadTimeP90Ms: 1200, errors: 0 },
      { sheetId: 'sheet-overview', visualId: 'kpi-revenue', loadTimeP90Ms: 300, errors: 0 },
    ],
  },
};

const FOLDERS = [
  { id: 'fld-sales', name: 'Sales', path: '/Sales', memberCount: 12, arn: 'arn:x' },
  {
    id: 'fld-sales-eu',
    name: 'EMEA',
    path: '/Sales/EMEA',
    memberCount: 4,
    parentId: 'fld-sales',
    arn: 'arn:x',
  },
  { id: 'fld-finance', name: 'Finance', path: '/Finance', memberCount: 9, arn: 'arn:x' },
  {
    id: 'fld-shared',
    name: 'Shared templates',
    path: '/Shared templates',
    memberCount: 3,
    arn: 'arn:x',
  },
];

function exportFor(definition: unknown, tags = SOURCES[0]!.tags) {
  return {
    apiResponses: {
      list: { data: { DashboardId: SOURCE.id, Name: SOURCE.name } },
      definition: { data: { Definition: definition } },
      tags: { data: tags },
    },
  };
}

const TEMPLATES: CalculatedFieldTemplate[] = [
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

function withTargetNames(
  rebinds: Array<{
    identifier: string;
    targetDataSetId: string;
    columnMap?: Record<string, string>;
  }>
) {
  return rebinds.map((r) => ({
    ...r,
    targetName: r.targetDataSetId === 'sales-gold' ? 'sales_gold' : r.targetDataSetId,
  }));
}

/** What SMUS says about the source's datasets: targets is governed, sales is not. */
const SMUS_LINKS: SmusDatasetLink[] = [
  { datasetId: 'sales-silver', linked: false },
  {
    datasetId: 'targets',
    linked: true,
    matchType: 'name',
    listingId: 'lst-targets',
    listingName: 'revenue_targets',
  },
];

/** SMUS configured, and the links for whichever datasets are asked about. */
function smusRoutes(): MockRoute[] {
  return [
    {
      method: 'get',
      url: '/smus/status',
      respond: () => ({
        body: {
          success: true,
          data: { configured: true, domainId: 'dzd_example', region: 'us-east-1' },
        },
      }),
    },
    {
      method: 'post',
      url: '/smus/dataset-links',
      respond: (config) => {
        const ids: string[] = requestBody(config).datasetIds ?? [];
        return {
          body: {
            success: true,
            data: {
              links: ids.map(
                (id) =>
                  SMUS_LINKS.find((l) => l.datasetId === id) ?? { datasetId: id, linked: false }
              ),
            },
          },
        };
      },
    },
  ];
}

/** SMUS is not set up: the Data panel says so, and nothing else changes. */
export const SMUS_NOT_CONFIGURED: MockRoute = {
  method: 'get',
  url: '/smus/status',
  respond: () => ({ body: { success: true, data: { configured: false } } }),
};

/** Every route the Studio can hit, with realistic answers. */
export function authorRoutes(overrides: MockRoute[] = []): MockRoute[] {
  return [
    ...overrides,
    searchRoute(),
    ...smusRoutes(),
    ...templateLibraryRoutes(TEMPLATES),
    settingsSnapshotRoute('dzd_example', ['proj-published-prod']),
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
      url: /\/assets\/folders\/paginated/,
      respond: (config) => {
        const search = String(config.params?.search ?? '').toLowerCase();
        const folders = FOLDERS.filter((f) => !search || f.name.toLowerCase().includes(search));
        return {
          body: {
            success: true,
            data: {
              folders,
              pagination: { page: 1, pageSize: 25, totalItems: folders.length, totalPages: 1 },
            },
          },
        };
      },
    },
    {
      method: 'get',
      url: /\/assets\/datasets\/paginated/,
      respond: (config) => {
        const search = String(config.params?.search ?? '').toLowerCase();
        const all = [
          { id: 'sales-gold', name: 'sales_gold' },
          { id: 'targets-2025', name: 'targets_2025' },
        ];
        const datasets = all.filter((d) => d.name.includes(search));
        return {
          body: {
            success: true,
            data: {
              datasets,
              pagination: { page: 1, pageSize: 25, totalItems: datasets.length, totalPages: 1 },
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
      method: 'get',
      url: /\/authoring\/.*\/insights$/,
      respond: (config) => {
        const parts = String(config.url).split('/');
        const id = parts[parts.length - 2];
        const source = SOURCES.find((s) => s.id === id);
        const body: AssetInsights =
          id === SOURCE.id
            ? INSIGHTS
            : {
                assetType: 'dashboard',
                assetId: id ?? '',
                views: {
                  total: source?.activity?.totalViews ?? 0,
                  last30d: Math.round((source?.activity?.totalViews ?? 0) / 6),
                  uniqueViewers: source?.activity?.uniqueViewers ?? 0,
                  lastViewedAt: source?.activity?.lastViewed,
                },
              };
        return { body: { success: true, data: body } };
      },
    },
    repairPlanRoute(),
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
        const { rebinds = [], ops = [] } = requestBody(config);
        const sim = simulatePreview(
          definitionFixtures.gridDashboardDefinition,
          withTargetNames(rebinds),
          [],
          ops
        );
        return {
          body: {
            success: true,
            data: {
              plan: planFor(rebinds),
              definition: sim.definition,
              changes: sim.changes,
              outline: sim.outline,
            },
          },
        };
      },
    },
    {
      method: 'post',
      url: /\/rebind$/,
      respond: (config) => {
        const { mode, name, rebinds = [], ops = [], folderId } = requestBody(config);
        const sim = simulatePreview(
          definitionFixtures.gridDashboardDefinition,
          withTargetNames(rebinds),
          [],
          ops
        );
        return {
          body: {
            success: true,
            data: {
              assetType: 'dashboard',
              assetId: mode === 'clone' ? 'sales-overview-copy' : SOURCE.id,
              name: name ?? SOURCE.name,
              arn: 'arn:x',
              mode,
              versionNumber: 2,
              plan: planFor(rebinds),
              changes: sim.changes,
              folderId,
            },
          },
        };
      },
    },
    { method: 'post', url: /\/tags\//, respond: () => ({ body: { success: true, data: {} } }) },
    { method: 'delete', url: /\/tags\//, respond: () => ({ body: { success: true, data: {} } }) },
  ];
}

/** The settings snapshot the page gate reads: a domain and the selected projects. */
export function settingsSnapshotRoute(domainId: string | null, projectIds: string[]): MockRoute {
  const base = { description: '', source: 'stored' as const, sensitive: false };
  return {
    method: 'get',
    url: /\/settings$/,
    respond: () => ({
      body: {
        success: true,
        data: {
          groups: [
            {
              id: 'smus',
              title: 'SageMaker Unified Studio',
              description: '',
              settings: [
                {
                  ...base,
                  key: 'smus.domainId',
                  label: 'Domain id',
                  type: 'string',
                  value: domainId ?? undefined,
                },
                {
                  ...base,
                  key: 'smus.projectIds',
                  label: 'Projects to read from',
                  type: 'multiselect',
                  value: projectIds,
                  optionsFrom: '/settings/smus/projects',
                },
              ],
            },
          ],
        },
      },
    }),
  };
}

/** The page-level gate: no domain configured at all. */
export const SMUS_SETTINGS_NOT_CONFIGURED: MockRoute = settingsSnapshotRoute(null, []);

/** The page-level gate: a domain, but no project selected yet. */
export const SMUS_SETTINGS_NO_PROJECTS: MockRoute = settingsSnapshotRoute('dzd_example', []);

// ---------------------------------------------------------------------------
// A fake studio for the editor stories: canned state, no-op actions.
// ---------------------------------------------------------------------------

const noop = () => {};
const noopAsync = async () => {};

function fakeDraft(overrides: Partial<RebindDraft> = {}): RebindDraft {
  return {
    source: SOURCE,
    loading: false,
    loadError: null,
    datasets: DATASETS,
    targets: {},
    columnMaps: {},
    mode: 'update',
    name: '',
    plan: null,
    planning: false,
    planError: null,
    rebinds: [],
    canApply: true,
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

interface FakeStudioOptions {
  /** No asset open: the Editor shows the browser. */
  closed?: boolean;
  panel?: StudioState['panel'];
  /** Edits on the canvas; the preview, changes and outline follow from them. */
  ops?: DefinitionOp[];
  selectedElement?: StudioState['selectedElement'];
  result?: StudioState['result'];
  saveError?: string | null;
  /** Defaults to INSIGHTS; null for an asset without any. */
  insights?: AssetInsights | null;
  /** Defaults to a clean plan; REPAIR_PLAN has every kind of issue. */
  repairPlan?: RepairPlan | null;
  /** SMUS configured (the default) or not. */
  smus?: boolean;
  /** No cached definition. */
  noDefinition?: boolean;
}

export function fakeStudio(options: FakeStudioOptions = {}): Studio {
  const draft = fakeDraft();
  const sourceModel = options.noDefinition
    ? null
    : buildWireframeModel(definitionFixtures.gridDashboardDefinition);
  const ops = options.ops ?? [];
  const simulated =
    ops.length > 0
      ? simulatePreview(definitionFixtures.gridDashboardDefinition, [], [], ops)
      : null;
  const previewModel = simulated ? buildWireframeModel(simulated.definition) : null;
  const insights = options.insights === undefined ? INSIGHTS : options.insights;
  const repairPlan = options.repairPlan === undefined ? CLEAN_REPAIR_PLAN : options.repairPlan;
  // Unset choices mean the proposal: every proposed fix counts until changed.
  const choices = {};
  const summary = repairSummary(repairPlan, choices, draft.targets);
  const smus = options.smus ?? true;
  const datasets: StudioDataset[] = DATASETS.map((d) => ({
    identifier: d.identifier,
    dataSetId: d.dataSetId,
    columns: d.columns.length,
    calculatedFields: d.calculatedFields.length,
    smus: smus ? SMUS_LINKS.find((l) => l.datasetId === d.dataSetId) : undefined,
  }));
  const state: StudioState = {
    ...initialStudioState,
    source: options.closed ? null : SOURCE,
    panel: options.panel ?? 'issues',
    ops,
    selectedElement: options.selectedElement ?? null,
    result: options.result ?? null,
  };
  const dirty = ops.length > 0 || summary.accepted > 0;
  return {
    state,
    draft,
    source: {
      loading: false,
      error: null,
      model: sourceModel,
      tags: SOURCES[0]!.tags,
      isTemplate: true,
    },
    insights: { loading: false, error: null, data: insights },
    repair: {
      loading: false,
      error: null,
      plan: repairPlan,
      choices,
      summary,
      choose: noop,
      acceptAll: noop,
    },
    data: { loading: false, datasets, smusConfigured: smus },
    healthBadges: healthBadges(insights),
    preview: {
      loading: false,
      error: null,
      plan: null,
      model: previewModel,
      diff: sourceModel && previewModel ? diffWireframeModels(sourceModel, previewModel) : null,
      changes: simulated?.changes ?? [],
      outline: simulated?.outline ?? (sourceModel ? outlineFromModel(sourceModel) : null),
      warnings: [],
    },
    open: noop,
    setPanel: noop,
    addOps: noop,
    removeOp: noop,
    undoOp: noop,
    clearOps: noop,
    selectElement: noop,
    dirty,
    canSave: summary.needsChoice === 0,
    saving: false,
    saveError: options.saveError ?? null,
    save: async () => null,
    dismissResult: noop,
    setTemplate: noopAsync,
  };
}

/** A handful of edits that exercise every highlight the mockup can draw. */
export const EDITOR_OPS: DefinitionOp[] = [
  {
    op: 'retitle',
    sheetId: 'sheet-overview',
    elementId: 'bar-region',
    title: 'Net revenue by region',
  },
  { op: 'retype', sheetId: 'sheet-overview', elementId: 'bar-region', visualType: 'LineChart' },
  { op: 'move', sheetId: 'sheet-overview', elementId: 'kpi-orders', col: 0, row: 6 },
  { op: 'resize', sheetId: 'sheet-overview', elementId: 'kpi-revenue', colSpan: 18, rowSpan: 4 },
  { op: 'remove', sheetId: 'sheet-overview', elementId: 'line-trend' },
  {
    op: 'duplicate',
    sheetId: 'sheet-overview',
    elementId: 'table-detail',
    title: 'Top customers (EMEA)',
    col: 0,
    row: 22,
  },
  { op: 'renameSheet', sheetId: 'sheet-overview', name: 'Overview (gold)' },
];
