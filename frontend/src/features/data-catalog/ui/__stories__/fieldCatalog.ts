/**
 * Synthetic field-first catalog for stories: a margin family with a conflict,
 * a templated field, an unused one, dashboard-defined ones, and the columns
 * they read, tied to the SMUS listings in ./fixtures. Names are generic.
 */
import type {
  CalculatedFieldCatalog,
  CalculatedFieldDetail,
  CalculatedFieldSummary,
  ColumnCatalog,
  ColumnCatalogItem,
  FieldLineage,
  FieldLineageNode,
  FieldUsedIn,
  FieldVisualUsage,
  LineageRead,
} from '@/shared/api/modules/data-catalog';

import type { MockRoute } from '../../../../../.storybook/mocks/api';

const EXPORTED_AT = '2026-09-18T09:30:00Z';

const SALES_LISTING = {
  listingId: 'lst-sales-gold',
  name: 'sales_gold',
  projectId: 'proj-analytics-prod',
  projectName: 'analytics_prod',
  url: 'https://smus.example/catalog/assets/lst-sales-gold',
};
const TARGETS_LISTING = {
  listingId: 'lst-revenue-targets',
  name: 'sales_targets',
  projectId: 'proj-analytics-prod',
  projectName: 'analytics_prod',
  url: 'https://smus.example/catalog/assets/lst-targets',
};

const DS_GOLD = { id: 'ds-sales-gold', name: 'Sales (gold)', listing: SALES_LISTING };
const DS_EXEC = { id: 'ds-sales-exec', name: 'Sales for executives', listing: SALES_LISTING };
const DS_TARGETS = { id: 'ds-targets', name: 'Targets', listing: TARGETS_LISTING };
/** A column every mart repeats: the cell has to stay one line. */
const DS_MANY = Array.from({ length: 9 }, (_, i) => ({
  id: `ds-mart-${i}`,
  name: `Mart ${i + 1} (${['orders', 'refunds', 'shipping', 'tax'][i % 4]})`,
  listing: SALES_LISTING,
}));

const OVERVIEW = { type: 'dashboard' as const, id: 'dash-overview', name: 'Sales overview' };
const REGION = { type: 'dashboard' as const, id: 'dash-region', name: 'Regional performance' };
const EXPLORE = { type: 'analysis' as const, id: 'ana-explore', name: 'Sales explorations' };
const GOLD = { type: 'dataset' as const, id: 'ds-sales-gold', name: 'Sales (gold)' };
const EXEC = { type: 'dataset' as const, id: 'ds-sales-exec', name: 'Sales for executives' };

export const KEYS = {
  margin: 'cf_margin000001',
  marginPctDataset: 'cf_marginpct001',
  marginPctDashboard: 'cf_marginpct002',
  marginPctExplore: 'cf_marginpct003',
  netRevenue: 'cf_netrevenue01',
  runway: 'cf_runway000001',
  attainment: 'cf_attainment01',
  orderMonth: 'cf_ordermonth01',
  landedCost: 'cf_landedcost1',
  marginRank: 'cf_marginrank1',
  marginBand: 'cf_marginband1',
};

const summary = (
  over: Partial<CalculatedFieldSummary> &
    Pick<CalculatedFieldSummary, 'key' | 'name' | 'expression'>
): CalculatedFieldSummary => ({
  dataType: 'DECIMAL',
  definedIn: [],
  datasets: [],
  references: [],
  usedBy: { dashboards: 0, analyses: 0, visuals: 0 },
  hasNote: false,
  ...over,
});

export const CALCULATED_FIELD_ITEMS: CalculatedFieldSummary[] = [
  summary({
    key: KEYS.margin,
    name: 'margin',
    expression: '{revenue} - {cost}',
    definedIn: [GOLD, EXEC, OVERVIEW],
    datasets: [DS_GOLD, DS_EXEC],
    references: ['revenue', 'cost'],
    usedBy: { dashboards: 3, analyses: 1, visuals: 7 },
    template: { id: 'tpl-margin' },
    hasNote: true,
  }),
  summary({
    key: KEYS.marginPctDataset,
    name: 'margin_pct',
    expression: 'ifelse({revenue} = 0, 0, ({revenue} - {cost}) / {revenue})',
    definedIn: [GOLD],
    datasets: [DS_GOLD],
    references: ['revenue', 'cost'],
    usedBy: { dashboards: 2, analyses: 1, visuals: 3 },
    conflict: { variants: 2 },
  }),
  summary({
    key: KEYS.marginPctDashboard,
    name: 'margin_pct',
    expression: '{margin} / {revenue}',
    definedIn: [OVERVIEW, REGION],
    datasets: [DS_GOLD],
    references: ['margin', 'revenue'],
    usedBy: { dashboards: 2, analyses: 0, visuals: 4 },
    conflict: { variants: 2 },
  }),
  summary({
    key: KEYS.marginPctExplore,
    name: 'margin_pct',
    expression: "ifelse({status} = 'closed', {margin} / {revenue}, null)",
    definedIn: [EXPLORE],
    datasets: [DS_GOLD],
    references: ['status', 'margin', 'revenue'],
    usedBy: { dashboards: 0, analyses: 1, visuals: 2 },
    conflict: { variants: 2 },
  }),
  summary({
    key: KEYS.netRevenue,
    name: 'net_revenue',
    expression: '{revenue} - {discount} - {returns}',
    definedIn: [GOLD],
    datasets: [DS_GOLD],
    references: ['revenue', 'discount', 'returns'],
    usedBy: { dashboards: 4, analyses: 2, visuals: 11 },
    template: { id: 'tpl-net-revenue' },
  }),
  summary({
    key: KEYS.attainment,
    name: 'attainment',
    expression: 'sum({revenue}) / sum({target_revenue})',
    definedIn: [REGION],
    datasets: [DS_TARGETS],
    references: ['revenue', 'target_revenue'],
    usedBy: { dashboards: 1, analyses: 0, visuals: 2 },
  }),
  summary({
    key: KEYS.orderMonth,
    name: 'order_month',
    dataType: 'DATETIME',
    expression: "truncDate('MM', {order_date})",
    definedIn: [GOLD],
    datasets: [DS_GOLD],
    references: ['order_date'],
    usedBy: { dashboards: 3, analyses: 2, visuals: 5 },
  }),
  summary({
    key: KEYS.runway,
    name: 'runway_months',
    expression: 'ifelse({burn} = 0, null, {cash} / {burn})',
    definedIn: [EXEC],
    datasets: [DS_EXEC],
    references: ['burn', 'cash'],
    usedBy: { dashboards: 0, analyses: 0, visuals: 0 },
  }),
];

export function calculatedFieldCatalog(
  params: { search?: string; conflictsOnly?: boolean; projectId?: string } = {}
): CalculatedFieldCatalog {
  const needle = params.search?.toLowerCase();
  const items = CALCULATED_FIELD_ITEMS.filter(
    (i) =>
      (!params.conflictsOnly || i.conflict) &&
      (!needle ||
        i.name.toLowerCase().includes(needle) ||
        i.expression.toLowerCase().includes(needle))
  );
  const names = new Set(items.map((i) => i.name));
  return {
    configured: true,
    exportedAt: EXPORTED_AT,
    projectFilter: ['proj-analytics-prod', 'proj-analytics-dev'],
    counts: {
      fields: items.length,
      names: names.size,
      conflicts: items.some((i) => i.conflict) ? 1 : 0,
      templated: items.filter((i) => i.template).length,
      unused: items.filter((i) => i.usedBy.dashboards + i.usedBy.analyses + i.usedBy.visuals === 0)
        .length,
      datasets: new Set(items.flatMap((i) => i.datasets.map((d) => d.id))).size,
      // Two fields in the fixture sit on datasets no listing claimed.
      outsideSmus: 2,
    },
    items,
  };
}

export const EMPTY_CALCULATED_FIELDS: CalculatedFieldCatalog = {
  configured: true,
  exportedAt: EXPORTED_AT,
  projectFilter: [],
  counts: {
    fields: 0,
    names: 0,
    conflicts: 0,
    templated: 0,
    unused: 0,
    datasets: 0,
    outsideSmus: 2,
  },
  items: [],
};

export const NO_EXPORT_CALCULATED_FIELDS: CalculatedFieldCatalog = {
  ...EMPTY_CALCULATED_FIELDS,
  exportedAt: null,
};

const SALES_LISTING_COLUMNS = 14;

const smusColumn = (
  columnName: string,
  description: string,
  glossaryTerms: string[] = [],
  columnType?: string
) => ({
  ...SALES_LISTING,
  columnName,
  ...(columnType ? { columnType } : {}),
  match: 'exact' as const,
  listingColumnCount: SALES_LISTING_COLUMNS,
  description,
  glossaryTerms,
});

/** The dataset is tied to the listing, but the listing's schema stops short of the column. */
const smusListingOnly = () => ({
  ...SALES_LISTING,
  match: 'listing-only' as const,
  listingColumnCount: SALES_LISTING_COLUMNS,
  glossaryTerms: [],
});

/** The listing publishes no column list at all, which is a different problem. */
const smusNoSchema = () => ({
  ...TARGETS_LISTING,
  match: 'no-schema' as const,
  listingColumnCount: 0,
  glossaryTerms: [],
});

const OVERVIEW_USE = {
  assetType: 'dashboard' as const,
  assetId: OVERVIEW.id,
  assetName: OVERVIEW.name,
};
const REGION_USE = { assetType: 'dashboard' as const, assetId: REGION.id, assetName: REGION.name };
const EXPLORE_USE = {
  assetType: 'analysis' as const,
  assetId: EXPLORE.id,
  assetName: EXPLORE.name,
};

const MARGIN_PCT_VARIANTS = [
  {
    key: KEYS.marginPctDataset,
    expression: 'ifelse({revenue} = 0, 0, ({revenue} - {cost}) / {revenue})',
    definedIn: [GOLD],
  },
  {
    key: KEYS.marginPctDashboard,
    expression: '{margin} / {revenue}',
    definedIn: [OVERVIEW, REGION],
  },
  {
    key: KEYS.marginPctExplore,
    expression: "ifelse({status} = 'closed', {margin} / {revenue}, null)",
    definedIn: [EXPLORE],
  },
];

const byKey = (key: string) =>
  CALCULATED_FIELD_ITEMS.find((i) => i.key === key) as CalculatedFieldSummary;

/** The details as authored; the dependency chain is derived from them below. */
const DETAIL_DRAFTS: Record<string, Omit<CalculatedFieldDetail, 'lineage'>> = {
  [KEYS.margin]: {
    ...byKey(KEYS.margin),
    variants: [
      { key: KEYS.margin, expression: '{revenue} - {cost}', definedIn: [GOLD, EXEC, OVERVIEW] },
    ],
    reads: [
      {
        name: 'revenue',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
        smus: smusColumn('revenue', 'Net sales after returns and discounts.', ['Revenue']),
      },
      {
        name: 'cost',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
        smus: smusColumn('cost', 'Landed cost of goods sold.'),
      },
    ],
    readBy: [
      {
        key: KEYS.marginPctDashboard,
        name: 'margin_pct',
        expression: '{margin} / {revenue}',
        definedIn: [OVERVIEW, REGION],
      },
      {
        key: KEYS.marginPctExplore,
        name: 'margin_pct',
        expression: "ifelse({status} = 'closed', {margin} / {revenue}, null)",
        definedIn: [EXPLORE],
      },
    ],
    usedIn: [OVERVIEW_USE, REGION_USE, EXPLORE_USE],
    visuals: [
      { ...OVERVIEW_USE, sheetName: 'Overview', visualId: 'v-kpi-margin', visualName: 'Margin' },
      { ...OVERVIEW_USE, sheetName: 'Overview', visualId: 'v-trend', visualName: 'Monthly trend' },
      {
        ...REGION_USE,
        sheetName: 'By region',
        visualId: 'v-bar-region',
        visualName: 'Margin by region',
      },
    ],
    portal: {
      description:
        'Gross margin before returns. Finance owns the definition; do not net out discounts here.',
      tags: ['finance', 'kpi'],
      category: 'Finance',
    },
  },
  [KEYS.marginPctDashboard]: {
    ...byKey(KEYS.marginPctDashboard),
    variants: MARGIN_PCT_VARIANTS,
    reads: [
      {
        name: 'margin',
        kind: 'calculated',
        key: KEYS.margin,
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
      },
      {
        name: 'revenue',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
        smus: smusColumn('revenue', 'Net sales after returns and discounts.', ['Revenue']),
      },
    ],
    readBy: [],
    usedIn: [OVERVIEW_USE, REGION_USE],
    visuals: [
      { ...OVERVIEW_USE, sheetName: 'Overview', visualId: 'v-kpi-pct', visualName: 'Margin %' },
      { ...REGION_USE, sheetName: 'By region', visualId: 'v-table', visualName: 'Region table' },
    ],
  },
  [KEYS.marginPctDataset]: {
    ...byKey(KEYS.marginPctDataset),
    variants: MARGIN_PCT_VARIANTS,
    reads: [
      {
        name: 'revenue',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
        smus: smusColumn('revenue', 'Net sales after returns and discounts.', ['Revenue']),
      },
      {
        name: 'cost',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
        smus: smusColumn('cost', 'Landed cost of goods sold.'),
      },
    ],
    readBy: [],
    usedIn: [OVERVIEW_USE, EXPLORE_USE],
    visuals: [],
  },
  [KEYS.marginPctExplore]: {
    ...byKey(KEYS.marginPctExplore),
    variants: MARGIN_PCT_VARIANTS,
    reads: [
      {
        name: 'status',
        kind: 'column',
        dataType: 'STRING',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
      },
      {
        name: 'margin',
        kind: 'calculated',
        key: KEYS.margin,
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
      },
      {
        name: 'revenue',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
        smus: smusColumn('revenue', 'Net sales after returns and discounts.', ['Revenue']),
      },
    ],
    readBy: [],
    usedIn: [EXPLORE_USE],
    visuals: [],
  },
  [KEYS.netRevenue]: {
    ...byKey(KEYS.netRevenue),
    variants: [
      { key: KEYS.netRevenue, expression: '{revenue} - {discount} - {returns}', definedIn: [GOLD] },
    ],
    reads: [
      {
        name: 'revenue',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
        smus: smusColumn('revenue', 'Net sales after returns and discounts.', ['Revenue']),
      },
      {
        name: 'discount',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
      },
      {
        name: 'returns',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_GOLD.id,
        datasetName: DS_GOLD.name,
      },
    ],
    readBy: [],
    usedIn: [OVERVIEW_USE, REGION_USE, EXPLORE_USE],
    visuals: [],
  },
  [KEYS.runway]: {
    ...byKey(KEYS.runway),
    variants: [
      {
        key: KEYS.runway,
        expression: 'ifelse({burn} = 0, null, {cash} / {burn})',
        definedIn: [EXEC],
      },
    ],
    reads: [
      {
        name: 'burn',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_EXEC.id,
        datasetName: DS_EXEC.name,
      },
      {
        name: 'cash',
        kind: 'column',
        dataType: 'DECIMAL',
        datasetId: DS_EXEC.id,
        datasetName: DS_EXEC.name,
      },
    ],
    readBy: [],
    usedIn: [],
    visuals: [],
  },
};

const MAX_FIXTURE_DEPTH = 4;

const readId = (read: LineageRead) =>
  read.key ? `cf:${read.key}` : `col:${read.datasetId ?? '-'}:${read.name.toLowerCase()}`;

const nodeOfDetail = (key: string, depth: number): FieldLineageNode => {
  const detail = DETAIL_DRAFTS[key];
  return {
    id: `cf:${key}`,
    name: detail?.name ?? key,
    kind: 'calculated',
    depth,
    key,
    expression: detail?.expression,
    dataType: detail?.dataType,
    usedBy: detail?.usedBy,
  };
};

const nodeOfRead = (read: LineageRead, depth: number): FieldLineageNode => ({
  id: readId(read),
  name: read.name,
  kind: read.kind,
  depth,
  dataType: read.dataType,
  datasetId: read.datasetId,
  datasetName: read.datasetName,
  smus: read.smus,
});

/**
 * The chain the endpoint would have walked, derived from the details already
 * written here so the fixture cannot drift from them: upstream through
 * `reads`, downstream through `readBy`, then the edges that join the two.
 */
function lineageFor(key: string): FieldLineage {
  const nodes = new Map<string, FieldLineageNode>([[`cf:${key}`, nodeOfDetail(key, 0)]]);
  const edges = new Map<string, { from: string; to: string }>();
  const link = (from: string, to: string) => {
    if (nodes.has(from) && nodes.has(to)) {
      edges.set(`${from}->${to}`, { from, to });
    }
  };

  let up = [key];
  for (let depth = 1; depth <= MAX_FIXTURE_DEPTH && up.length > 0; depth += 1) {
    const next: string[] = [];
    for (const current of up) {
      for (const read of DETAIL_DRAFTS[current]?.reads ?? []) {
        const id = readId(read);
        if (!nodes.has(id)) {
          nodes.set(id, read.key ? nodeOfDetail(read.key, -depth) : nodeOfRead(read, -depth));
          if (read.key) next.push(read.key);
        }
        link(id, `cf:${current}`);
      }
    }
    up = next;
  }

  let down = [key];
  for (let depth = 1; depth <= MAX_FIXTURE_DEPTH && down.length > 0; depth += 1) {
    const next: string[] = [];
    for (const current of down) {
      for (const reader of DETAIL_DRAFTS[current]?.readBy ?? []) {
        const id = `cf:${reader.key}`;
        if (!nodes.has(id)) {
          nodes.set(id, nodeOfDetail(reader.key, depth));
          next.push(reader.key);
        }
        link(`cf:${current}`, id);
      }
    }
    down = next;
  }

  for (const node of nodes.values()) {
    for (const read of (node.key && DETAIL_DRAFTS[node.key]?.reads) || []) {
      link(readId(read), node.id);
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()], truncated: false };
}

export const CALCULATED_FIELD_DETAILS: Record<string, CalculatedFieldDetail> = Object.fromEntries(
  Object.entries(DETAIL_DRAFTS).map(([key, detail]) => [
    key,
    { ...detail, lineage: lineageFor(key) },
  ])
);

const column = (
  over: Partial<ColumnCatalogItem> & Pick<ColumnCatalogItem, 'name'>
): ColumnCatalogItem => ({
  dataType: 'DECIMAL',
  datasets: [DS_GOLD],
  usedBy: { dashboards: 0, analyses: 0, visuals: 0 },
  usedByCalculated: [],
  ...over,
});

export const COLUMN_ITEMS: ColumnCatalogItem[] = [
  // A column the export could not type: QuickSight leaves OutputColumns.Type out.
  column({ name: 'geo_point', dataType: undefined, datasets: [DS_GOLD] }),
  // A listing that publishes no schema at all, not a column it lacks.
  column({
    name: 'fiscal_period',
    dataType: 'STRING',
    datasets: [DS_TARGETS],
    smus: smusNoSchema(),
    usedBy: { dashboards: 1, analyses: 0, visuals: 1 },
  }),
  // In every mart: the datasets cell collapses past the first couple. SMUS
  // spells the type its own way, which the row shows rather than hides.
  column({
    name: 'order_id',
    dataType: 'STRING',
    datasets: [DS_GOLD, DS_EXEC, ...DS_MANY],
    smus: smusColumn('order_id', 'Natural key of the order.', [], 'varchar'),
    usedBy: { dashboards: 9, analyses: 3, visuals: 31 },
  }),
  // Computed in the dataset, so the listing's schema never names it.
  column({
    name: 'tenure_days',
    dataType: 'INTEGER',
    smus: smusListingOnly(),
    usedBy: { dashboards: 1, analyses: 0, visuals: 2 },
  }),
  column({
    name: 'revenue',
    datasets: [DS_GOLD, DS_EXEC],
    smus: smusColumn('revenue', 'Net sales after returns and discounts.', ['Revenue']),
    usedBy: { dashboards: 4, analyses: 2, visuals: 14 },
    usedByCalculated: [
      { key: KEYS.margin, name: 'margin' },
      { key: KEYS.marginPctDataset, name: 'margin_pct' },
      { key: KEYS.netRevenue, name: 'net_revenue' },
    ],
  }),
  column({
    name: 'cost',
    smus: smusColumn('cost', 'Landed cost of goods sold.'),
    usedBy: { dashboards: 2, analyses: 1, visuals: 3 },
    usedByCalculated: [{ key: KEYS.margin, name: 'margin' }],
  }),
  column({
    name: 'order_date',
    dataType: 'DATETIME',
    smus: smusColumn('order_date', 'Date the order was placed, in UTC.'),
    usedBy: { dashboards: 4, analyses: 2, visuals: 9 },
    usedByCalculated: [{ key: KEYS.orderMonth, name: 'order_month' }],
  }),
  column({
    name: 'status',
    dataType: 'STRING',
    smus: smusColumn('status', 'Order lifecycle state: open, closed, cancelled.'),
    usedBy: { dashboards: 3, analyses: 2, visuals: 6 },
    usedByCalculated: [{ key: KEYS.marginPctExplore, name: 'margin_pct' }],
  }),
  column({
    name: 'customer_id',
    dataType: 'STRING',
    smus: { ...smusColumn('customer_id', 'Billing account identifier.', ['Customer', 'PII']) },
    usedBy: { dashboards: 1, analyses: 1, visuals: 2 },
  }),
  column({
    name: 'discount',
    usedBy: { dashboards: 1, analyses: 0, visuals: 1 },
    usedByCalculated: [{ key: KEYS.netRevenue, name: 'net_revenue' }],
  }),
  column({
    name: 'returns',
    usedBy: { dashboards: 1, analyses: 0, visuals: 1 },
    usedByCalculated: [{ key: KEYS.netRevenue, name: 'net_revenue' }],
  }),
  column({
    name: 'target_revenue',
    datasets: [DS_TARGETS],
    smus: {
      ...TARGETS_LISTING,
      columnName: 'target_revenue',
      match: 'exact' as const,
      listingColumnCount: 4,
      description: 'Quarterly revenue target per region.',
      glossaryTerms: [],
    },
    usedBy: { dashboards: 1, analyses: 0, visuals: 2 },
    usedByCalculated: [{ key: KEYS.attainment, name: 'attainment' }],
  }),
];

export function columnCatalog(params: { search?: string } = {}): ColumnCatalog {
  const needle = params.search?.toLowerCase();
  const items = COLUMN_ITEMS.filter((c) => !needle || c.name.toLowerCase().includes(needle));
  return {
    configured: true,
    exportedAt: EXPORTED_AT,
    counts: {
      columns: items.length,
      datasets: new Set(items.flatMap((c) => c.datasets.map((d) => d.id))).size,
      withSmus: items.filter((c) => c.smus).length,
      withSmusColumn: items.filter((c) => c.smus?.columnName).length,
      outsideSmus: items.filter((c) => !c.smus).length,
    },
    items,
  };
}

/** The three field-catalog endpoints, honouring search and conflictsOnly. */
export function fieldCatalogRoutes(
  options: { calculatedFields?: CalculatedFieldCatalog; columns?: ColumnCatalog } = {}
): MockRoute[] {
  return [
    {
      method: 'get',
      url: /\/data-catalog\/calculated-fields\/[^/?]+$/,
      respond: (config) => {
        const key = decodeURIComponent(String(config.url).split('/').pop() ?? '');
        const detail = CALCULATED_FIELD_DETAILS[key];
        return detail
          ? { body: { success: true, data: detail } }
          : { status: 404, body: { success: false, error: `No calculated field '${key}'` } };
      },
    },
    {
      method: 'get',
      url: /\/data-catalog\/calculated-fields$/,
      respond: (config) => {
        const p = (config.params ?? {}) as Record<string, string | undefined>;
        return {
          body: {
            success: true,
            data:
              options.calculatedFields ??
              calculatedFieldCatalog({
                search: p.search,
                conflictsOnly: p.conflictsOnly === 'true',
              }),
          },
        };
      },
    },
    {
      method: 'get',
      url: /\/data-catalog\/columns$/,
      respond: (config) => {
        const p = (config.params ?? {}) as Record<string, string | undefined>;
        return {
          body: { success: true, data: options.columns ?? columnCatalog({ search: p.search }) },
        };
      },
    },
  ];
}

const HEAVY_ASSETS = 24;
const HEAVY_VISUALS_PER_ASSET = 9;
const HEAVY_SHEETS = ['Overview', 'By region', 'Detail', 'Appendix'];

/**
 * The shape that broke the chip list: one field every mart repeats, read by
 * two dozen assets and a couple of hundred visuals. Stories use it to prove
 * the usage table still opens instantly and stays legible.
 */
export function heavyUsage(): { usedIn: FieldUsedIn[]; visuals: FieldVisualUsage[] } {
  const usedIn: FieldUsedIn[] = Array.from({ length: HEAVY_ASSETS }, (_, i) => ({
    assetType: i % 4 === 3 ? ('analysis' as const) : ('dashboard' as const),
    assetId: `asset-${i}`,
    assetName: `${i % 4 === 3 ? 'Exploration' : 'Regional performance'} ${i + 1}`,
  }));
  const visuals: FieldVisualUsage[] = usedIn.flatMap((asset, i) =>
    // One asset reads the field without the export naming a visual.
    i === 5
      ? []
      : Array.from({ length: HEAVY_VISUALS_PER_ASSET }, (_, v) => ({
          ...asset,
          sheetName: HEAVY_SHEETS[v % HEAVY_SHEETS.length] as string,
          visualId: `v-${i}-${v}`,
          visualName: `${['Margin KPI', 'Trend', 'By segment', 'Table'][v % 4]} ${v + 1}`,
        }))
  );
  return { usedIn, visuals };
}

const WIDE_SOURCES = 6;

/** A chain wide enough to need the barycentre ordering and a scroll. */
export const WIDE_CHAIN: FieldLineage = (() => {
  const sources: FieldLineageNode[] = Array.from({ length: WIDE_SOURCES }, (_, i) => ({
    id: `col:src-${i}`,
    name: ['revenue', 'cost', 'discount', 'returns', 'tax', 'shipping'][i] as string,
    kind: 'column',
    depth: -2,
    dataType: 'DECIMAL',
    datasetName: 'Sales (gold)',
    ...(i < 2
      ? {
          smus: smusColumn(
            ['revenue', 'cost'][i] as string,
            'From the governed table behind this dataset.'
          ),
        }
      : {}),
  }));
  const mids: FieldLineageNode[] = [
    {
      id: 'cf:net',
      name: 'net_revenue',
      kind: 'calculated',
      depth: -1,
      key: KEYS.netRevenue,
      expression: '{revenue} - {discount} - {returns}',
      usedBy: { dashboards: 4, analyses: 2, visuals: 11 },
    },
    {
      id: 'cf:landed',
      name: 'landed_cost',
      kind: 'calculated',
      depth: -1,
      key: KEYS.landedCost,
      expression: '{cost} + {tax} + {shipping}',
      usedBy: { dashboards: 1, analyses: 0, visuals: 2 },
    },
  ];
  const focus: FieldLineageNode = {
    id: `cf:${KEYS.margin}`,
    name: 'margin',
    kind: 'calculated',
    depth: 0,
    key: KEYS.margin,
    expression: '{net_revenue} - {landed_cost}',
    usedBy: { dashboards: 3, analyses: 1, visuals: 7 },
  };
  const readers: FieldLineageNode[] = [
    {
      id: `cf:${KEYS.marginPctDashboard}`,
      name: 'margin_pct',
      kind: 'calculated',
      depth: 1,
      key: KEYS.marginPctDashboard,
      expression: '{margin} / {revenue}',
      usedBy: { dashboards: 2, analyses: 0, visuals: 4 },
    },
    {
      id: 'cf:margin_rank',
      name: 'margin_rank',
      kind: 'calculated',
      depth: 1,
      key: KEYS.marginRank,
      expression: 'rank([{margin} DESC])',
      usedBy: { dashboards: 1, analyses: 1, visuals: 3 },
    },
    {
      id: 'cf:margin_band',
      name: 'margin_band',
      kind: 'calculated',
      depth: 2,
      key: KEYS.marginBand,
      expression: "ifelse({margin_pct} > 0.4, 'high', 'low')",
      usedBy: { dashboards: 2, analyses: 0, visuals: 2 },
    },
  ];
  return {
    nodes: [...sources, ...mids, focus, ...readers],
    edges: [
      { from: 'col:src-0', to: 'cf:net' },
      { from: 'col:src-2', to: 'cf:net' },
      { from: 'col:src-3', to: 'cf:net' },
      { from: 'col:src-1', to: 'cf:landed' },
      { from: 'col:src-4', to: 'cf:landed' },
      { from: 'col:src-5', to: 'cf:landed' },
      { from: 'cf:net', to: `cf:${KEYS.margin}` },
      { from: 'cf:landed', to: `cf:${KEYS.margin}` },
      { from: `cf:${KEYS.margin}`, to: `cf:${KEYS.marginPctDashboard}` },
      { from: `cf:${KEYS.margin}`, to: 'cf:margin_rank' },
      { from: 'col:src-0', to: `cf:${KEYS.marginPctDashboard}` },
      { from: `cf:${KEYS.marginPctDashboard}`, to: 'cf:margin_band' },
    ],
    truncated: true,
  };
})();
