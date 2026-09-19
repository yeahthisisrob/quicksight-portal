/**
 * Synthetic catalog data for stories and tests. Two projects, four published
 * assets, one of them read by two QuickSight datasets. Names are generic on
 * purpose.
 */
import type {
  CalculatedFieldTemplate,
  CatalogDataset,
  SmusCatalog,
  SmusCatalogAsset,
  SmusCatalogAssetSummary,
} from '@/shared/api/modules/data-catalog';

export const PROJECTS = [
  { id: 'proj-analytics-prod', name: 'analytics_prod', count: 3 },
  { id: 'proj-analytics-dev', name: 'analytics_dev', count: 1 },
];

const TERMS = {
  revenue: { name: 'Revenue', shortDescription: 'Net sales after returns and discounts.' },
  customer: { name: 'Customer', shortDescription: 'A billing account that has placed an order.' },
  pii: { name: 'PII', shortDescription: 'Contains personal data; access is governed.' },
};

const SMUS_URL = 'https://smus.example/catalog/assets';

export const SALES_SUMMARY: SmusCatalogAssetSummary = {
  listingId: 'lst-sales-gold',
  assetId: 'ast-sales-gold',
  name: 'sales_gold',
  description: 'Curated sales facts, one row per order line, refreshed nightly.',
  projectId: 'proj-analytics-prod',
  projectName: 'analytics_prod',
  url: `${SMUS_URL}/lst-sales-gold`,
  table: { catalog: 'AwsDataCatalog', database: 'published_sales', name: 'sales_gold' },
  glossaryTerms: [TERMS.revenue, TERMS.customer],
  columnCount: 9,
  datasets: [
    { id: 'ds-sales-gold', name: 'Sales (gold)', matchType: 'source-table' },
    { id: 'ds-sales-exec', name: 'Sales for executives', matchType: 'custom-sql' },
  ],
  calculatedFieldCount: 3,
  usage: { dashboards: 4, analyses: 2 },
  updatedAt: '2026-09-17T09:12:00Z',
};

export const CUSTOMER_SUMMARY: SmusCatalogAssetSummary = {
  listingId: 'lst-customer-dim',
  assetId: 'ast-customer-dim',
  name: 'customer_dim',
  description: 'One row per customer with their current segment.',
  projectId: 'proj-analytics-prod',
  projectName: 'analytics_prod',
  url: `${SMUS_URL}/lst-customer-dim`,
  table: { database: 'published_sales', name: 'customer_dim' },
  glossaryTerms: [TERMS.customer, TERMS.pii],
  columnCount: 6,
  datasets: [],
  calculatedFieldCount: 0,
  usage: { dashboards: 0, analyses: 0 },
};

export const TARGETS_SUMMARY: SmusCatalogAssetSummary = {
  listingId: 'lst-revenue-targets',
  assetId: 'ast-revenue-targets',
  name: 'revenue_targets',
  projectId: 'proj-analytics-prod',
  projectName: 'analytics_prod',
  table: { database: 'published_finance', name: 'revenue_targets' },
  glossaryTerms: [TERMS.revenue],
  columnCount: 4,
  datasets: [{ id: 'ds-targets', name: 'Targets', matchType: 'name' }],
  calculatedFieldCount: 1,
  usage: { dashboards: 1, analyses: 0 },
};

export const DEV_SUMMARY: SmusCatalogAssetSummary = {
  listingId: 'lst-sales-gold-dev',
  assetId: 'ast-sales-gold-dev',
  name: 'sales_gold',
  projectId: 'proj-analytics-dev',
  projectName: 'analytics_dev',
  table: { database: 'published_sales_dev', name: 'sales_gold' },
  glossaryTerms: [],
  columnCount: 9,
  datasets: [],
  calculatedFieldCount: 0,
  usage: { dashboards: 0, analyses: 0 },
};

export const ALL_SUMMARIES = [SALES_SUMMARY, CUSTOMER_SUMMARY, TARGETS_SUMMARY, DEV_SUMMARY];

const OVERVIEW = {
  assetType: 'dashboard' as const,
  assetId: 'd-overview',
  assetName: 'Sales overview',
};
const REGION = {
  assetType: 'dashboard' as const,
  assetId: 'd-region',
  assetName: 'Regional sales',
};
const EXPLORE = {
  assetType: 'analysis' as const,
  assetId: 'a-explore',
  assetName: 'Sales exploration',
};

const smusCol = (columnName: string, description?: string) => ({
  listingId: 'lst-sales-gold',
  columnName,
  description,
  url: `${SMUS_URL}/lst-sales-gold`,
});

export const SALES_GOLD_DATASET: CatalogDataset = {
  id: 'ds-sales-gold',
  name: 'Sales (gold)',
  matchType: 'source-table',
  importMode: 'SPICE',
  calculatedFieldCount: 2,
  fields: [
    {
      name: 'order_date',
      dataType: 'DATETIME',
      isCalculated: false,
      references: [],
      usedBy: ['margin_pct'],
      usage: { dashboards: 3, analyses: 1 },
      usedIn: [OVERVIEW, REGION, EXPLORE],
      visuals: [
        { ...OVERVIEW, sheetName: 'Overview', visualId: 'v-trend', visualName: 'Monthly trend' },
        { ...REGION, sheetName: 'Regions', visualId: 'v-map', visualName: 'Revenue by region' },
      ],
      smus: smusCol('order_date', 'When the order was placed, UTC.'),
    },
    {
      name: 'net_revenue',
      dataType: 'DECIMAL',
      isCalculated: false,
      references: [],
      usedBy: ['margin', 'margin_pct'],
      usage: { dashboards: 4, analyses: 2 },
      usedIn: [OVERVIEW, REGION, EXPLORE],
      visuals: [
        { ...OVERVIEW, sheetName: 'Overview', visualId: 'v-kpi', visualName: 'Revenue' },
        { ...OVERVIEW, sheetName: 'Overview', visualId: 'v-trend', visualName: 'Monthly trend' },
        { ...REGION, sheetName: 'Regions', visualId: 'v-map', visualName: 'Revenue by region' },
      ],
      smus: smusCol('net_revenue', 'Net of returns and discounts.'),
    },
    {
      name: 'cost',
      dataType: 'DECIMAL',
      isCalculated: false,
      references: [],
      usedBy: ['margin'],
      usage: { dashboards: 0, analyses: 0 },
      usedIn: [],
      smus: smusCol('cost'),
    },
    {
      name: 'margin',
      dataType: 'DECIMAL',
      isCalculated: true,
      expression: '{net_revenue} - {cost}',
      references: ['net_revenue', 'cost'],
      usedBy: ['margin_pct'],
      usage: { dashboards: 2, analyses: 1 },
      usedIn: [OVERVIEW, EXPLORE],
      visuals: [
        { ...OVERVIEW, sheetName: 'Overview', visualId: 'v-trend', visualName: 'Monthly trend' },
      ],
      portal: {
        description: 'Gross margin before allocations. Agreed with finance in Q2.',
        tags: ['finance-approved'],
      },
      template: { id: 'tpl-margin' },
    },
    {
      name: 'margin_pct',
      dataType: 'DECIMAL',
      isCalculated: true,
      expression: 'ifelse({net_revenue} = 0, 0, {margin} / {net_revenue})',
      references: ['net_revenue', 'margin'],
      usedBy: [],
      usage: { dashboards: 2, analyses: 1 },
      usedIn: [REGION, EXPLORE],
      visuals: [
        { ...REGION, sheetName: 'Regions', visualId: 'v-table', visualName: 'Top customers' },
      ],
      conflict: {
        count: 2,
        variants: [
          {
            expression: 'ifelse({net_revenue} = 0, 0, {margin} / {net_revenue})',
            sources: [REGION],
          },
          { expression: '{margin} / {net_revenue}', sources: [EXPLORE] },
        ],
      },
      portal: { sensitivity: 'internal' },
    },
    {
      name: 'customer_id',
      dataType: 'STRING',
      isCalculated: false,
      references: [],
      usedBy: [],
      usage: { dashboards: 1, analyses: 1 },
      usedIn: [OVERVIEW, EXPLORE],
      smus: smusCol('customer_id'),
    },
  ],
};

export const SALES_EXEC_DATASET: CatalogDataset = {
  id: 'ds-sales-exec',
  name: 'Sales for executives',
  matchType: 'custom-sql',
  importMode: 'DIRECT_QUERY',
  calculatedFieldCount: 1,
  fields: [
    {
      name: 'net_revenue',
      dataType: 'DECIMAL',
      isCalculated: false,
      references: [],
      usedBy: ['yoy_growth'],
      usage: { dashboards: 1, analyses: 0 },
      usedIn: [{ assetType: 'dashboard', assetId: 'd-exec', assetName: 'Executive summary' }],
      smus: smusCol('net_revenue', 'Net of returns and discounts.'),
    },
    {
      name: 'yoy_growth',
      dataType: 'DECIMAL',
      isCalculated: true,
      expression: 'percentDifference(sum({net_revenue}), [{order_date} ASC], 1, [])',
      references: ['net_revenue', 'order_date'],
      usedBy: [],
      usage: { dashboards: 1, analyses: 0 },
      usedIn: [{ assetType: 'dashboard', assetId: 'd-exec', assetName: 'Executive summary' }],
    },
  ],
};

export const SALES_ASSET: SmusCatalogAsset = {
  ...SALES_SUMMARY,
  forms: [
    {
      name: 'Data quality',
      fields: [
        { key: 'Freshness', value: 'Daily by 06:00 UTC' },
        { key: 'Completeness check', value: 'Passed' },
        { key: 'Row count', value: '12,480,301' },
        { key: 'Owner', value: 'Analytics platform' },
      ],
    },
    {
      name: 'Business context',
      fields: [
        { key: 'Grain', value: 'One row per order line' },
        { key: 'Source system', value: 'Order management' },
        { key: 'Retention', value: '7 years' },
      ],
    },
  ],
  columns: [
    { name: 'order_id', type: 'string', description: 'Order identifier from the order system.' },
    { name: 'order_date', type: 'timestamp', description: 'When the order was placed, UTC.' },
    { name: 'customer_id', type: 'string' },
    { name: 'region', type: 'string', description: 'Sales region at time of order.' },
    { name: 'channel', type: 'string' },
    { name: 'net_revenue', type: 'decimal(18,2)', description: 'Net of returns and discounts.' },
    { name: 'cost', type: 'decimal(18,2)' },
    { name: 'quantity', type: 'bigint' },
    { name: 'segment', type: 'string' },
  ],
  datasets: [SALES_GOLD_DATASET, SALES_EXEC_DATASET],
};

export const CUSTOMER_ASSET: SmusCatalogAsset = {
  ...CUSTOMER_SUMMARY,
  forms: [
    {
      name: 'Business context',
      fields: [
        { key: 'Grain', value: 'One row per customer' },
        { key: 'Contains PII', value: 'Yes' },
      ],
    },
  ],
  columns: [
    { name: 'customer_id', type: 'string' },
    { name: 'customer_name', type: 'string', description: 'Legal name. PII.' },
    { name: 'segment', type: 'string' },
    { name: 'signed_up', type: 'date' },
    { name: 'country', type: 'string' },
    { name: 'is_active', type: 'boolean' },
  ],
  datasets: [],
};

export const LONG_FORMS_ASSET: SmusCatalogAsset = {
  ...SALES_ASSET,
  forms: Array.from({ length: 6 }, (_, i) => ({
    name: `Form ${i + 1}`,
    fields: Array.from({ length: 8 }, (__, j) => ({
      key: `Field ${j + 1}`,
      value: `Value ${i + 1}.${j + 1}`,
    })),
  })),
};

export const TEMPLATES: CalculatedFieldTemplate[] = [
  {
    id: 'tpl-margin',
    name: 'margin',
    expression: '{net_revenue} - {cost}',
    dataType: 'DECIMAL',
    description: 'Gross margin before allocations.',
    tags: ['finance-approved'],
    source: {
      datasetId: 'ds-sales-gold',
      datasetName: 'Sales (gold)',
      listingId: 'lst-sales-gold',
    },
    createdBy: 'rob@example.com',
    createdAt: '2026-09-10T10:00:00Z',
    updatedAt: '2026-09-15T14:30:00Z',
  },
  {
    id: 'tpl-yoy',
    name: 'yoy_growth',
    expression: 'percentDifference(sum({net_revenue}), [{order_date} ASC], 1, [])',
    dataType: 'DECIMAL',
    description: 'Year over year growth of net revenue.',
    tags: [],
    createdAt: '2026-08-02T08:00:00Z',
    updatedAt: '2026-08-02T08:00:00Z',
  },
];

export function catalogFor(projectId?: string, search?: string, term?: string): SmusCatalog {
  const inProject = projectId
    ? ALL_SUMMARIES.filter((a) => a.projectId === projectId)
    : ALL_SUMMARIES;
  const needle = (search ?? '').toLowerCase();
  const assets = inProject
    .filter(
      (a) =>
        !needle ||
        a.name.includes(needle) ||
        (a.table && `${a.table.database}.${a.table.name}`.includes(needle))
    )
    .filter((a) => !term || a.glossaryTerms.some((t) => t.name === term));
  const termCounts = new Map<string, { name: string; shortDescription?: string; count: number }>();
  for (const a of inProject) {
    for (const t of a.glossaryTerms) {
      const e = termCounts.get(t.name);
      if (e) e.count += 1;
      else termCounts.set(t.name, { ...t, count: 1 });
    }
  }
  return {
    configured: true,
    projectFilter: PROJECTS.map((p) => p.id),
    projects: PROJECTS,
    glossaryTerms: [...termCounts.values()],
    assets,
  };
}

export const ASSETS_BY_ID: Record<string, SmusCatalogAsset> = {
  [SALES_ASSET.listingId]: SALES_ASSET,
  [CUSTOMER_ASSET.listingId]: CUSTOMER_ASSET,
  [TARGETS_SUMMARY.listingId]: {
    ...TARGETS_SUMMARY,
    forms: [],
    columns: [
      { name: 'fiscal_month', type: 'date' },
      { name: 'region', type: 'string' },
      { name: 'target_revenue', type: 'decimal(18,2)' },
      { name: 'target_margin', type: 'decimal(18,2)' },
    ],
    datasets: [
      {
        id: 'ds-targets',
        name: 'Targets',
        matchType: 'name',
        calculatedFieldCount: 1,
        fields: [
          {
            name: 'target_revenue',
            dataType: 'DECIMAL',
            isCalculated: false,
            references: [],
            usedBy: ['attainment'],
            usage: { dashboards: 1, analyses: 0 },
            usedIn: [OVERVIEW],
          },
          {
            name: 'attainment',
            dataType: 'DECIMAL',
            isCalculated: true,
            expression: 'sum({net_revenue}) / sum({target_revenue})',
            references: ['net_revenue', 'target_revenue'],
            usedBy: [],
            usage: { dashboards: 1, analyses: 0 },
            usedIn: [OVERVIEW],
          },
        ],
      },
    ],
  },
  [DEV_SUMMARY.listingId]: { ...DEV_SUMMARY, forms: [], columns: [], datasets: [] },
};
