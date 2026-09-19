import { beforeEach, describe, expect, it, vi } from 'vitest';

import { matchesGlob, SmusService, toQuickSightColumnType } from '../SmusService';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../shared/services/settings/SettingsStore', () => ({
  settingsStore: { getString: () => '', getList: () => [], stored: () => ({}) },
}));

const LISTINGS = [
  {
    listingId: 'l-cust',
    assetId: 'a-cust',
    name: 'dim_customer',
    assetType: 'amazon.datazone.GlueTableAssetType',
    owningProjectId: 'proj-contract-prod',
    table: { database: 'contract_prod', name: 'dim_customer' },
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
    owningProjectId: 'proj-contract-prod',
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

describe('SmusService assets', () => {
  const adapter = { listAllListings: vi.fn(), listProjects: vi.fn() };
  const cache = { getAllDatasets: vi.fn(), getCacheEntries: vi.fn() };
  const qs = { createDataSet: vi.fn(), describeDatasetPermissions: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    SmusService.invalidateLinkMap();
    adapter.listAllListings.mockResolvedValue(LISTINGS);
    adapter.listProjects.mockResolvedValue([
      { id: 'proj-contract-prod', name: 'contract_prod' },
      { id: 'proj-medallion-prod', name: 'medallion_prod' },
    ]);
    cache.getAllDatasets.mockResolvedValue([
      {
        assetId: 'ds-cust',
        assetName: 'Customers (gold)',
        metadata: {
          lineageData: {
            physicalTables: [{ type: 'RELATIONAL', schema: 'contract_prod', name: 'dim_customer' }],
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
    new SmusService(cache as any, adapter as any, config(over), qs as any);

  it('lists every published asset with its project, table and the datasets already reading it', async () => {
    const result = await service().listAssets();

    expect(result.configured).toBe(true);
    expect(result.assets.map((a) => a.name)).toEqual(['dim_customer', 'mystery', 'raw_events']);
    expect(result.assets[0]).toMatchObject({
      projectName: 'contract_prod',
      table: { database: 'contract_prod', name: 'dim_customer' },
      url: 'https://smus.example/catalog/assets/l-cust',
      datasets: [{ id: 'ds-cust', name: 'Customers (gold)', matchType: 'source-table' }],
    });
    // One sweep shared by the listing and the link map
    expect(adapter.listAllListings).toHaveBeenCalledTimes(1);
  });

  it('limits to the selected projects and database patterns, and searches', async () => {
    const byProject = await service({ projectIds: ['proj-contract-prod'] }).listAssets();
    expect(byProject.assets.map((a) => a.listingId)).toEqual(['l-cust', 'l-noform']);
    expect(byProject.projectFilter).toEqual(['proj-contract-prod']);

    // A pattern needs table identity, so a listing without forms drops out
    const byPattern = await service({ databasePatterns: ['contract_*'] }).listAssets();
    expect(byPattern.assets.map((a) => a.listingId)).toEqual(['l-cust']);

    const searched = await service().listAssets('bronze-prod.raw');
    expect(searched.assets.map((a) => a.listingId)).toEqual(['l-raw']);
  });

  it('reports not configured without a domain', async () => {
    const result = await new SmusService(
      cache as any,
      null,
      config({ enabled: false }),
      qs as any
    ).listAssets();
    expect(result).toEqual({ configured: false, projectFilter: [], assets: [] });
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
      Schema: 'contract_prod',
      Name: 'dim_customer',
      InputColumns: [
        { Name: 'customer_id', Type: 'INTEGER' },
        { Name: 'signed_up', Type: 'DATETIME' },
      ],
    });
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
});

describe('helpers', () => {
  it('matches globs case-insensitively', () => {
    expect(matchesGlob('contract_prod', 'contract_*')).toBe(true);
    expect(matchesGlob('CONTRACT_DEV', 'contract_*')).toBe(true);
    expect(matchesGlob('gold-prod', 'contract_*')).toBe(false);
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
