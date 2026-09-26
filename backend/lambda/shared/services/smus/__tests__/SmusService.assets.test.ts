import { beforeEach, describe, expect, it, vi } from 'vitest';

import { matchesGlob, SmusService, toQuickSightColumnType } from '../SmusService';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/settings/SettingsStore', () => ({
  settingsStore: { getString: () => '', getList: () => [], stored: () => ({}) },
}));

const LISTINGS = [
  {
    listingId: 'l-cust',
    assetId: 'a-cust',
    name: 'dim_customer',
    assetType: 'amazon.datazone.GlueTableAssetType',
    owningProjectId: 'proj-published-prod',
    table: { database: 'published_prod', name: 'dim_customer' },
    columns: [
      { name: 'customer_id', type: 'bigint' },
      { name: 'signed_up', type: 'timestamp' },
    ],
  },
  {
    listingId: 'l-raw',
    assetId: 'a-raw',
    name: 'raw_events',
    assetType: 'amazon.datazone.GlueTableAssetType',
    owningProjectId: 'proj-medallion-prod',
    table: { database: 'bronze-prod', name: 'raw_events' },
    columns: [{ name: 'payload', type: 'string' }],
  },
  {
    listingId: 'l-noform',
    assetId: 'a-noform',
    name: 'mystery',
    assetType: 'x',
    owningProjectId: 'proj-published-prod',
  },
];

const config = (over: Partial<any> = {}) => ({
  enabled: true,
  domainId: 'dzd_1',
  region: 'us-east-1',
  portalUrl: 'https://smus.example',
  projectIds: [],
  databasePatterns: [],
  ...over,
});

const EXPORTED_AT = '2026-09-18T12:00:00.000Z';

/** The snapshot the export job would have written for dzd_1. */
const snapshot = (over: Partial<any> = {}) => ({
  version: 1,
  domainId: 'dzd_1',
  region: 'us-east-1',
  exportedAt: EXPORTED_AT,
  projectFilter: [],
  projects: [
    { id: 'proj-published-prod', name: 'published_prod' },
    { id: 'proj-medallion-prod', name: 'medallion_prod' },
  ],
  listings: LISTINGS,
  diagnostics: {
    domainId: 'dzd_1',
    region: 'us-east-1',
    fromListProjects: 2,
    listings: LISTINGS.length,
    publishers: 2,
  },
  ...over,
});

describe('SmusService assets', () => {
  const cache = { get: vi.fn(), getAllDatasets: vi.fn(), getCacheEntries: vi.fn() };
  const qs = { createDataSet: vi.fn(), describeDatasetPermissions: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    SmusService.invalidateLinkMap();
    cache.get.mockResolvedValue(snapshot());
    cache.getAllDatasets.mockResolvedValue([
      {
        assetId: 'ds-cust',
        assetName: 'Customers (gold)',
        metadata: {
          lineageData: {
            physicalTables: [
              { type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' },
            ],
          },
        },
      },
    ]);
    cache.getCacheEntries.mockResolvedValue([
      {
        assetId: 'athena-1',
        assetName: 'Athena',
        arn: 'arn:aws:quicksight:us-east-1:1:datasource/athena-1',
      },
    ]);
    qs.describeDatasetPermissions.mockResolvedValue({
      Permissions: [{ Principal: 'arn:user/rob', Actions: ['quicksight:DescribeDataSet'] }],
    });
    qs.createDataSet.mockResolvedValue({ arn: 'arn:ds/new', dataSetId: 'new' });
  });

  const service = (over: Partial<any> = {}) =>
    new SmusService(cache as any, config(over), qs as any);

  it('lists every published asset with its project, table and the datasets already reading it', async () => {
    const result = await service().listAssets();

    expect(result.configured).toBe(true);
    expect(result.assets.map((a) => a.name)).toEqual(['dim_customer', 'mystery', 'raw_events']);
    expect(result.assets[0]).toMatchObject({
      projectName: 'published_prod',
      table: { database: 'published_prod', name: 'dim_customer' },
      url: 'https://smus.example/catalog/assets/l-cust',
      datasets: [{ id: 'ds-cust', name: 'Customers (gold)', matchType: 'source-table' }],
    });
    // One sweep shared by the listing and the link map
    expect(result.exportedAt).toBe(EXPORTED_AT);
    expect(cache.get).toHaveBeenCalledWith('cache/smus/snapshot.json');
  });

  it('limits to the selected projects and database patterns, and searches', async () => {
    const byProject = await service({ projectIds: ['proj-published-prod'] }).listAssets();
    expect(byProject.assets.map((a) => a.listingId)).toEqual(['l-cust', 'l-noform']);
    expect(byProject.projectFilter).toEqual(['proj-published-prod']);

    // A pattern needs table identity, so a listing without forms drops out
    const byPattern = await service({ databasePatterns: ['published_*'] }).listAssets();
    expect(byPattern.assets.map((a) => a.listingId)).toEqual(['l-cust']);

    const searched = await service().listAssets('bronze-prod.raw');
    expect(searched.assets.map((a) => a.listingId)).toEqual(['l-raw']);
  });

  it('reports not configured without a domain', async () => {
    const result = await new SmusService(
      cache as any,
      config({ enabled: false }),
      qs as any
    ).listAssets();
    expect(result).toEqual({ configured: false, projectFilter: [], assets: [], exportedAt: null });
  });

  it('is empty with exportedAt null until an export has run', async () => {
    cache.get.mockResolvedValue(null);
    const result = await service({ projectIds: ['proj-published-prod'] }).listAssets();
    expect(result).toEqual({
      configured: true,
      projectFilter: ['proj-published-prod'],
      assets: [],
      exportedAt: null,
    });
  });

  it('ignores a snapshot taken for another domain', async () => {
    cache.get.mockResolvedValue(snapshot({ domainId: 'dzd_other' }));
    const result = await service().listAssets();
    expect(result.assets).toEqual([]);
    expect(result.exportedAt).toBeNull();
  });

  it('creates a relational dataset over the listing table with mapped column types and copied permissions', async () => {
    const result = await service().createDatasetFromListing('l-cust', {
      dataSourceId: 'athena-1',
      importMode: 'DIRECT_QUERY',
      permissionsFromDataSetId: 'ds-old',
    });

    expect(result).toMatchObject({ dataSetId: 'new', name: 'dim_customer', arn: 'arn:ds/new' });
    const call = qs.createDataSet.mock.calls[0]?.[0];
    expect(call.importMode).toBe('DIRECT_QUERY');
    expect(call.permissions).toEqual([
      { Principal: 'arn:user/rob', Actions: ['quicksight:DescribeDataSet'] },
    ]);
    const table = Object.values(call.physicalTableMap)[0] as any;
    expect(table.RelationalTable).toMatchObject({
      DataSourceArn: 'arn:aws:quicksight:us-east-1:1:datasource/athena-1',
      Catalog: 'AwsDataCatalog',
      Schema: 'published_prod',
      Name: 'dim_customer',
      InputColumns: [
        { Name: 'customer_id', Type: 'INTEGER' },
        { Name: 'signed_up', Type: 'DATETIME' },
      ],
    });
    // An analysis reads the logical table, so every column is projected
    // from the physical one; a dataset without it has no fields to bind.
    const [physicalTableId] = Object.keys(call.physicalTableMap);
    const logical = Object.values(call.logicalTableMap)[0] as any;
    expect(logical).toEqual({
      Alias: 'dim_customer',
      Source: { PhysicalTableId: physicalTableId },
      DataTransforms: [{ ProjectOperation: { ProjectedColumns: ['customer_id', 'signed_up'] } }],
    });
  });

  it('builds over the Athena source the governed datasets read through when none is given', async () => {
    cache.getCacheEntries.mockResolvedValue([
      {
        assetId: 'athena-old',
        assetName: 'Athena (old)',
        arn: 'arn:ds/athena-old',
        metadata: { sourceType: 'ATHENA' },
      },
      {
        assetId: 'athena-1',
        assetName: 'Athena',
        arn: 'arn:aws:quicksight:us-east-1:1:datasource/athena-1',
        metadata: { sourceType: 'ATHENA' },
      },
      {
        assetId: 'rs',
        assetName: 'Redshift',
        arn: 'arn:ds/rs',
        metadata: { sourceType: 'REDSHIFT' },
      },
    ]);
    cache.getAllDatasets.mockResolvedValue([
      {
        assetId: 'ds-cust',
        assetName: 'Customers (gold)',
        metadata: {
          lineageData: {
            datasourceIds: ['athena-1'],
            physicalTables: [
              { type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' },
            ],
          },
        },
      },
      // Ungoverned datasets read the old source more often; governed usage wins.
      {
        assetId: 'x1',
        assetName: 'adhoc 1',
        metadata: { lineageData: { datasourceIds: ['athena-old'] } },
      },
      {
        assetId: 'x2',
        assetName: 'adhoc 2',
        metadata: { lineageData: { datasourceIds: ['athena-old'] } },
      },
    ]);

    const choice = await service().defaultDataSource();
    expect(choice.dataSource).toMatchObject({
      id: 'athena-1',
      usedBy: 1,
      reason: 'used by 1 dataset linked to SMUS listings',
    });
    expect(choice.athena.map((a) => a.id)).toEqual(['athena-1', 'athena-old']);

    const result = await service().createDatasetFromListing('l-cust', {});
    expect(result.dataSource).toEqual({ id: 'athena-1', name: 'Athena' });
    expect(qs.createDataSet.mock.calls[0]?.[0].importMode).toBe('DIRECT_QUERY');
  });

  it('says so when there is no Athena source to build through', async () => {
    cache.getCacheEntries.mockResolvedValue([
      {
        assetId: 'rs',
        assetName: 'Redshift',
        arn: 'arn:ds/rs',
        metadata: { sourceType: 'REDSHIFT' },
      },
    ]);
    await expect(service().createDatasetFromListing('l-cust', {})).rejects.toThrow(
      'No Athena data source exists'
    );
  });

  it('refuses a listing without table identity, an unknown listing, and a foreign data source', async () => {
    await expect(
      service().createDatasetFromListing('l-noform', {
        dataSourceId: 'athena-1',
        importMode: 'SPICE',
      })
    ).rejects.toThrow('no table identity');
    await expect(
      service().createDatasetFromListing('nope', { dataSourceId: 'athena-1', importMode: 'SPICE' })
    ).rejects.toThrow("No published asset with listing id 'nope'");
    await expect(
      service().createDatasetFromListing('l-cust', {
        dataSourceId: 'tampered',
        importMode: 'SPICE',
      })
    ).rejects.toThrow("not one of this account's data sources");
    expect(qs.createDataSet).not.toHaveBeenCalled();
  });

  it('ties a dataset to a listing that was renamed away from its table', async () => {
    // The publisher called it something readable; the dataset only knows the
    // Glue table it reads, which is how most datasets arrive.
    cache.get.mockResolvedValue(
      snapshot({
        listings: [
          {
            listingId: 'l-renamed',
            assetId: 'a-renamed',
            name: 'Customers (gold)',
            assetType: 'amazon.datazone.GlueTableAssetType',
            owningProjectId: 'proj-published-prod',
            table: { database: 'published_prod', name: 'dim_customer' },
            columns: [{ name: 'customer_id', type: 'bigint' }],
          },
        ],
      })
    );

    // Nothing in the dataset's name hints at the listing, so only the table
    // it reads can tie the two together.
    cache.getAllDatasets.mockResolvedValue([
      {
        assetId: 'ds-cust',
        assetName: 'Prod customers v2',
        metadata: {
          lineageData: {
            physicalTables: [
              { type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' },
            ],
          },
        },
      },
    ]);

    const result = await service().listAssets();
    expect(result.assets[0]?.datasets).toEqual([
      { id: 'ds-cust', name: 'Prod customers v2', matchType: 'source-table' },
    ]);
  });

  it('carries the listing up a chain of datasets built on the governed one', async () => {
    // The shape people actually have: a raw dataset over the Glue table, a
    // curated dataset joined off it, and the calculated fields sitting on the
    // curated one. Only the raw dataset has table identity.
    cache.getAllDatasets.mockResolvedValue([
      {
        assetId: 'ds-mart',
        assetName: 'Customer mart',
        metadata: { lineageData: { datasetIds: ['ds-curated'] } },
      },
      {
        assetId: 'ds-curated',
        assetName: 'Customers curated',
        metadata: { lineageData: { datasetIds: ['ds-cust'] } },
      },
      {
        assetId: 'ds-cust',
        assetName: 'Prod customers v2',
        metadata: {
          lineageData: {
            physicalTables: [
              { type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' },
            ],
          },
        },
      },
    ]);

    const result = await service().listAssets();
    expect(result.assets.find((a) => a.listingId === 'l-cust')?.datasets).toEqual([
      { id: 'ds-mart', name: 'Customer mart', matchType: 'lineage', via: expect.anything() },
      {
        id: 'ds-curated',
        name: 'Customers curated',
        matchType: 'lineage',
        via: { datasetId: 'ds-cust', name: 'Prod customers v2' },
      },
      { id: 'ds-cust', name: 'Prod customers v2', matchType: 'source-table' },
    ]);
  });

  it('ties a custom-SQL dataset to the governed table it reads, not the staging one beside it', async () => {
    // The shape that emptied the catalog: the query joins a staging table and
    // a published one. The staging table has a listing too, but the database
    // patterns put it outside the catalog, so it must not claim the dataset
    // before the governed table is even tried.
    cache.get.mockResolvedValue(
      snapshot({
        listings: [
          {
            listingId: 'l-staging',
            assetId: 'a-staging',
            name: 'stg_customer',
            assetType: 'amazon.datazone.GlueTableAssetType',
            owningProjectId: 'proj-published-prod',
            table: { database: 'staging_prod', name: 'stg_customer' },
          },
          ...LISTINGS,
        ],
      })
    );
    cache.getAllDatasets.mockResolvedValue([
      {
        assetId: 'ds-sql',
        assetName: 'Customer mart',
        metadata: {
          lineageData: {
            physicalTables: [
              {
                type: 'CUSTOM_SQL',
                sqlTables: ['staging_prod.stg_customer', 'published_prod.dim_customer'],
              },
            ],
          },
        },
      },
    ]);

    const scoped = await service({ databasePatterns: ['published_*'] }).listAssets();
    expect(scoped.assets.find((a) => a.listingId === 'l-cust')?.datasets).toEqual([
      { id: 'ds-sql', name: 'Customer mart', matchType: 'custom-sql' },
    ]);

    // And the link the Datasets page reads agrees with the catalog, rather
    // than calling the dataset governed by a listing the catalog will not show.
    SmusService.invalidateLinkMap();
    const [link] = await service({ databasePatterns: ['published_*'] }).getDatasetLinks(['ds-sql']);
    expect(link).toMatchObject({ linked: true, listingId: 'l-cust' });
  });

  it('does not tie a dataset to a listing outside the selected projects', async () => {
    cache.getAllDatasets.mockResolvedValue([
      {
        assetId: 'ds-raw',
        assetName: 'Raw events',
        metadata: {
          lineageData: {
            physicalTables: [{ type: 'RELATIONAL', schema: 'bronze-prod', name: 'raw_events' }],
          },
        },
      },
    ]);

    const [link] = await service({ projectIds: ['proj-published-prod'] }).getDatasetLinks([
      'ds-raw',
    ]);
    expect(link).toEqual({ datasetId: 'ds-raw', linked: false });
  });

  it('inherits from the nearest matched ancestor and survives a cycle', async () => {
    cache.getAllDatasets.mockResolvedValue([
      // Two parents, one of them linked, and a cycle back to the child.
      {
        assetId: 'ds-join',
        assetName: 'Joined',
        metadata: { lineageData: { datasetIds: ['ds-loop', 'ds-raw'] } },
      },
      {
        assetId: 'ds-loop',
        assetName: 'Loop',
        metadata: { lineageData: { datasetIds: ['ds-join'] } },
      },
      {
        assetId: 'ds-raw',
        assetName: 'raw_events',
        metadata: { lineageData: { datasetIds: [] } },
      },
    ]);

    const result = await service().listAssets();
    const raw = result.assets.find((a) => a.listingId === 'l-raw');
    expect(raw?.datasets).toEqual([
      {
        id: 'ds-join',
        name: 'Joined',
        matchType: 'lineage',
        via: { datasetId: 'ds-raw', name: 'raw_events' },
      },
      {
        id: 'ds-loop',
        name: 'Loop',
        matchType: 'lineage',
        // Reached at depth two through the cycle, and still tied back to the
        // dataset that matched directly rather than to its inherited child.
        via: { datasetId: 'ds-raw', name: 'raw_events' },
      },
      { id: 'ds-raw', name: 'raw_events', matchType: 'name' },
    ]);
  });
});

describe('helpers', () => {
  it('matches globs case-insensitively', () => {
    expect(matchesGlob('published_prod', 'published_*')).toBe(true);
    expect(matchesGlob('PUBLISHED_DEV', 'published_*')).toBe(true);
    expect(matchesGlob('gold-prod', 'published_*')).toBe(false);
    expect(matchesGlob('gold-prod', 'gold-????')).toBe(true);
  });

  it('maps source types to QuickSight input types', () => {
    expect(
      [
        'bigint',
        'int',
        'double',
        'decimal(10,2)',
        'boolean',
        'timestamp',
        'varchar(20)',
        'array<string>',
      ].map(toQuickSightColumnType)
    ).toEqual([
      'INTEGER',
      'INTEGER',
      'DECIMAL',
      'DECIMAL',
      'BOOLEAN',
      'DATETIME',
      'STRING',
      'STRING',
    ]);
  });
});

describe('SmusService projects', () => {
  const cache = {
    get: vi.fn(),
    getAllDatasets: vi.fn().mockResolvedValue([]),
    getCacheEntries: vi.fn(),
  };

  it('serves the projects and diagnostics the export captured, with its timestamp', async () => {
    cache.get.mockResolvedValue(snapshot());
    const service = new SmusService(cache as any, config(), null);

    expect(await service.listProjects()).toEqual(snapshot().projects);
    const discovery = await service.projectDiscovery();
    expect(discovery.exportedAt).toBe(EXPORTED_AT);
    expect(discovery.diagnostics).toMatchObject({ fromListProjects: 2, publishers: 2 });

    const status = await service.getStatus();
    expect(status).toMatchObject({
      configured: true,
      domainId: 'dzd_1',
      region: 'us-east-1',
      snapshot: { exportedAt: EXPORTED_AT, projects: 2, listings: LISTINGS.length, publishers: 2 },
    });
  });

  it('has no projects or snapshot before the first export, but still explains itself', async () => {
    cache.get.mockResolvedValue(null);
    const service = new SmusService(cache as any, config(), null);

    expect(await service.listProjects()).toEqual([]);
    const discovery = await service.projectDiscovery();
    expect(discovery.projects).toEqual([]);
    expect(discovery.exportedAt).toBeNull();
    expect(discovery.diagnostics).toMatchObject({ domainId: 'dzd_1', fromListProjects: 0 });
    expect(await service.getStatus()).not.toHaveProperty('snapshot');
  });

  it('unions a live ListProjects with the snapshot so unselected projects can be chosen', async () => {
    cache.get.mockResolvedValue(snapshot());
    const live = {
      listProjects: vi
        .fn()
        .mockResolvedValue([
          { id: 'proj-new', name: 'brand_new', description: 'not exported yet' },
        ]),
    };
    const service = new SmusService(cache as any, config(), null);

    const discovery = await service.projectDiscovery(live as any);

    expect(discovery.projects.map((p) => p.id)).toEqual([
      'proj-new',
      'proj-medallion-prod',
      'proj-published-prod',
    ]);
    expect(discovery.diagnostics).toMatchObject({ fromListProjects: 1, publishers: 2 });
    expect(discovery.exportedAt).toBe(EXPORTED_AT);
  });

  it('keeps the snapshot projects and names the error when the live call fails', async () => {
    cache.get.mockResolvedValue(snapshot());
    const live = { listProjects: vi.fn().mockRejectedValue(new Error('AccessDenied')) };
    const service = new SmusService(cache as any, config(), null);

    const discovery = await service.projectDiscovery(live as any);

    expect(discovery.projects).toHaveLength(2);
    expect(discovery.diagnostics?.listProjectsError).toBe('Error: AccessDenied');
  });
});
