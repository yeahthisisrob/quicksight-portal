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

import type {
  AssetInsights,
  DefinitionChange,
  DefinitionDataset,
  DefinitionOp,
  NewAssetRequest,
  RebindPlan,
  RepairPlan,
  VisualSpec,
} from '@/shared/api/modules/authoring';
import type { SmusAsset } from '@/shared/api/modules/smus';

import type { MockRoute } from '../../../../../.storybook/mocks/api';
import { requestBody } from '../../../../../.storybook/mocks/api';
import { searchRoute } from '../../../../../.storybook/mocks/search';
import { healthBadges } from '../../lib/insights';
import { outlineFromModel } from '../../lib/ops';
import {
  type AuthorFlowState,
  authorSteps,
  EMPTY_FRESH,
  type FreshAsset,
  initialAuthorFlowState,
  initialNewFlowState,
  stepStatus,
} from '../../model/authorFlow';
import { type DatasetColumn, isComplete, newAssetRequest } from '../../model/newAsset';
import { defaultChoices, repairRequests, repairSummary } from '../../model/repair';
import {
  defaultParts,
  hasStandard,
  NO_TYPE_RULES,
  type StandardTemplate,
  type StandardTypeRules,
} from '../../model/standard';
import type { AuthorFlow, NewAssetFlow, StandardCandidate } from '../../model/useAuthorFlow';
import { simulateNew } from './simulateNew';
import { simulatePreview } from './simulateOps';

/** Nothing wrong with the source: the Repair step stays hidden. */
export const CLEAN_REPAIR_PLAN: RepairPlan = {
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
/** When the SMUS snapshot the stories read was taken. */
export const SMUS_EXPORTED_AT = '2026-09-18T09:30:00Z';
export const SILVER = 'arn:aws:quicksight:us-east-1:1:dataset/sales-silver';
export const GOLD_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/sales-gold';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Relative to now, so "last viewed 2 days ago" stays true whenever the story runs. */
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

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

const TEMPLATE_TAG_ITEM = { key: 'quicksight-portal:template', value: 'true' };

// ---------------------------------------------------------------------------
// From nothing: the datasets a new dashboard can read and what the planner
// proposes for them.
// ---------------------------------------------------------------------------

/** Output columns by dataset id, as the cached dataset exports carry them. */
export const DATASET_COLUMNS: Record<string, DatasetColumn[]> = {
  'sales-gold': GOLD_COLUMNS,
  targets: [
    { name: 'region', type: 'STRING' },
    { name: 'target_revenue', type: 'DECIMAL' },
    { name: 'target_month', type: 'DATETIME' },
  ],
  'sales-bronze': [],
};

const DATASET_NAMES: Record<string, string> = {
  'sales-gold': 'sales_gold',
  targets: 'targets',
  'sales-bronze': 'sales_bronze',
};

/** What the authoring columns endpoint answers for a dataset. */
export function datasetColumnsFor(dataSetId: string) {
  return {
    dataSetId,
    name: DATASET_NAMES[dataSetId] ?? dataSetId,
    columns: DATASET_COLUMNS[dataSetId] ?? [],
  };
}

/** The datasets a from-nothing story starts with. */
export const FRESH_DATASETS: FreshAsset['datasets'] = [
  { identifier: 'sales_gold', dataSetId: 'sales-gold', name: 'sales_gold' },
  { identifier: 'targets', dataSetId: 'targets', name: 'targets' },
];

/** What the planner proposes for "revenue, orders, by region, a trend, top customers". */
export const PROPOSED_VISUALS: VisualSpec[] = [
  {
    type: 'KPI',
    title: 'Revenue',
    identifier: 'sales_gold',
    values: [{ column: 'net_revenue', aggregation: 'SUM' }],
  },
  {
    type: 'KPI',
    title: 'Orders',
    identifier: 'sales_gold',
    values: [{ column: 'order_id', aggregation: 'DISTINCT_COUNT' }],
  },
  {
    type: 'BarChart',
    title: 'Revenue by region',
    identifier: 'sales_gold',
    category: 'region',
    values: [{ column: 'net_revenue', aggregation: 'SUM' }],
    color: 'channel',
  },
  {
    type: 'LineChart',
    title: 'Monthly trend',
    identifier: 'sales_gold',
    category: 'Order Date',
    granularity: 'MONTH',
    values: [{ column: 'net_revenue', aggregation: 'SUM' }],
  },
  {
    type: 'Table',
    title: 'Top customers',
    identifier: 'sales_gold',
    category: 'customer_name',
    values: [
      { column: 'net_revenue', aggregation: 'SUM' },
      { column: 'margin', aggregation: 'SUM' },
    ],
  },
];

export const FRESH_PROPOSAL = {
  reason:
    'Revenue and orders lead as KPIs; region and channel are the only categorical columns worth splitting revenue by; Order Date gives the trend; customers make the table.',
  model: { provider: 'bedrock', model: 'us.anthropic.claude-sonnet-4-6' },
};

/** The server's from-nothing preview for a request, with the story datasets' columns. */
export function newAssetPreviewFor(request: NewAssetRequest) {
  return simulateNew(request, DATASET_COLUMNS, { visuals: PROPOSED_VISUALS, ...FRESH_PROPOSAL });
}

/** Dashboards as the list endpoint returns them, with activity for ranking. */
export const SOURCES = [
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
export const INSIGHTS: AssetInsights = {
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

export const FOLDERS = [
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

/** A planner proposal that also suggests an edit. */
export const PROPOSED_OPS: DefinitionOp[] = [
  { op: 'retype', sheetId: 'sheet-overview', elementId: 'bar-region', visualType: 'ColumnChart' },
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

export const SMUS_PROJECTS = [
  { id: 'proj-published-prod', name: 'published_prod', description: 'Published layer' },
  { id: 'proj-published-dev', name: 'published_dev', description: 'Published layer, dev' },
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

/** Dashboards tagged as templates, as the Standard step lists them. */
export const STANDARD_CANDIDATES: StandardCandidate[] = SOURCES.filter((s) =>
  s.tags.some((t) => t.key === 'quicksight-portal:template')
).map((s) => ({ id: s.id, name: s.name, views: s.activity.totalViews }));

/** A migration the stories can show: the executive summary as the standard, with rules. */
export const STANDARD_TEMPLATE: StandardTemplate = {
  assetType: 'dashboard',
  assetId: 'exec-summary',
  name: 'Executive summary',
  parts: defaultParts(),
};
export const STANDARD_RULES: StandardTypeRules = {
  chartFamily: [
    { from: 'Table', to: 'PivotTable' },
    { from: 'BarChart', to: 'ColumnChart' },
  ],
  kpi: true,
  casts: true,
};

interface StandardEffects {
  changes: DefinitionChange[];
  warnings: string[];
  themeArn?: string;
}

/**
 * What the server would add to a preview for a template and type rules: the
 * change list entries and the warnings. The layout itself is not simulated.
 */
export function standardEffects(template: unknown, typeRules: unknown): StandardEffects {
  const changes: DefinitionChange[] = [];
  const warnings: string[] = [];
  const t = template as
    | { assetId?: string; controls?: boolean; sheetNames?: boolean; theme?: boolean }
    | undefined;
  const r = typeRules as
    | { chartFamily?: Array<{ from: string; to: string }>; kpi?: boolean; casts?: boolean }
    | undefined;
  if (t?.assetId) {
    if (t.controls !== false) {
      changes.push({
        kind: 'template',
        sheetId: 'sheet-overview',
        description: "Replaced 2 controls on Overview with the template's",
      });
      warnings.push(
        "Template control 'Segment' was dropped: no dataset here has the columns it filters."
      );
    }
    if (t.sheetNames !== false) {
      changes.push({
        kind: 'sheet',
        sheetId: 'sheet-overview',
        description: "Renamed sheet 'Overview' to 'Standard overview'",
      });
    }
    changes.push({
      kind: 'template',
      sheetId: 'sheet-overview',
      description:
        'Laid out 5 visuals on Standard overview in 18x12 tiles (KPIs 9x6 first), with 3 elements from the template',
    });
    if (t.theme !== false) {
      changes.push({ kind: 'template', description: "Takes the template's theme" });
    }
  }
  for (const rule of r?.chartFamily ?? []) {
    if (rule.from === 'Table') {
      changes.push({
        kind: 'visual',
        sheetId: 'sheet-overview',
        elementId: 'table-detail',
        description:
          'Changed Top customers from a table to a pivot table; axis, legend and sort settings reset to defaults',
      });
    } else if (rule.from === 'BarChart') {
      changes.push({
        kind: 'visual',
        sheetId: 'sheet-overview',
        elementId: 'bar-region',
        description:
          'Changed Revenue by region from a bar chart to a column chart; axis, legend and sort settings reset to defaults',
      });
    } else {
      warnings.push(`Monthly trend stayed a ${rule.from}: its fields do not fit a ${rule.to}`);
    }
  }
  if (r?.kpi) {
    changes.push({
      kind: 'visual',
      sheetId: 'sheet-overview',
      elementId: 'kpi-revenue',
      description: "Revenue takes the template's KPI options",
    });
    changes.push({
      kind: 'visual',
      sheetId: 'sheet-overview',
      elementId: 'kpi-orders',
      description: "Orders takes the template's KPI options",
    });
  }
  if (r?.casts) {
    changes.push({
      kind: 'calculatedField',
      description:
        'sales: order_date is STRING now, so order_date_as_datetime = parseDate({order_date}) takes its place',
    });
    warnings.push(
      'sales: discount was DECIMAL and is now DATETIME; no cast is known, visuals may fail.'
    );
  }
  const themeArn =
    t?.assetId && t.theme !== false ? 'arn:aws:quicksight:us-east-1:1:theme/standard' : undefined;
  return { changes, warnings, ...(themeArn ? { themeArn } : {}) };
}

export function authorRoutes(overrides: MockRoute[] = []): MockRoute[] {
  return [
    ...overrides,
    searchRoute(),
    settingsSnapshotRoute(
      'dzd_example',
      SMUS_PROJECTS.map((p) => p.id)
    ),
    {
      method: 'get',
      url: '/settings/smus/projects',
      respond: () => ({
        body: { success: true, data: { configured: true, projects: SMUS_PROJECTS } },
      }),
    },
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
      url: /\/authoring\/datasets\/[^/]+\/columns$/,
      respond: (config) => {
        const parts = String(config.url).split('/');
        const id = parts[parts.length - 2] ?? '';
        return { body: { success: true, data: datasetColumnsFor(id) } };
      },
    },
    {
      method: 'post',
      url: /\/authoring\/new\/preview$/,
      respond: (config) => ({
        body: { success: true, data: newAssetPreviewFor(requestBody(config)) },
      }),
    },
    {
      method: 'post',
      url: /\/authoring\/new$/,
      respond: (config) => {
        const request = requestBody<NewAssetRequest>(config);
        const built = newAssetPreviewFor(request);
        return {
          body: {
            success: true,
            data: {
              assetType: request.assetType,
              assetId: 'regional-sales-new',
              name: request.name,
              arn: 'arn:x',
              versionNumber: request.assetType === 'dashboard' ? 1 : undefined,
              changes: built.changes,
              warnings: built.warnings,
              folderId: request.folderId,
            },
          },
        };
      },
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
        const {
          rebinds = [],
          addCalculatedFields = [],
          ops = [],
          template,
          typeRules,
        } = requestBody(config);
        const sim = simulatePreview(
          definitionFixtures.gridDashboardDefinition,
          withTargetNames(rebinds),
          addCalculatedFields,
          ops
        );
        const standard = standardEffects(template, typeRules);
        return {
          body: {
            success: true,
            data: {
              plan: planFor(rebinds),
              definition: sim.definition,
              changes: [...standard.changes, ...sim.changes],
              outline: sim.outline,
              ...(standard.warnings.length ? { warnings: standard.warnings } : {}),
              ...(standard.themeArn ? { themeArn: standard.themeArn } : {}),
            },
          },
        };
      },
    },
    {
      method: 'post',
      url: /\/rebind$/,
      respond: (config) => {
        const {
          mode,
          name,
          rebinds = [],
          addCalculatedFields = [],
          ops = [],
          folderId,
          template,
          typeRules,
        } = requestBody(config);
        const sim = simulatePreview(
          definitionFixtures.gridDashboardDefinition,
          withTargetNames(rebinds),
          addCalculatedFields,
          ops
        );
        const standard = standardEffects(template, typeRules);
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
              changes: [...standard.changes, ...sim.changes],
              folderId,
              ...(standard.warnings.length ? { warnings: standard.warnings } : {}),
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
                'The ask names the gold sales table; every column resolves after two renames. Revenue by region reads better as columns.',
              rebinds,
              unmapped: [],
              ops: PROPOSED_OPS,
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
          data: {
            configured: true,
            exportedAt: SMUS_EXPORTED_AT,
            projectFilter: ['prj-1', 'prj-2'],
            assets: SMUS_ASSETS,
          },
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
    body: {
      success: true,
      data: { configured: false, exportedAt: null, projectFilter: [], assets: [] },
    },
  }),
};

/** A configured domain that has never been exported: the picker points at Operations. */
export const SMUS_NOT_EXPORTED: MockRoute = {
  method: 'get',
  url: '/smus/assets',
  respond: () => ({
    body: {
      success: true,
      data: { configured: true, exportedAt: null, projectFilter: ['prj-1'], assets: [] },
    },
  }),
};

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
  /** Overrides the simulated preview. */
  previewModel?: WireframeModel | null;
  proposal?: AuthorFlow['proposal'];
  result?: AuthorFlow['state']['result'];
  publishError?: string | null;
  /** Edits on the mockup; the preview, changes and outline follow from them. */
  ops?: DefinitionOp[];
  selectedElement?: AuthorFlowState['selectedElement'];
  folder?: AuthorFlowState['folder'];
  /** Defaults to INSIGHTS; null for an asset without any. */
  insights?: AssetInsights | null;
  previewLoading?: boolean;
  /** Defaults to a clean plan; REPAIR_PLAN shows the Repair step. */
  repairPlan?: RepairPlan | null;
  /** The Standard step: a template dashboard and bulk type rules. */
  template?: StandardTemplate | null;
  typeRules?: StandardTypeRules;
  /** From nothing: the flow in New mode with these datasets and visuals. */
  fresh?: Partial<FreshAsset>;
  /** Shown once on the Visuals step after a proposal. */
  freshProposal?: NewAssetFlow['proposal'];
  /** Text in the ask box. */
  ask?: string;
}

export function fakeFlow(options: FakeFlowOptions = {}): AuthorFlow {
  if (options.fresh) {
    return fakeNewFlow(options);
  }
  const draft = fakeDraft(options.draft);
  const sourceModel =
    options.sourceModel === undefined
      ? buildWireframeModel(definitionFixtures.gridDashboardDefinition)
      : options.sourceModel;
  const ops = options.ops ?? [];
  const addedFields = options.addedFields ?? [];
  const simulated =
    draft.rebinds.length > 0 || ops.length > 0 || addedFields.length > 0
      ? simulatePreview(
          definitionFixtures.gridDashboardDefinition,
          withTargetNames(draft.rebinds),
          addedFields,
          ops
        )
      : null;
  const previewModel =
    options.previewModel !== undefined
      ? options.previewModel
      : simulated
        ? buildWireframeModel(simulated.definition)
        : null;
  const insights = options.insights === undefined ? INSIGHTS : options.insights;
  const repairPlan = options.repairPlan === undefined ? CLEAN_REPAIR_PLAN : options.repairPlan;
  const repairChoices = defaultChoices(repairPlan);
  const repairs = repairRequests(repairPlan, repairChoices);
  const summary = repairSummary(repairPlan, repairChoices, draft.targets);
  const repairIssues = repairPlan?.issues.length ?? 0;
  const template = options.template ?? null;
  const typeRules = options.typeRules ?? NO_TYPE_RULES;
  const standard = standardEffects(
    template ? { assetId: template.assetId, ...template.parts } : undefined,
    hasStandard(null, typeRules) ? typeRules : undefined
  );
  const state: AuthorFlowState = {
    ...initialAuthorFlowState,
    step: options.step ?? 'source',
    source: SOURCE,
    result: options.result ?? null,
    visited: ['source', 'repair', 'targets', 'review', 'standard', 'mockup', 'publish'],
    ops,
    folder: options.folder ?? null,
    selectedElement: options.selectedElement ?? null,
    template,
    typeRules,
  };
  const standardActive = hasStandard(template, typeRules);
  const canApply =
    draft.rebinds.length > 0 ? draft.canApply : draft.mode === 'update' || draft.name.length > 0;
  return {
    state,
    status: stepStatus(state, {
      hasTargets: draft.rebinds.length > 0,
      canApply,
      hasOps: ops.length > 0,
      hasAddedFields: addedFields.length > 0,
      renamed: draft.mode === 'clone' ? draft.name.length > 0 : draft.name !== SOURCE.name,
      repairIssues,
      hasRepairs: repairs.repairs.length > 0 || Object.keys(repairs.columnMaps).length > 0,
      repairsSettled: summary.needsChoice === 0,
      hasStandard: standardActive,
    }),
    steps: authorSteps(repairIssues > 0),
    draft,
    repair: {
      loading: false,
      error: null,
      plan: repairPlan,
      choices: repairChoices,
      summary,
      repairs: repairs.repairs,
      choose: noop,
      acceptAll: noop,
    },
    source: {
      loading: false,
      error: null,
      exportData: exportFor(definitionFixtures.gridDashboardDefinition),
      model: sourceModel,
      tags: SOURCES[0]!.tags,
      isTemplate: true,
    },
    insights: { loading: false, error: null, data: insights },
    healthBadges: healthBadges(insights),
    selectSource: noop,
    startNew: noop,
    fresh: fakeFresh(EMPTY_FRESH),
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
      loading: options.previewLoading ?? false,
      error: null,
      plan: draft.plan,
      model: previewModel,
      diff: sourceModel && previewModel ? diffWireframeModels(sourceModel, previewModel) : null,
      changes: [...standard.changes, ...(simulated?.changes ?? [])],
      outline: simulated?.outline ?? (sourceModel ? outlineFromModel(sourceModel) : null),
      warnings: standard.warnings,
      themeArn: standard.themeArn ?? null,
    },
    standard: {
      template,
      typeRules,
      candidates: { loading: false, items: STANDARD_CANDIDATES },
      chooseTemplate: noop,
      setTemplatePart: noop,
      setTypeRules: noop,
      addChartRule: noop,
      removeChartRule: noop,
      active: standardActive,
    },
    addOps: noop,
    removeOp: noop,
    undoOp: noop,
    clearOps: noop,
    selectElement: noop,
    setFolder: noop,
    publishing: false,
    publishError: options.publishError ?? null,
    publish: noopAsync,
    addedFields,
    addTemplateField: () => {},
    removeTemplateField: () => {},
    setTemplateFieldIdentifier: () => {},
    reset: noop,
    startFromResult: noop,
  };
}

function fakeFresh(fresh: FreshAsset, proposal: NewAssetFlow['proposal'] = null): NewAssetFlow {
  const columns: NewAssetFlow['columns'] = {};
  for (const dataset of fresh.datasets) {
    columns[dataset.identifier] = {
      loading: false,
      columns: DATASET_COLUMNS[dataset.dataSetId] ?? [],
    };
  }
  return {
    assetType: fresh.assetType,
    setAssetType: noop,
    name: fresh.name,
    setName: noop,
    sheetName: fresh.sheetName,
    setSheetName: noop,
    datasets: fresh.datasets,
    addDataset: noop,
    removeDataset: noop,
    setIdentifier: noop,
    columns,
    visuals: fresh.visuals,
    addVisual: noop,
    updateVisual: noop,
    removeVisual: noop,
    addValue: noop,
    updateValue: noop,
    removeValue: noop,
    proposal,
    audience: fresh.audience,
    setAudience: noop,
    ready: fresh.datasets.length > 0 && fresh.visuals.some(isComplete),
  };
}

/** The flow in New mode: canned datasets and visuals, the preview simulated from them. */
function fakeNewFlow(options: FakeFlowOptions): AuthorFlow {
  const fresh: FreshAsset = { ...EMPTY_FRESH, ...options.fresh };
  const template = options.template ?? null;
  const typeRules = options.typeRules ?? NO_TYPE_RULES;
  const standardActive = hasStandard(template, typeRules);
  const request = newAssetRequest({
    assetType: fresh.assetType,
    name: fresh.name || 'Preview',
    datasets: fresh.datasets,
    visuals: fresh.visuals,
    sheetName: fresh.sheetName,
    template: template
      ? { assetType: template.assetType, assetId: template.assetId, ...template.parts }
      : undefined,
    typeRules: hasStandard(null, typeRules) ? typeRules : undefined,
  });
  const ready = fresh.datasets.length > 0 && fresh.visuals.some(isComplete);
  const built = ready ? newAssetPreviewFor(request) : null;
  const standard = standardEffects(
    template ? { assetId: template.assetId, ...template.parts } : undefined,
    hasStandard(null, typeRules) ? typeRules : undefined
  );
  const state: AuthorFlowState = {
    ...initialNewFlowState,
    step: options.step ?? 'targets',
    result: options.result ?? null,
    visited: ['targets', 'visuals', 'standard', 'mockup', 'publish'],
    folder: options.folder ?? null,
    template,
    typeRules,
    fresh,
  };
  const previewModel = built ? buildWireframeModel(built.definition) : null;
  const base = fakeFlow({ step: options.step, template, typeRules, result: options.result });
  return {
    ...base,
    state,
    status: stepStatus(state, {
      hasTargets: false,
      canApply: ready,
      hasStandard: standardActive,
      hasVisuals: ready,
    }),
    steps: authorSteps(false, 'new'),
    draft: fakeDraft({ datasets: [], name: '', mode: 'clone' }),
    source: {
      loading: false,
      error: null,
      exportData: null,
      model: null,
      tags: [],
      isTemplate: false,
    },
    insights: { loading: false, error: null, data: null },
    healthBadges: new Map(),
    fresh: fakeFresh(fresh, options.freshProposal ?? null),
    ask: options.ask ?? '',
    proposal: null,
    preview: {
      loading: options.previewLoading ?? false,
      error: null,
      plan: null,
      model: previewModel,
      diff: null,
      changes: built
        ? [...built.changes, ...standard.changes.filter((c) => c.kind !== 'template')]
        : [],
      outline: built?.outline ?? null,
      warnings: built ? [...built.warnings, ...standard.warnings] : [],
      themeArn: built?.themeArn ?? null,
    },
    publishError: options.publishError ?? null,
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
