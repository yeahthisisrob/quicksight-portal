/**
 * One made-up QuickSight account for the page stories: a retailer's
 * dashboards, analyses, datasets, data sources, folders, users and groups,
 * tied together the way a real account is (a dashboard uses datasets, a
 * dataset reads a data source, a folder grants a group).
 *
 * `createAccount()` builds a fresh, mutable copy and `accountRoutes(account)`
 * answers the list pages from it the way the server does: the paginated lists
 * honour search, sort and paging, a dataset's source can be repointed, and a
 * bulk delete moves assets into the archive. Everything here is invented.
 */
import type { components } from '@shared/generated/types';

import { type MockRequest, type MockRoute, requestBody } from './api';

type Schemas = components['schemas'];
type Tag = Schemas['Tag'];
type Permission = Schemas['Permission'];
type Relationship = Schemas['AssetRelationship'];
type FolderRef = Schemas['AssetFolderRef'];
type AssetKind = 'dashboard' | 'analysis' | 'dataset' | 'datasource';
type Plural =
  | 'dashboards'
  | 'analyses'
  | 'datasets'
  | 'datasources'
  | 'folders'
  | 'users'
  | 'groups';

const ACCOUNT_ID = '123456789012';
const REGION = 'us-east-1';
const DAY_MS = 86_400_000;
const MB = 1024 * 1024;

const arn = (kind: string, id: string) =>
  `arn:aws:quicksight:${REGION}:${ACCOUNT_ID}:${kind}/${id}`;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();
const dayKey = (n: number) => daysAgo(n).slice(0, 10);

/** A small seeded generator, so the account is the same on every load. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** A UUID-shaped id, stable for its seed. */
function uuid(seed: string): string {
  const next = seeded(seed);
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(next() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

interface Person {
  name: string;
  role: 'ADMIN' | 'AUTHOR' | 'READER';
  groups: string[];
  activities: number;
  lastActiveDays: number | null;
}

/** Rows of a `a | b | c` table, as trimmed cells; a missing trailing cell is ''. */
const table = (rows: string) =>
  rows
    .trim()
    .split('\n')
    .map((row) => [...row.split('|').map((cell) => cell.trim()), '', ''] as Cells);

/** Up to twelve cells a row; the tables below name them as they destructure. */
type Cell = string;
type Cells = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

/** A days-ago cell; `-` means it never happened. */
const days = (cell: string): number | null => (cell === '-' || cell === '' ? null : Number(cell));

/** name | role | groups | activities | last active */
const PEOPLE: Person[] = table(`
  maya.chen     | ADMIN  | analytics-admins                  | 1840 | 0
  liam.ortega   | AUTHOR | analytics-admins sales-leadership | 1312 | 0
  priya.nair    | AUTHOR | supply-chain                      | 964  | 1
  noah.fischer  | AUTHOR | finance-readers                   | 688  | 2
  elena.rossi   | READER | sales-leadership                  | 1521 | 0
  sam.okafor    | READER | store-managers                    | 1203 | 0
  hana.sato     | READER | store-managers                    | 877  | 1
  diego.alvarez | READER | store-managers supply-chain       | 742  | 3
  olivia.berg   | AUTHOR | marketing                         | 536  | 1
  tariq.haddad  | READER | marketing                         | 318  | 6
  ines.moreau   | READER | finance-readers                   | 254  | 4
  jonas.lind    | READER | supply-chain                      | 131  | 12
  amara.diallo  | READER | sales-leadership                  | 47   | 38
  wei.zhang     | READER |                                   | 0    | -
`).map(([name, role, groups, activities, lastActive]) => ({
  name,
  role: role as Person['role'],
  groups: groups.split(' ').filter(Boolean),
  activities: Number(activities),
  lastActiveDays: days(lastActive),
}));

const emailOf = (name: string) => `${name}@example.com`;

const GROUPS = [
  {
    name: 'analytics-admins',
    description: 'Owns the account: data sources, shared folders and releases',
  },
  { name: 'sales-leadership', description: 'Regional and national sales leads' },
  { name: 'store-managers', description: 'Store and district managers' },
  { name: 'supply-chain', description: 'Inventory, replenishment and logistics' },
  {
    name: 'finance-readers',
    description: 'Finance partners with read access to the close dashboards',
  },
  { name: 'marketing', description: 'Campaigns, loyalty and e-commerce' },
];

const userArn = (name: string) => arn('user', `default/${name}`);
const groupArn = (name: string) => arn('group', `default/${name}`);

// ---------------------------------------------------------------------------
// Folders, data sources, datasets, analyses, dashboards (the seeds)
// ---------------------------------------------------------------------------

const FOLDERS = [
  { key: 'executive', name: 'Executive', group: 'sales-leadership', createdDays: 700 },
  { key: 'sales', name: 'Sales', group: 'sales-leadership', createdDays: 680 },
  { key: 'store-ops', name: 'Store operations', group: 'store-managers', createdDays: 655 },
  { key: 'supply', name: 'Supply chain', group: 'supply-chain', createdDays: 610 },
  { key: 'finance', name: 'Finance', group: 'finance-readers', createdDays: 590 },
  { key: 'marketing', name: 'Marketing', group: 'marketing', createdDays: 505 },
  { key: 'sandbox', name: 'Sandbox', group: 'analytics-admins', createdDays: 420 },
] as const;
type FolderKey = (typeof FOLDERS)[number]['key'];

interface SourceSeed {
  id: string;
  name: string;
  type: string;
  createdDays: number;
  modifiedDays: number;
  owner: string;
  parameters: Record<string, unknown>;
}

const SOURCES: SourceSeed[] = [
  {
    id: 'athena-lakehouse',
    name: 'Lakehouse (Athena)',
    type: 'ATHENA',
    createdDays: 720,
    modifiedDays: 96,
    owner: 'maya.chen',
    parameters: { AthenaParameters: { WorkGroup: 'analytics-prod' } },
  },
  {
    id: 'redshift-warehouse',
    name: 'Retail warehouse (Redshift)',
    type: 'REDSHIFT',
    createdDays: 705,
    modifiedDays: 41,
    owner: 'maya.chen',
    parameters: {
      RedshiftParameters: {
        Host: 'retail-warehouse.example.com',
        Port: 5439,
        Database: 'retail',
        ClusterId: 'retail-warehouse',
      },
    },
  },
  {
    id: 'aurora-store-systems',
    name: 'Store systems (Aurora PostgreSQL)',
    type: 'AURORA_POSTGRESQL',
    createdDays: 540,
    modifiedDays: 187,
    owner: 'priya.nair',
    parameters: {
      AuroraPostgreSqlParameters: {
        Host: 'store-systems.example.com',
        Port: 5432,
        Database: 'stores',
      },
    },
  },
  {
    id: 'snowflake-marketing',
    name: 'Marketing cloud (Snowflake)',
    type: 'SNOWFLAKE',
    createdDays: 388,
    modifiedDays: 73,
    owner: 'olivia.berg',
    parameters: {
      SnowflakeParameters: {
        Host: 'marketing.example.com',
        Database: 'MARKETING',
        Warehouse: 'REPORTING_WH',
      },
    },
  },
  {
    id: 's3-uploads',
    name: 'Planning uploads (S3)',
    type: 'S3',
    createdDays: 466,
    modifiedDays: 302,
    owner: 'liam.ortega',
    parameters: {
      S3Parameters: {
        ManifestFileLocation: {
          Bucket: 'example-planning-uploads',
          Key: 'manifests/planning.json',
        },
      },
    },
  },
  {
    id: 'athena-sandbox',
    name: 'Sandbox (Athena)',
    type: 'ATHENA',
    createdDays: 251,
    modifiedDays: 251,
    owner: 'liam.ortega',
    parameters: { AthenaParameters: { WorkGroup: 'analytics-sandbox' } },
  },
];

interface DatasetSeed {
  name: string;
  source: string;
  schema: string;
  spice: boolean;
  /** SPICE size in MB. */
  sizeMb: number;
  fields: number;
  createdDays: number;
  modifiedDays: number;
  owner: string;
  folder: FolderKey;
  /** 'daily' | 'hourly' | 'weekly' | none */
  refresh?: 'daily' | 'hourly' | 'weekly';
  /** Refresh error rows over the last 30 days. */
  errorRows?: number;
  sql?: string;
}

const ORDERS_SILVER_SQL = `SELECT o.order_id,
       o.store_id,
       o.ordered_at,
       SUM(l.net_amount) AS net_sales
FROM sales_silver.orders o
JOIN sales_silver.order_lines l
  ON l.order_id = o.order_id
GROUP BY 1, 2, 3`;

/** name | data source | schema | mode | SPICE MB | fields | created | modified | owner | folder | refresh | error rows */
const DATASETS: DatasetSeed[] = table(`
  orders_gold         | athena-lakehouse     | sales_gold   | SPICE  | 4320 | 42 | 640 | 1   | maya.chen    | sales     | hourly |
  customers_gold      | athena-lakehouse     | sales_gold   | SPICE  | 1180 | 28 | 630 | 6   | maya.chen    | sales     | daily  |
  store_ops_daily     | athena-lakehouse     | ops_gold     | SPICE  | 860  | 36 | 588 | 2   | priya.nair   | store-ops | daily  |
  web_sessions        | athena-lakehouse     | web_gold     | SPICE  | 6144 | 31 | 402 | 9   | olivia.berg  | marketing | daily  | 214
  returns_gold        | athena-lakehouse     | sales_gold   | SPICE  | 310  | 19 | 371 | 24  | noah.fischer | finance   | daily  |
  products_dim        | redshift-warehouse   | dim          | SPICE  | 96   | 24 | 660 | 33  | maya.chen    | sales     | weekly |
  stores_dim          | redshift-warehouse   | dim          | SPICE  | 12   | 17 | 660 | 58  | maya.chen    | store-ops | weekly |
  suppliers_dim       | redshift-warehouse   | dim          | SPICE  | 8    | 14 | 512 | 120 | priya.nair   | supply    | weekly |
  inventory_snapshot  | redshift-warehouse   | supply       | SPICE  | 2260 | 22 | 575 | 3   | priya.nair   | supply    | daily  |
  shipments           | redshift-warehouse   | supply       | SPICE  | 1490 | 26 | 498 | 11  | priya.nair   | supply    | daily  | 37
  finance_gl_summary  | redshift-warehouse   | finance      | SPICE  | 540  | 33 | 560 | 17  | noah.fischer | finance   | daily  |
  labor_hours         | aurora-store-systems | workforce    | SPICE  | 720  | 18 | 455 | 5   | priya.nair   | store-ops | daily  |
  store_traffic_live  | aurora-store-systems | sensors      | DIRECT | 0    | 11 | 296 | 44  | priya.nair   | store-ops |        |
  orders_live         | aurora-store-systems | orders       | DIRECT | 0    | 23 | 233 | 81  | liam.ortega  | store-ops |        |
  marketing_spend     | snowflake-marketing  | CAMPAIGNS    | SPICE  | 184  | 21 | 380 | 14  | olivia.berg  | marketing | daily  |
  loyalty_members     | snowflake-marketing  | LOYALTY      | SPICE  | 930  | 27 | 352 | 20  | olivia.berg  | marketing | daily  |
  promotions_calendar | s3-uploads           |              | SPICE  | 3    | 9  | 441 | 302 | olivia.berg  | marketing |        |
  kiosk_pilot_upload  | s3-uploads           |              | SPICE  | 1    | 7  | 530 | 524 | liam.ortega  | sandbox   |        |
  orders_silver       | athena-sandbox       | sales_silver | SPICE  | 3890 | 39 | 712 | 418 | liam.ortega  | sandbox   |        | 1289
`).map(
  ([
    name,
    source,
    schema,
    mode,
    sizeMb,
    fields,
    created,
    modified,
    owner,
    folder,
    refresh,
    errorRows,
  ]) => ({
    name,
    source,
    schema,
    spice: mode === 'SPICE',
    sizeMb: Number(sizeMb),
    fields: Number(fields),
    createdDays: Number(created),
    modifiedDays: Number(modified),
    owner,
    folder: folder as FolderKey,
    refresh: (refresh || undefined) as DatasetSeed['refresh'],
    errorRows: Number(errorRows) || 0,
    sql: name === 'orders_silver' ? ORDERS_SILVER_SQL : undefined,
  })
);

interface ReportSeed {
  name: string;
  folder: FolderKey;
  datasets: string[];
  views: number;
  viewers: number;
  /** Days since the last view; null when nobody ever opened it. */
  lastViewedDays: number | null;
  modifiedDays: number;
  createdDays: number;
  sheets: number;
  visuals: number;
  owner: string;
  errors?: number;
  tier?: 'gold' | 'silver';
  /** Whether an analysis of the same name sits behind the dashboard. */
  analysis?: boolean;
}

/** name | folder | datasets | views | viewers | last viewed | modified | created | sheets | visuals | owner | flags */
const reports = (rows: string): ReportSeed[] =>
  table(rows).map(
    ([
      name,
      folder,
      datasets,
      views,
      viewers,
      viewed,
      modified,
      created,
      sheets,
      visuals,
      owner,
      flags,
    ]) => ({
      name,
      folder: folder as FolderKey,
      datasets: datasets.split(' '),
      views: Number(views),
      viewers: Number(viewers),
      lastViewedDays: days(viewed),
      modifiedDays: Number(modified),
      createdDays: Number(created),
      sheets: Number(sheets),
      visuals: Number(visuals),
      owner,
      errors: Number(flags.match(/errors:(\d+)/)?.[1] ?? 0),
      tier: flags.includes('gold') ? 'gold' : undefined,
      analysis: flags.includes('analysis'),
    })
  );

const DASHBOARDS = reports(`
  Sales overview             | executive | orders_gold customers_gold       | 18420 | 312 | 0  | 2   | 640 | 5 | 34 | liam.ortega  | gold analysis
  Store operations daily     | store-ops | store_ops_daily labor_hours      | 12960 | 248 | 0  | 1   | 588 | 4 | 27 | priya.nair   | gold analysis
  Executive weekly scorecard | executive | orders_gold finance_gl_summary   | 9310  | 96  | 0  | 6   | 552 | 3 | 18 | liam.ortega  | gold analysis
  Inventory aging            | supply    | inventory_snapshot products_dim  | 7480  | 134 | 0  | 9   | 571 | 4 | 22 | priya.nair   | gold analysis
  E-commerce funnel          | marketing | web_sessions orders_gold         | 6125  | 88  | 0  | 4   | 398 | 3 | 19 | olivia.berg  | gold analysis
  Regional sales performance | sales     | orders_gold stores_dim           | 5240  | 121 | 1  | 13  | 610 | 6 | 41 | liam.ortega  | gold analysis
  Promotions effectiveness   | marketing | promotions_calendar orders_gold  | 3980  | 64  | 1  | 21  | 436 | 3 | 16 | olivia.berg  | analysis
  Customer loyalty           | marketing | loyalty_members customers_gold   | 3150  | 57  | 0  | 18  | 349 | 4 | 23 | olivia.berg  | analysis
  On-time delivery           | supply    | shipments suppliers_dim          | 2870  | 49  | 1  | 27  | 495 | 3 | 15 | priya.nair   | analysis
  Returns and refunds        | finance   | returns_gold orders_gold         | 2210  | 41  | 2  | 35  | 368 | 2 | 12 | noah.fischer | analysis
  Labor scheduling           | store-ops | labor_hours stores_dim           | 1840  | 73  | 0  | 8   | 451 | 3 | 14 | priya.nair   | analysis
  Margin by category         | finance   | finance_gl_summary products_dim  | 1490  | 28  | 3  | 52  | 540 | 4 | 20 | noah.fischer | analysis
  Store traffic heatmap      | store-ops | store_traffic_live stores_dim    | 1120  | 36  | 1  | 44  | 290 | 2 | 9  | priya.nair   |
  Marketing attribution      | marketing | marketing_spend web_sessions     | 860   | 19  | 4  | 66  | 377 | 3 | 17 | olivia.berg  |
  Supplier scorecard         | supply    | suppliers_dim shipments          | 640   | 17  | 6  | 93  | 470 | 2 | 11 | priya.nair   |
  Price elasticity           | sales     | orders_gold products_dim         | 412   | 9   | 9  | 128 | 322 | 2 | 8  | liam.ortega  |
  Shrink and loss prevention | store-ops | inventory_snapshot stores_dim    | 288   | 12  | 5  | 141 | 415 | 3 | 13 | priya.nair   |
  Gift card liability        | finance   | finance_gl_summary               | 143   | 6   | 16 | 203 | 487 | 1 | 6  | noah.fischer |
  New store openings         | executive | stores_dim orders_gold           | 96    | 8   | 22 | 176 | 260 | 2 | 10 | liam.ortega  |
  Click and collect SLA      | store-ops | orders_live                      | 58    | 5   | 31 | 81  | 230 | 2 | 7  | liam.ortega  | errors:2
  Holiday promo recap        | marketing | promotions_calendar orders_silver | 0    | 0   | -  | 402 | 441 | 2 | 9  | olivia.berg  |
  Kiosk pilot results        | sandbox   | kiosk_pilot_upload               | 0     | 0   | -  | 524 | 530 | 1 | 4  | liam.ortega  |
  Regional scorecard (old)   | sandbox   | orders_silver                    | 0     | 0   | -  | 688 | 712 | 3 | 15 | liam.ortega  | errors:3
  Copy of Sales overview     | sandbox   | orders_gold customers_gold       | 0     | 0   | -  | 297 | 297 | 5 | 34 | amara.diallo |
`);

/** Analyses nobody published: explorations and leftovers. */
const LOOSE_ANALYSES = reports(`
  Basket size exploration    | sales     | orders_gold products_dim         | 214   | 3   | 2  | 2   | 64  | 3 | 12 | liam.ortega  |
  Weather vs store traffic   | store-ops | store_traffic_live stores_dim    | 71    | 2   | 19 | 19  | 112 | 2 | 6  | priya.nair   |
  Pricing test, autumn range | sales     | orders_gold                      | 38    | 2   | 47 | 47  | 139 | 1 | 5  | liam.ortega  |
  Untitled analysis          | sandbox   | orders_silver                    | 0     | 0   | -  | 365 | 365 | 1 | 1  | amara.diallo | errors:1
`);

// ---------------------------------------------------------------------------
// The account
// ---------------------------------------------------------------------------

/** A row of any list. The lists are heterogeneous, so rows are open records. */
type Row = Record<string, any> & { id: string; name: string; type: string };

interface PhysicalTable {
  id: string;
  kind: 'RELATIONAL' | 'CUSTOM_SQL' | 'S3';
  dataSourceArn: string;
  name: string;
  catalog?: string;
  schema?: string;
  sqlQuery?: string;
  columnCount: number;
  editable: boolean;
}

export interface Account {
  dashboards: Row[];
  analyses: Row[];
  datasets: Row[];
  datasources: Row[];
  folders: Row[];
  users: Row[];
  groups: Row[];
  archived: Row[];
  /** Each dataset's physical tables, by dataset id. */
  tables: Record<string, PhysicalTable[]>;
}

const LIST_OF: Record<AssetKind, 'dashboards' | 'analyses' | 'datasets' | 'datasources'> = {
  dashboard: 'dashboards',
  analysis: 'analyses',
  dataset: 'datasets',
  datasource: 'datasources',
};

const READ_ACTIONS: Record<AssetKind, string[]> = {
  dashboard: [
    'quicksight:DescribeDashboard',
    'quicksight:QueryDashboard',
    'quicksight:ListDashboardVersions',
  ],
  analysis: ['quicksight:DescribeAnalysis', 'quicksight:QueryAnalysis'],
  dataset: ['quicksight:DescribeDataSet', 'quicksight:PassDataSet', 'quicksight:DescribeIngestion'],
  datasource: ['quicksight:DescribeDataSource', 'quicksight:PassDataSource'],
};
const OWNER_ACTIONS: Record<AssetKind, string[]> = {
  dashboard: [
    ...READ_ACTIONS.dashboard,
    'quicksight:UpdateDashboard',
    'quicksight:DeleteDashboard',
    'quicksight:UpdateDashboardPermissions',
  ],
  analysis: [
    ...READ_ACTIONS.analysis,
    'quicksight:UpdateAnalysis',
    'quicksight:DeleteAnalysis',
    'quicksight:UpdateAnalysisPermissions',
  ],
  dataset: [
    ...READ_ACTIONS.dataset,
    'quicksight:UpdateDataSet',
    'quicksight:DeleteDataSet',
    'quicksight:UpdateDataSetPermissions',
  ],
  datasource: [
    ...READ_ACTIONS.datasource,
    'quicksight:UpdateDataSource',
    'quicksight:DeleteDataSource',
    'quicksight:UpdateDataSourcePermissions',
  ],
};

const TEAM_OF: Record<FolderKey, string> = {
  executive: 'Leadership',
  sales: 'Sales',
  'store-ops': 'Store operations',
  supply: 'Supply chain',
  finance: 'Finance',
  marketing: 'Marketing',
  sandbox: 'Analytics',
};

const folderRef = (key: FolderKey): FolderRef => {
  const folder = FOLDERS.find((f) => f.key === key);
  return { id: `folder-${key}`, name: folder?.name ?? key, path: `/${folder?.name ?? key}` };
};

function permissionsFor(
  kind: AssetKind,
  owner: string,
  folder: FolderKey,
  wide: boolean
): Permission[] {
  const group = FOLDERS.find((f) => f.key === folder)?.group ?? 'analytics-admins';
  const permissions: Permission[] = [
    { principal: userArn(owner), principalType: 'USER', actions: OWNER_ACTIONS[kind] },
    {
      principal: groupArn('analytics-admins'),
      principalType: 'GROUP',
      actions: OWNER_ACTIONS[kind],
    },
  ];
  if (group !== 'analytics-admins') {
    permissions.push({
      principal: groupArn(group),
      principalType: 'GROUP',
      actions: READ_ACTIONS[kind],
    });
  }
  if (wide) {
    permissions.push({
      principal: groupArn('store-managers'),
      principalType: 'GROUP',
      actions: READ_ACTIONS[kind],
    });
    permissions.push({
      principal: userArn('elena.rossi'),
      principalType: 'USER',
      actions: READ_ACTIONS[kind],
    });
  }
  return permissions.filter((p, i, all) => all.findIndex((q) => q.principal === p.principal) === i);
}

function tagsFor(folder: FolderKey, tier?: string, stale?: boolean): Tag[] {
  const tags: Tag[] = [{ key: 'team', value: TEAM_OF[folder] }];
  if (tier) tags.push({ key: 'tier', value: tier });
  if (folder === 'finance') tags.push({ key: 'data-class', value: 'confidential' });
  if (stale) tags.push({ key: 'review', value: 'retire?' });
  return tags;
}

const definitionErrors = (count: number, dataset: string) =>
  Array.from({ length: count }, (_, i) => ({
    type: i === 0 ? 'COLUMN_REPLACEMENT_MISSING' : 'COLUMN_TYPE_MISMATCH',
    message:
      i === 0
        ? `The column "net_sales" is missing from the dataset ${dataset}.`
        : `The column "ordered_at" in ${dataset} changed type from DATETIME to STRING.`,
    violatedEntities: [{ path: `sheet/${i + 1}/visual/${i + 2}/field/net_sales` }],
  }));

const base = (
  kind: string,
  id: string,
  name: string,
  createdDays: number,
  modifiedDays: number
) => ({
  id,
  arn: arn(kind, id),
  name,
  type: kind,
  status: 'active',
  createdTime: daysAgo(createdDays),
  lastUpdatedTime: daysAgo(modifiedDays),
  lastExportTime: daysAgo(0),
  enrichmentStatus: 'enriched',
});

const REFRESH = {
  daily: { interval: 'DAILY', timeOfTheDay: '05:30' },
  hourly: { interval: 'HOURLY' },
  weekly: { interval: 'WEEKLY', timeOfTheDay: '04:00', refreshOnDay: { dayOfWeek: 'SUNDAY' } },
};

function report(
  kind: 'dashboard' | 'analysis',
  seed: ReportSeed,
  datasetIds: Map<string, string>
): Row {
  const id = uuid(`${kind}:${seed.name}`);
  const stale = seed.views === 0;
  return {
    ...base(kind, id, seed.name, seed.createdDays, seed.modifiedDays),
    ...(kind === 'dashboard'
      ? { dashboardStatus: 'CREATION_SUCCESSFUL', publishedVersionNumber: 3 + (seed.visuals % 19) }
      : { analysisStatus: 'CREATION_SUCCESSFUL' }),
    sheetCount: seed.sheets,
    visualCount: seed.visuals,
    datasetCount: seed.datasets.length,
    activity: {
      totalViews: seed.views,
      uniqueViewers: seed.viewers,
      lastViewed: seed.lastViewedDays === null ? null : daysAgo(seed.lastViewedDays),
    },
    definitionErrors: seed.errors ? definitionErrors(seed.errors, seed.datasets[0] ?? '') : [],
    tags: tagsFor(seed.folder, seed.tier, stale),
    permissions: permissionsFor(kind, seed.owner, seed.folder, seed.views > 5000),
    folders: [folderRef(seed.folder)],
    folderCount: 1,
    _datasets: seed.datasets.map((name) => datasetIds.get(name)).filter(Boolean),
    _owner: seed.owner,
  };
}

/** Build a fresh copy of the account. Mutate it freely: each story mount gets its own. */
export function createAccount(): Account {
  const datasources: Row[] = SOURCES.map((s) => ({
    ...base('datasource', s.id, s.name, s.createdDays, s.modifiedDays),
    sourceType: s.type,
    connectionMode: s.type === 'S3' ? 'IMPORT' : 'DIRECT_QUERY',
    datasourceStatus: 'CREATION_SUCCESSFUL',
    dataSourceParameters: s.parameters,
    tags: [
      { key: 'team', value: 'Analytics' },
      { key: 'env', value: s.id.includes('sandbox') ? 'sandbox' : 'prod' },
    ],
    permissions: permissionsFor('datasource', s.owner, 'sandbox', false),
    folders: [],
    folderCount: 0,
    _owner: s.owner,
  }));

  const tables: Record<string, PhysicalTable[]> = {};
  const datasetIds = new Map<string, string>();
  const datasets: Row[] = DATASETS.map((d) => {
    const id = uuid(`dataset:${d.name}`);
    datasetIds.set(d.name, id);
    const source = SOURCES.find((s) => s.id === d.source);
    const kind = source?.type === 'S3' ? 'S3' : d.sql ? 'CUSTOM_SQL' : 'RELATIONAL';
    tables[id] = [
      {
        id: uuid(`table:${d.name}`),
        kind,
        dataSourceArn: arn('datasource', d.source),
        name: d.name.replace(/_(gold|silver)$/, ''),
        ...(kind === 'RELATIONAL' && {
          catalog: source?.type === 'ATHENA' ? 'AwsDataCatalog' : '',
          schema: d.schema,
        }),
        ...(kind === 'CUSTOM_SQL' && { sqlQuery: d.sql }),
        columnCount: d.fields,
        editable: kind !== 'S3',
      },
    ];
    return {
      ...base('dataset', id, d.name, d.createdDays, d.modifiedDays),
      importMode: d.spice ? 'SPICE' : 'DIRECT_QUERY',
      experience: d.modifiedDays > 300 ? 'legacy' : 'dataPrep',
      fieldCount: d.fields,
      sizeInBytes: d.sizeMb * MB,
      sourceType: source?.type,
      schemas: d.schema ? [d.schema] : [],
      sharesTablesWith: d.name.startsWith('orders_') ? 1 : kind === 'S3' ? null : 0,
      refreshSchedules: d.refresh
        ? [
            {
              scheduleId: `${d.name}-${d.refresh}`,
              refreshType: 'FULL_REFRESH',
              scheduleFrequency: REFRESH[d.refresh],
            },
          ]
        : [],
      refreshScheduleCount: d.refresh ? 1 : 0,
      dataSetRefreshProperties:
        d.refresh && d.sizeMb > 500
          ? { failureConfiguration: { emailAlert: { alertStatus: 'ENABLED' } } }
          : undefined,
      tags: tagsFor(d.folder, d.name.endsWith('_gold') ? 'gold' : undefined, d.modifiedDays > 400),
      permissions: permissionsFor('dataset', d.owner, d.folder, d.name === 'orders_gold'),
      folders: [folderRef(d.folder)],
      folderCount: 1,
      _source: d.source,
      _refresh: d.refresh,
      _errorRows: d.errorRows ?? 0,
      _owner: d.owner,
    };
  });

  const dashboards = DASHBOARDS.map((seed) => report('dashboard', seed, datasetIds));
  const analyses = [...DASHBOARDS.filter((d) => d.analysis), ...LOOSE_ANALYSES].map((seed) =>
    report(
      'analysis',
      {
        ...seed,
        // An analysis is opened by its authors, far less than its dashboard.
        views: seed.analysis ? Math.round(seed.views / 40) : seed.views,
        viewers: seed.analysis
          ? Math.min(4, Math.max(1, Math.round(seed.viewers / 60)))
          : seed.viewers,
        modifiedDays: Math.max(0, seed.modifiedDays - (seed.analysis ? 1 : 0)),
      },
      datasetIds
    )
  );
  for (const analysis of analyses) {
    analysis._dashboard = dashboards.find((d) => d.name === analysis.name)?.id;
  }

  const folders: Row[] = FOLDERS.map((f) => ({
    ...base('folder', `folder-${f.key}`, f.name, f.createdDays, Math.round(f.createdDays / 9)),
    path: `/${f.name}`,
    memberCount: 0,
    tags: [{ key: 'team', value: TEAM_OF[f.key] }],
    permissions: [
      {
        principal: groupArn('analytics-admins'),
        principalType: 'GROUP',
        actions: ['quicksight:DescribeFolder', 'quicksight:UpdateFolder'],
      },
      {
        principal: groupArn(f.group),
        principalType: 'GROUP',
        actions: ['quicksight:DescribeFolder'],
      },
    ].filter((p, i, all) => all.findIndex((q) => q.principal === p.principal) === i),
  }));

  const users: Row[] = PEOPLE.map((p, i) => ({
    ...base('user', p.name, p.name, 700 - i * 37, 30),
    arn: userArn(p.name),
    email: emailOf(p.name),
    role: p.role,
    active: p.lastActiveDays !== null && p.lastActiveDays < 30,
    groups: p.groups,
    groupCount: p.groups.length,
    assetAccessCount: p.role === 'ADMIN' ? 64 : 6 + p.groups.length * 9,
    activity: {
      totalActivities: p.activities,
      lastActive: p.lastActiveDays === null ? null : daysAgo(p.lastActiveDays),
    },
    tags: [],
    permissions: [],
  }));

  const groups: Row[] = GROUPS.map((g, i) => {
    const members = PEOPLE.filter((p) => p.groups.includes(g.name));
    return {
      ...base('group', g.name, g.name, 690 - i * 60, 45),
      arn: groupArn(g.name),
      description: g.description,
      memberCount: members.length,
      members: members.map((m) => ({
        memberName: m.name,
        arn: userArn(m.name),
        email: emailOf(m.name),
      })),
      assetsCount: 8 + members.length * 5,
      tags: [],
      permissions: [],
    };
  });

  const archived: Row[] = ARCHIVE.map((a) => ({
    ...base(
      a.type,
      a.type === 'folder' ? `folder-${slug(a.name)}` : uuid(`archived:${a.name}`),
      a.name,
      a.createdDays,
      a.modifiedDays
    ),
    status: 'archived',
    lastActivity: a.lastViewedDays === null ? null : daysAgo(a.lastViewedDays),
    archivedDate: daysAgo(a.archivedDays),
    archiveReason: a.reason,
    archivedBy: a.by.label,
    archivedByPerson: a.by,
    restorations: a.restoredDays
      ? [
          {
            restoredAt: daysAgo(a.restoredDays),
            restoredBy: emailOf('priya.nair'),
            restoredAs: uuid(`restored:${a.name}`),
            restoredByPerson: {
              label: emailOf('priya.nair'),
              kind: 'person',
              email: emailOf('priya.nair'),
            },
          },
        ]
      : [],
    tags: [],
    permissions: [],
  }));

  return { dashboards, analyses, datasets, datasources, folders, users, groups, archived, tables };
}

const person = (name: string) => ({
  label: emailOf(name),
  kind: 'person',
  email: emailOf(name),
  quickSightUserName: name,
});

/** What was already in the archive before the story started. */
const ARCHIVE = table(`
  Weekly flash report          | dashboard  | 820 | 260 | 214 | 3  | No views in 180 days         | maya.chen   |
  Black Friday war room        | dashboard  | 370 | 355 | 351 | 9  | Event is over                | liam.ortega | 2
  Store ranking draft          | analysis   | 410 | 402 | -   | 9  | Never published              | liam.ortega |
  orders_bronze                | dataset    | 760 | 480 | -   | 16 | Replaced by orders_gold      | maya.chen   |
  returns_staging              | dataset    | 520 | 390 | -   | 16 | Replaced by returns_gold     | maya.chen   |
  Legacy reporting (MySQL)     | datasource | 930 | 610 | -   | 31 | Database decommissioned      | api-key     |
  Supplier portal usage        | dashboard  | 600 | 330 | 301 | 44 | No views in 180 days         | portal      |
  Pilot stores 2024            | folder     | 690 | 380 | -   | 58 | Merged into Store operations | priya.nair  |
`).map(([name, type, created, modified, viewed, archivedDays, reason, by, restored]) => ({
  name,
  type,
  createdDays: Number(created),
  modifiedDays: Number(modified),
  lastViewedDays: days(viewed),
  archivedDays: Number(archivedDays),
  reason,
  by:
    by === 'api-key'
      ? { label: 'cleanup (API key)', kind: 'api-key' }
      : by === 'portal'
        ? { label: 'The portal', kind: 'portal' }
        : person(by),
  restoredDays: Number(restored) || 0,
}));

// ---------------------------------------------------------------------------
// Derived views of the account
// ---------------------------------------------------------------------------

const relation = (from: Row, to: Row, relationshipType: 'uses' | 'used_by'): Relationship => ({
  sourceAssetId: from.id,
  sourceAssetType: from.type,
  sourceAssetName: from.name,
  targetAssetId: to.id,
  targetAssetType: to.type,
  targetAssetName: to.name,
  relationshipType,
  ...(to.activity && { activity: to.activity }),
  tags: to.tags,
});

function relatedAssets(account: Account, row: Row): Relationship[] {
  const out: Relationship[] = [];
  const reports = [...account.dashboards, ...account.analyses];
  if (row.type === 'dashboard' || row.type === 'analysis') {
    for (const dataset of account.datasets.filter((d) => row._datasets.includes(d.id))) {
      out.push(relation(row, dataset, 'uses'));
    }
    if (row.type === 'analysis') {
      const dashboard = account.dashboards.find((d) => d.id === row._dashboard);
      if (dashboard) out.push(relation(row, dashboard, 'used_by'));
    }
  }
  if (row.type === 'dataset') {
    const source = account.datasources.find((s) => s.id === row._source);
    if (source) out.push(relation(row, source, 'uses'));
    for (const r of reports.filter((x) => x._datasets.includes(row.id))) {
      out.push(relation(row, r, 'used_by'));
    }
  }
  if (row.type === 'datasource') {
    for (const dataset of account.datasets.filter((d) => d._source === row.id)) {
      out.push(relation(row, dataset, 'used_by'));
    }
  }
  return out;
}

/** A dataset is viewed through the dashboards and analyses built on it. */
function datasetActivity(account: Account, dataset: Row) {
  const dependents = [...account.dashboards, ...account.analyses].filter((r) =>
    r._datasets.includes(dataset.id)
  );
  const lastViewed = dependents
    .map((d) => d.activity.lastViewed as string | null)
    .filter(Boolean)
    .sort()
    .pop();
  return {
    totalViews: dependents.reduce((n, d) => n + d.activity.totalViews, 0),
    uniqueViewers: Math.max(0, ...dependents.map((d) => d.activity.uniqueViewers)),
    lastViewed: lastViewed ?? null,
    lastRefreshTime:
      dataset.importMode === 'SPICE'
        ? daysAgo(
            dataset._refresh === 'hourly'
              ? 0.02
              : dataset._refresh
                ? 0.3
                : Math.min(400, dataset.fieldCount * 20)
          )
        : null,
    dependents,
  };
}

/** The row as the list endpoint sends it: links resolved, private fields dropped. */
function present(account: Account, row: Row): Row {
  const shown: Row = { ...row };
  if (['dashboard', 'analysis', 'dataset', 'datasource'].includes(row.type)) {
    shown.relatedAssets = relatedAssets(account, row);
  }
  if (row.type === 'dataset') {
    const { dependents: _dependents, ...activity } = datasetActivity(account, row);
    shown.activity = activity;
  }
  if (row.type === 'folder') {
    shown.memberCount = [...account.dashboards, ...account.analyses, ...account.datasets].filter(
      (a) => a.folders?.some((f: FolderRef) => f.id === row.id)
    ).length;
  }
  for (const key of Object.keys(shown)) {
    if (key.startsWith('_')) delete shown[key];
  }
  return shown;
}

const count = (row: Row, kind: 'uses' | 'used_by') =>
  (row.relatedAssets as Relationship[] | undefined)?.filter((r) => r.relationshipType === kind)
    .length ?? 0;

/** What a column sorts by; the keys are the table's column ids. */
const SORT_VALUE: Record<string, (row: Row) => string | number> = {
  name: (r) => r.name.toLowerCase(),
  id: (r) => r.id,
  lastModified: (r) => Date.parse(r.lastUpdatedTime),
  lastUpdatedTime: (r) => Date.parse(r.lastUpdatedTime),
  createdTime: (r) => Date.parse(r.createdTime),
  activity: (r) => r.activity?.totalViews ?? r.activity?.totalActivities ?? 0,
  viewCount: (r) => r.activity?.totalViews ?? 0,
  permissions: (r) => r.assetAccessCount ?? r.permissions?.length ?? 0,
  tags: (r) => r.tags?.length ?? 0,
  folders: (r) => r.folderCount ?? 0,
  uses: (r) => count(r, 'uses'),
  usedBy: (r) => count(r, 'used_by'),
  sheetCount: (r) => r.sheetCount ?? 0,
  visualCount: (r) => r.visualCount ?? 0,
  errors: (r) => r.definitionErrors?.length ?? 0,
  sourceType: (r) => r.sourceType ?? '',
  importMode: (r) => r.importMode ?? '',
  experience: (r) => r.experience ?? '',
  schemas: (r) => r.schemas?.[0] ?? '',
  sharesTablesWith: (r) => r.sharesTablesWith ?? -1,
  spiceCapacity: (r) => (r.importMode === 'SPICE' ? (r.sizeInBytes ?? 0) : 0),
  refreshSchedule: (r) => r.refreshSchedules?.[0]?.scheduleFrequency?.interval ?? '',
  refreshAlerts: (r) => (r.dataSetRefreshProperties ? 1 : 0),
  path: (r) => r.path ?? '',
  memberCount: (r) => r.memberCount ?? 0,
  assetsCount: (r) => r.assetsCount ?? 0,
  email: (r) => r.email ?? '',
  role: (r) => r.role ?? '',
  groups: (r) => r.groupCount ?? 0,
  description: (r) => r.description ?? '',
  type: (r) => r.type,
  archivedDate: (r) => Date.parse(r.archivedDate ?? r.createdTime),
  archivedBy: (r) => r.archivedBy ?? '',
  archiveReason: (r) => r.archiveReason ?? '',
};

const jsonParam = <T>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const matchesSearch = (row: Row, term: string) =>
  [row.name, row.id, row.email, row.description, row.sourceType, ...(row.schemas ?? [])]
    .filter(Boolean)
    .some((text) => String(text).toLowerCase().includes(term)) ||
  (row.tags as Tag[] | undefined)?.some((t) => `${t.key}:${t.value}`.toLowerCase().includes(term));

const DATE_RANGE_DAYS: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };

/** The list filters the pages send, applied the way the server applies them. */
function applyFilters(rows: Row[], params: Record<string, string>): Row[] {
  let out = rows;
  const term = params.search?.trim().toLowerCase();
  if (term) {
    out = out
      .filter((row) => matchesSearch(row, term))
      .map((row) => ({
        ...row,
        searchMatchReasons: [row.name.toLowerCase().includes(term) ? 'name' : 'tags'],
      }));
  }
  const days = DATE_RANGE_DAYS[params.dateRange ?? ''];
  if (days) {
    const since = Date.now() - days * DAY_MS;
    const at = (row: Row) =>
      params.dateField === 'createdTime'
        ? row.createdTime
        : params.dateField === 'lastActivity'
          ? (row.activity?.lastViewed ?? row.activity?.lastActive)
          : (row.archivedDate ?? row.lastUpdatedTime);
    out = out.filter((row) => at(row) && Date.parse(at(row)) >= since);
  }
  if (params.errorFilter) {
    const want = params.errorFilter === 'with_errors';
    out = out.filter((row) => (row.definitionErrors?.length ?? 0) > 0 === want);
  }
  if (params.activityFilter) {
    const want = params.activityFilter === 'with_activity';
    out = out.filter(
      (row) => (row.activity?.totalViews ?? row.activity?.totalActivities ?? 0) > 0 === want
    );
  }
  if (params.importModeFilter) {
    out = out.filter(
      (row) => String(row.importMode).toLowerCase() === params.importModeFilter?.toLowerCase()
    );
  }
  if (params.experienceFilter) {
    out = out.filter((row) => row.experience === params.experienceFilter);
  }
  const sourceTypes = jsonParam<string[]>(params.sourceTypeFilter, []);
  if (sourceTypes.length > 0) out = out.filter((row) => sourceTypes.includes(row.sourceType));
  const roles = jsonParam<string[]>(params.roleFilter, []);
  if (roles.length > 0) out = out.filter((row) => roles.includes(row.role));
  const groups = jsonParam<string[]>(params.groupFilter, []);
  if (groups.length > 0) {
    out = out.filter((row) =>
      (row.groups as string[] | undefined)?.some((g) => groups.includes(g))
    );
  }
  const includeTags = jsonParam<Tag[]>(params.includeTags, []);
  if (includeTags.length > 0) {
    out = out.filter((row) =>
      includeTags.some((want) =>
        (row.tags as Tag[]).some((t) => t.key === want.key && t.value === want.value)
      )
    );
  }
  const excludeTags = jsonParam<Tag[]>(params.excludeTags, []);
  if (excludeTags.length > 0) {
    out = out.filter(
      (row) =>
        !excludeTags.some((not) =>
          (row.tags as Tag[]).some((t) => t.key === not.key && t.value === not.value)
        )
    );
  }
  const inFolder = (row: Row, wanted: Array<{ id: string }>) =>
    (row.folders as FolderRef[] | undefined)?.some((f) => wanted.some((w) => w.id === f.id));
  const includeFolders = jsonParam<Array<{ id: string }>>(params.includeFolders, []);
  if (includeFolders.length > 0) out = out.filter((row) => inFolder(row, includeFolders));
  const excludeFolders = jsonParam<Array<{ id: string }>>(params.excludeFolders, []);
  if (excludeFolders.length > 0) out = out.filter((row) => !inFolder(row, excludeFolders));
  return out;
}

function sortRows(rows: Row[], sortBy: string | undefined, sortOrder: string | undefined): Row[] {
  const value = sortBy ? SORT_VALUE[sortBy] : undefined;
  if (!value) return rows;
  const direction = sortOrder?.toLowerCase() === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const order =
      typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return order * direction || a.name.localeCompare(b.name);
  });
}

function page(rows: Row[], params: Record<string, string>) {
  const pageNumber = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 50);
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    items: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
    pagination: {
      page: pageNumber,
      pageSize,
      totalItems,
      totalPages,
      hasMore: pageNumber < totalPages,
    },
  };
}

const tally = (values: string[]) =>
  [...new Set(values)].sort().map((value) => ({
    value,
    count: values.filter((v) => v === value).length,
  }));

function list(account: Account, plural: Plural, params: Record<string, string>) {
  const all = account[plural].map((row) => present(account, row));
  const rows = sortRows(applyFilters(all, params), params.sortBy, params.sortOrder);
  const { items, pagination } = page(rows, params);
  return {
    [plural]: items,
    pagination,
    fromCache: true,
    ...((plural === 'datasets' || plural === 'datasources') && {
      availableSourceTypes: tally(all.map((r) => r.sourceType).filter(Boolean)),
    }),
    ...(plural === 'users' && {
      availableRoles: tally(all.map((r) => r.role)),
      availableGroups: tally(all.flatMap((r) => r.groups as string[])),
    }),
  };
}

// --- activity ---------------------------------------------------------------

/** Spread `total` over the last `days` days: weekdays busy, weekends quiet, deterministic. */
function viewsByDate(seed: string, total: number, days = 30, startDaysAgo = 0) {
  const next = seeded(seed);
  const weights = Array.from({ length: days }, (_, i) => {
    const weekday = new Date(Date.now() - (i + startDaysAgo) * DAY_MS).getUTCDay();
    return (weekday === 0 || weekday === 6 ? 0.25 : 1) * (0.7 + next() * 0.6);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  weights.forEach((w, i) => {
    const n = Math.round((total * w) / sum);
    if (n > 0) out[dayKey(i + startDaysAgo)] = n;
  });
  return out;
}

function reportActivity(row: Row) {
  const { totalViews, uniqueViewers, lastViewed } = row.activity;
  const lastDays = lastViewed ? Math.round((Date.now() - Date.parse(lastViewed)) / DAY_MS) : 0;
  // The people who can see it, most engaged first: its folder's group, then everyone else.
  const folderGroup = FOLDERS.find((f) => `folder-${f.key}` === row.folders?.[0]?.id)?.group;
  const audience = [...PEOPLE]
    .filter((p) => p.lastActiveDays !== null)
    .sort(
      (a, b) =>
        Number(b.groups.includes(folderGroup ?? '')) -
          Number(a.groups.includes(folderGroup ?? '')) || b.activities - a.activities
    )
    .slice(0, Math.min(uniqueViewers, 12));
  const next = seeded(`viewers:${row.id}`);
  // The named viewers account for about a third of the views; the long tail is everyone else.
  const named = Math.round(totalViews * (uniqueViewers > audience.length ? 0.34 : 1));
  const weights = audience.map((_, i) => (1 / (i + 1.4)) * (0.8 + next() * 0.4));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  return {
    assetId: row.id,
    assetName: row.name,
    assetType: row.type,
    totalViews,
    uniqueViewers,
    lastViewed: lastViewed ?? null,
    viewsByDate:
      totalViews > 0
        ? viewsByDate(`views:${row.id}`, Math.round(totalViews / 3), 30, lastDays)
        : {},
    viewers: audience
      .map((p, i) => ({
        userName: emailOf(p.name),
        viewCount: Math.max(1, Math.round((named * (weights[i] ?? 0)) / weightSum)),
        lastViewed: daysAgo(lastDays + (i === 0 ? 0.01 : next() * 6)),
        groups: p.groups,
      }))
      .sort((a, b) => b.viewCount - a.viewCount),
  };
}

function datasetActivityDetail(account: Account, dataset: Row) {
  const { dependents, lastRefreshTime, ...activity } = datasetActivity(account, dataset);
  const spice = dataset.importMode === 'SPICE';
  const runs = !spice ? 0 : dataset._refresh === 'hourly' ? 12 : dataset._refresh ? 10 : 1;
  const stepDays = dataset._refresh === 'hourly' ? 1 / 24 : dataset._refresh === 'weekly' ? 7 : 1;
  const next = seeded(`ingest:${dataset.id}`);
  const rows = Math.round((dataset.sizeInBytes / MB) * 5200);
  const failAt = dataset._errorRows > 500 ? 0 : dataset._errorRows > 0 ? 3 : -1;
  const ingestions = Array.from({ length: runs }, (_, i) => {
    const failed = i === failAt;
    return {
      id: uuid(`ingestion:${dataset.id}:${i}`),
      datasetId: dataset.id,
      datasetName: dataset.name,
      importMode: 'SPICE',
      datasourceType: dataset.sourceType,
      sizeInBytes: dataset.sizeInBytes,
      status: failed ? 'FAILED' : 'COMPLETED',
      createdTime: lastRefreshTime
        ? new Date(Date.parse(lastRefreshTime) - i * stepDays * DAY_MS).toISOString()
        : daysAgo(i),
      ingestionTimeInSeconds: failed
        ? 41
        : Math.round(60 + (dataset.sizeInBytes / MB) * (0.25 + next() * 0.1)),
      requestType: 'FULL_REFRESH',
      ...(failed
        ? {
            errorType: 'DATA_SOURCE_CONNECTION_FAILED',
            errorMessage: 'Could not connect to the data source',
          }
        : { rowsIngested: rows - i * 1873, rowsDropped: i === 0 ? dataset._errorRows : 0 }),
    };
  });
  return {
    datasetId: dataset.id,
    datasetName: dataset.name,
    ...activity,
    viewsByDate:
      activity.totalViews > 0
        ? viewsByDate(`views:${dataset.id}`, Math.round(activity.totalViews / 3))
        : {},
    usedBy: dependents
      .map((d) => ({
        assetId: d.id,
        assetName: d.name,
        assetType: d.type,
        totalViews: d.activity.totalViews,
        uniqueViewers: d.activity.uniqueViewers,
        lastViewed: d.activity.lastViewed,
        lastUpdated: d.lastUpdatedTime,
      }))
      .sort((a, b) => b.totalViews - a.totalViews),
    refreshSummary: {
      totalIngestions: runs === 0 ? 0 : dataset._refresh === 'hourly' ? 720 : runs * 3,
      failedIngestions: ingestions.filter((i) => i.status === 'FAILED').length,
      lastIngestionTime: ingestions[0]?.createdTime ?? null,
      lastIngestionStatus: ingestions[0]?.status ?? null,
    },
    ingestions,
  };
}

/** CloudWatch-style health for the last 30 days, in step with each asset's use. */
function health(account: Account, assetType: string, ids: string[]) {
  const rows = assetType === 'dataset' ? account.datasets : account.dashboards;
  return ids.map((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return { id };
    const next = seeded(`health:${id}`);
    if (assetType === 'dataset') {
      if (row.importMode !== 'SPICE' || !row._refresh) return { id };
      const runs = row._refresh === 'hourly' ? 720 : row._refresh === 'weekly' ? 4 : 30;
      return {
        id,
        ingestionRuns: runs,
        ingestionLatencyP90Ms: Math.round(400 + (row.sizeInBytes / MB) * (2 + next() * 0.4)),
        ingestionErrorRows: row._errorRows,
      };
    }
    const views = Math.round(row.activity.totalViews / 3.2);
    if (views === 0) return { id };
    return {
      id,
      viewLoads: views,
      viewLoadTimeP90Ms: Math.round(500 + row.visualCount * (35 + next() * 75)),
      visualErrors:
        (row.definitionErrors?.length ?? 0) * 9 + (next() > 0.82 ? Math.ceil(next() * 4) : 0),
    };
  });
}

// --- the asset as the export saved it (the JSON viewer) -------------------------

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const COLUMNS: Array<[string, string]> = [
  ['order_id', 'STRING'],
  ['ordered_at', 'DATETIME'],
  ['store_id', 'STRING'],
  ['region', 'STRING'],
  ['category', 'STRING'],
  ['units', 'INTEGER'],
  ['net_sales', 'DECIMAL'],
  ['gross_margin', 'DECIMAL'],
];

/** A field of a dataset, as a definition names it. */
const column = (dataset: string, name: string) => ({
  FieldId: name,
  Column: { DataSetIdentifier: dataset, ColumnName: name },
});
const measure = (dataset: string, name: string) => ({
  NumericalMeasureField: {
    ...column(dataset, name),
    AggregationFunction: { SimpleNumericalAggregation: 'SUM' },
  },
});
const byWeek = (dataset: string) => ({
  DateDimensionField: { ...column(dataset, 'ordered_at'), DateGranularity: 'WEEK' },
});
const title = (text: string) => ({ Visibility: 'VISIBLE', FormatText: { PlainText: text } });

/** The nth visual of a sheet: a KPI first, then bars and lines in turn. */
function visual(id: string, n: number, dataset: string) {
  if (n === 0) {
    return {
      KPIVisual: {
        VisualId: id,
        Title: title('Net sales'),
        ChartConfiguration: {
          FieldWells: { Values: [measure(dataset, 'net_sales')], TrendGroups: [byWeek(dataset)] },
        },
      },
    };
  }
  if (n % 2 === 1) {
    return {
      BarChartVisual: {
        VisualId: id,
        Title: title('Net sales by region'),
        ChartConfiguration: {
          Orientation: 'HORIZONTAL',
          FieldWells: {
            BarChartAggregatedFieldWells: {
              Category: [{ CategoricalDimensionField: column(dataset, 'region') }],
              Values: [measure(dataset, 'net_sales')],
            },
          },
        },
      },
    };
  }
  return {
    LineChartVisual: {
      VisualId: id,
      Title: title('Gross margin by week'),
      ChartConfiguration: {
        FieldWells: {
          LineChartAggregatedFieldWells: {
            Category: [byWeek(dataset)],
            Values: [measure(dataset, 'gross_margin')],
            Colors: [{ CategoricalDimensionField: column(dataset, 'category') }],
          },
        },
      },
    },
  };
}

const SHEET_NAMES = ['Overview', 'By region', 'By category', 'Trends', 'Detail', 'Notes'];
const VISUALS_SHOWN_PER_SHEET = 4;

function reportDefinition(account: Account, row: Row) {
  const datasets = account.datasets.filter((d) => row._datasets.includes(d.id));
  const first = datasets[0]?.name ?? 'dataset';
  const perSheet = Math.min(VISUALS_SHOWN_PER_SHEET, Math.ceil(row.visualCount / row.sheetCount));
  const Sheets = Array.from({ length: row.sheetCount }, (_, s) => ({
    SheetId: uuid(`sheet:${row.id}:${s}`),
    Name: SHEET_NAMES[s] ?? `Sheet ${s + 1}`,
    ContentType: 'INTERACTIVE',
    Visuals: Array.from({ length: perSheet }, (_, n) =>
      visual(uuid(`visual:${row.id}:${s}:${n}`), n, first)
    ),
  }));
  const sheetList = Sheets.map(({ SheetId, Name }) => ({ SheetId, Name }));
  const DataSetArns = datasets.map((d) => d.arn);
  const wrapper = row.type === 'dashboard' ? 'Dashboard' : 'Analysis';
  const version =
    row.type === 'dashboard'
      ? {
          LastPublishedTime: row.lastUpdatedTime,
          Version: {
            VersionNumber: row.publishedVersionNumber,
            Status: 'CREATION_SUCCESSFUL',
            CreatedTime: row.lastUpdatedTime,
            DataSetArns,
            Sheets: sheetList,
          },
        }
      : { Status: 'CREATION_SUCCESSFUL', DataSetArns, Sheets: sheetList };
  return {
    [wrapper]: {
      [`${wrapper}Id`]: row.id,
      Arn: row.arn,
      Name: row.name,
      CreatedTime: row.createdTime,
      LastUpdatedTime: row.lastUpdatedTime,
      ...version,
    },
    Definition: {
      DataSetIdentifierDeclarations: datasets.map((d) => ({
        Identifier: d.name,
        DataSetArn: d.arn,
      })),
      Sheets,
      CalculatedFields: [
        ['Margin rate', 'sum({gross_margin}) / sum({net_sales})'],
        ['Average basket', 'sum({net_sales}) / distinct_count({order_id})'],
        ['Units per order', 'sum({units}) / distinct_count({order_id})'],
      ].map(([Name, Expression]) => ({ DataSetIdentifier: first, Name, Expression })),
      ParameterDeclarations: [
        { StringParameterDeclaration: { Name: 'Region', ParameterValueType: 'MULTI_VALUED' } },
      ],
      FilterGroups: [
        {
          FilterGroupId: uuid(`filter:${row.id}`),
          CrossDataset: 'ALL_DATASETS',
          Status: 'ENABLED',
          Filters: [
            {
              TimeRangeFilter: {
                FilterId: uuid(`filter:${row.id}:date`),
                Column: column(first, 'ordered_at').Column,
                TimeGranularity: 'WEEK',
              },
            },
            {
              CategoryFilter: {
                FilterId: uuid(`filter:${row.id}:region`),
                Column: column(first, 'region').Column,
              },
            },
          ],
        },
      ],
    },
  };
}

function datasetDefinition(account: Account, row: Row) {
  const columns = COLUMNS.slice(0, Math.min(COLUMNS.length, row.fieldCount));
  const PhysicalTableMap: Record<string, unknown> = {};
  for (const table of account.tables[row.id] ?? []) {
    const InputColumns = columns.map(([Name, Type]) => ({ Name, Type }));
    PhysicalTableMap[table.id] =
      table.kind === 'CUSTOM_SQL'
        ? {
            CustomSql: {
              DataSourceArn: table.dataSourceArn,
              Name: table.name,
              SqlQuery: table.sqlQuery,
              Columns: InputColumns,
            },
          }
        : table.kind === 'S3'
          ? {
              S3Source: {
                DataSourceArn: table.dataSourceArn,
                UploadSettings: { Format: 'CSV', StartFromRow: 1, ContainsHeader: true },
                InputColumns,
              },
            }
          : {
              RelationalTable: {
                DataSourceArn: table.dataSourceArn,
                Catalog: table.catalog,
                Schema: table.schema,
                Name: table.name,
                InputColumns,
              },
            };
  }
  const tableId = account.tables[row.id]?.[0]?.id ?? '';
  return {
    DataSet: {
      DataSetId: row.id,
      Arn: row.arn,
      Name: row.name,
      CreatedTime: row.createdTime,
      LastUpdatedTime: row.lastUpdatedTime,
      ImportMode: row.importMode,
      ConsumedSpiceCapacityInBytes: row.importMode === 'SPICE' ? row.sizeInBytes : 0,
      PhysicalTableMap,
      LogicalTableMap: {
        [uuid(`logical:${row.id}`)]: {
          Alias: row.name,
          Source: { PhysicalTableId: tableId },
          DataTransforms: [
            { CastColumnTypeOperation: { ColumnName: 'ordered_at', NewColumnType: 'DATETIME' } },
            {
              TagColumnOperation: {
                ColumnName: 'region',
                Tags: [{ ColumnGeographicRole: 'STATE' }],
              },
            },
          ],
        },
      },
      OutputColumns: columns.map(([Name, Type]) => ({ Name, Type })),
      DataSetUsageConfiguration: {
        DisableUseAsDirectQuerySource: false,
        DisableUseAsImportedSource: false,
      },
    },
  };
}

function cachedAsset(account: Account, kind: AssetKind, id: string) {
  const row = account[LIST_OF[kind]].find((r) => r.id === id);
  if (!row) return null;
  const shown = present(account, row);
  const body =
    kind === 'dataset'
      ? datasetDefinition(account, row)
      : kind === 'datasource'
        ? {
            DataSource: {
              DataSourceId: row.id,
              Arn: row.arn,
              Name: row.name,
              Type: row.sourceType,
              Status: 'CREATION_SUCCESSFUL',
              CreatedTime: row.createdTime,
              LastUpdatedTime: row.lastUpdatedTime,
              DataSourceParameters: row.dataSourceParameters,
              SslProperties: { DisableSsl: false },
            },
          }
        : reportDefinition(account, row);
  return {
    '@metadata': {
      assetType: LIST_OF[kind],
      assetId: row.id,
      name: row.name,
      status: 'enriched',
      created: row.createdTime,
      lastUpdated: row.lastUpdatedTime,
      exportTime: row.lastExportTime,
      exportVersion: '2.0',
      enrichmentStatus: {
        definition: row.lastExportTime,
        permissions: row.lastExportTime,
        tags: row.lastExportTime,
        lineage: row.lastExportTime,
      },
      ...(row.sheetCount && { sheetCount: row.sheetCount, visualCount: row.visualCount }),
      folders: shown.folders?.map((f: FolderRef) => f.path),
      slug: slug(row.name),
    },
    ...body,
    Permissions: row.permissions,
    Tags: row.tags,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const ok = (data: unknown) => ({ body: { success: true, data } });
const notFound = (what: string) => ({
  status: 404,
  body: { success: false, error: `${what} not found` },
});
const segment = (config: MockRequest, pattern: RegExp, index = 1) =>
  decodeURIComponent(config.url.match(pattern)?.[index] ?? '');

/** Counts for the cache summary, live from the account. */
function summary(account: Account) {
  const archivedOf = (type: string) => account.archived.filter((a) => a.type === type).length;
  const assetTypeCounts = {
    dashboards: account.dashboards.length,
    analyses: account.analyses.length,
    datasets: account.datasets.length,
    datasources: account.datasources.length,
    folders: account.folders.length,
    users: account.users.length,
    groups: account.groups.length,
    themes: 0,
  };
  const totalAssets = Object.values(assetTypeCounts).reduce((a, b) => a + b, 0);
  return {
    totalAssets,
    exportedAssets: totalAssets,
    lastExportDate: daysAgo(0.01),
    exportInProgress: false,
    needsInitialExport: false,
    assetTypeCounts,
    archivedAssetCounts: {
      dashboards: archivedOf('dashboard'),
      analyses: archivedOf('analysis'),
      datasets: archivedOf('dataset'),
      datasources: archivedOf('datasource'),
      folders: archivedOf('folder'),
      users: archivedOf('user'),
      groups: archivedOf('group'),
      themes: 0,
      total: account.archived.length,
    },
    fieldStatistics: {
      totalFields: account.datasets.reduce((n, d) => n + d.fieldCount, 0),
      totalCalculatedFields: (account.dashboards.length + account.analyses.length) * 3,
      totalUniqueFields: 212,
    },
  };
}

/** The archive list on its own, for stories that show only the archive. */
export function archiveRoutes(account: Account): MockRoute[] {
  return [
    { method: 'get', url: '/export/summary', respond: () => ok(summary(account)) },
    {
      method: 'get',
      url: /\/assets\/archived$/,
      respond: ({ params }) => {
        const typed = params.type
          ? account.archived.filter((a) => a.type === params.type)
          : account.archived;
        const rows = sortRows(
          applyFilters(typed, params),
          params.sortBy ?? 'archivedDate',
          params.sortOrder ?? 'desc'
        );
        const { items, pagination } = page(rows, params);
        return ok({
          items,
          totalCount: pagination.totalItems,
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalPages: pagination.totalPages,
        });
      },
    },
  ];
}

/**
 * The API over `account`, for the asset list pages and the dialogs they open.
 * Reads come from the account and writes change it, so a story behaves like
 * the app: sort a column, repoint a dataset, delete a few dashboards.
 */
export function accountRoutes(account: Account = createAccount()): MockRoute[] {
  /** Jobs the mutations queued; each finishes on its second poll. */
  const jobs = new Map<string, { polls: number; total: number; startTime: string }>();

  return [
    ...archiveRoutes(account),

    // --- lists ---
    {
      method: 'get',
      url: /^\/assets\/(dashboards|analyses|datasets|datasources|folders|users|groups)\/paginated$/,
      respond: (config) =>
        ok(list(account, segment(config, /^\/assets\/([^/]+)\//) as Plural, config.params)),
    },
    {
      method: 'get',
      url: /^\/assets\/themes\/paginated$/,
      respond: ({ params }) => ok({ themes: [], pagination: page([], params).pagination }),
    },
    {
      method: 'get',
      url: '/data-catalog/tags',
      respond: () => {
        const tags = [
          ...account.dashboards,
          ...account.analyses,
          ...account.datasets,
          ...account.datasources,
        ]
          .flatMap((row) => row.tags as Tag[])
          .map((t) => `${t.key}\u0000${t.value}`);
        return ok(
          tally(tags).map(({ value, count: n }) => {
            const [key, tagValue] = value.split('\u0000');
            return { key, value: tagValue, count: n };
          })
        );
      },
    },
    { method: 'get', url: '/smus/status', respond: () => ok({ configured: false }) },

    // --- activity and health ---
    {
      method: 'get',
      url: '/activity/health',
      respond: ({ params }) =>
        ok({
          assetType: params.assetType,
          windowDays: 30,
          available: true,
          items: health(
            account,
            String(params.assetType),
            String(params.ids ?? '')
              .split(',')
              .filter(Boolean)
          ),
        }),
    },
    {
      method: 'get',
      url: /^\/activity\/(dashboard|analysis)\/[^/]+$/,
      respond: (config) => {
        const kind = segment(config, /^\/activity\/([^/]+)\//) as 'dashboard' | 'analysis';
        const row = account[LIST_OF[kind]].find((r) => r.id === segment(config, /\/([^/]+)$/));
        return row ? ok(reportActivity(row)) : notFound('Activity');
      },
    },
    {
      method: 'get',
      url: /^\/activity\/dataset\/[^/]+$/,
      respond: (config) => {
        const row = account.datasets.find((r) => r.id === segment(config, /\/([^/]+)$/));
        return row ? ok(datasetActivityDetail(account, row)) : notFound('Activity');
      },
    },

    // --- one asset ---
    {
      method: 'get',
      url: /^\/assets\/(dashboard|analysis|dataset|datasource)\/[^/]+\/cached$/,
      respond: (config) => {
        const kind = segment(config, /^\/assets\/([^/]+)\//) as AssetKind;
        const asset = cachedAsset(account, kind, segment(config, /^\/assets\/[^/]+\/([^/]+)\//));
        return asset ? ok(asset) : notFound('Asset');
      },
    },
    {
      method: 'get',
      url: /^\/assets\/dataset\/[^/]+\/source$/,
      respond: (config) => {
        const row = account.datasets.find((r) => r.id === segment(config, /dataset\/([^/]+)\//));
        if (!row) return notFound('Dataset');
        return ok({
          dataSetId: row.id,
          name: row.name,
          importMode: row.importMode,
          experience: row.experience,
          tables: account.tables[row.id] ?? [],
          dataSources: account.datasources.map((s) => ({
            id: s.id,
            name: s.name,
            arn: s.arn,
            type: s.sourceType,
          })),
        });
      },
    },
    {
      method: 'put',
      url: /^\/assets\/dataset\/[^/]+\/source$/,
      respond: (config) => {
        const row = account.datasets.find((r) => r.id === segment(config, /dataset\/([^/]+)\//));
        if (!row) return notFound('Dataset');
        const update = requestBody<{
          name?: string;
          importMode?: string;
          tables?: Array<Partial<PhysicalTable> & { id: string }>;
        }>(config);
        if (update.name) row.name = update.name;
        if (update.importMode) row.importMode = update.importMode;
        for (const edit of update.tables ?? []) {
          const table = account.tables[row.id]?.find((t) => t.id === edit.id);
          if (table) Object.assign(table, edit);
        }
        // The row follows its first table: the source it reads and the schema it reads from.
        const first = account.tables[row.id]?.[0];
        const source = account.datasources.find((s) => s.arn === first?.dataSourceArn);
        if (source) {
          row._source = source.id;
          row.sourceType = source.sourceType;
        }
        if (first?.schema) row.schemas = [first.schema];
        return ok({
          dataSetId: row.id,
          name: row.name,
          importMode: row.importMode,
          experience: row.experience,
          tables: account.tables[row.id] ?? [],
        });
      },
    },
    {
      method: 'post',
      url: /^\/assets\/(dashboard|analysis|dataset|folder)\/[^/]+\/rename$/,
      respond: (config) => {
        const kind = segment(config, /^\/assets\/([^/]+)\//);
        const rows = kind === 'folder' ? account.folders : account[LIST_OF[kind as AssetKind]];
        const row = rows.find((r) => r.id === segment(config, /^\/assets\/[^/]+\/([^/]+)\//));
        if (!row) return notFound('Asset');
        row.name = requestBody<{ name: string }>(config).name;
        return ok({ id: row.id, name: row.name });
      },
    },

    // --- bulk delete: the assets leave their lists and land in the archive ---
    {
      method: 'post',
      url: '/assets/bulk-delete',
      respond: (config) => {
        const { assets, reason } = requestBody<{
          assets: Array<{ type: AssetKind; id: string }>;
          reason: string;
        }>(config);
        for (const { type, id } of assets) {
          const rows = account[LIST_OF[type]];
          const index = rows?.findIndex((r) => r.id === id) ?? -1;
          if (index < 0) continue;
          const [row] = rows.splice(index, 1);
          if (!row) continue;
          account.archived.unshift({
            ...present(account, row),
            status: 'archived',
            lastActivity: row.activity?.lastViewed ?? null,
            archivedDate: new Date().toISOString(),
            archiveReason: reason,
            archivedBy: emailOf('maya.chen'),
            archivedByPerson: person('maya.chen'),
            restorations: [],
          });
        }
        const jobId = `bulk-delete-${(jobs.size + 1).toString().padStart(4, '0')}`;
        jobs.set(jobId, { polls: 0, total: assets.length, startTime: new Date().toISOString() });
        return {
          status: 202,
          body: {
            success: true,
            jobId,
            status: 'queued',
            message: `Deleting ${assets.length} assets`,
          },
        };
      },
    },
    {
      method: 'get',
      url: /^\/jobs\/bulk-delete-\d+$/,
      respond: (config) => {
        const jobId = segment(config, /^\/jobs\/([^/]+)$/);
        const job = jobs.get(jobId);
        if (!job) return notFound('Job');
        job.polls += 1;
        const done = job.polls > 1;
        return ok({
          jobId,
          jobType: 'bulk-delete',
          status: done ? 'completed' : 'processing',
          progress: done ? 100 : 50,
          message: done
            ? `Deleted ${job.total} assets`
            : `Deleting assets: ${Math.ceil(job.total / 2)} of ${job.total}`,
          startTime: job.startTime,
          ...(done && { endTime: new Date().toISOString() }),
          startedBy: emailOf('maya.chen'),
          startedByPerson: person('maya.chen'),
          stats: {
            totalAssets: job.total,
            processedAssets: done ? job.total : Math.ceil(job.total / 2),
            failedAssets: 0,
          },
        });
      },
    },
  ];
}
