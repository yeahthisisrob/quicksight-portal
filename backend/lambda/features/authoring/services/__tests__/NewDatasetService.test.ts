import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CatalogListing } from '../../../../adapters/aws/DataZoneAdapter';
import { catalogEntry, useTestCatalog } from '../../../../shared/utils/testUtils/testCatalog';
import { NewDatasetService } from '../NewDatasetService';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const settings: Record<string, unknown> = {};
vi.mock('../../../../shared/services/settings/SettingsStore', () => ({
  settingsStore: {
    get: (key: string) => settings[key],
    getString: () => '',
    getList: () => [],
    stored: () => ({}),
  },
}));

const owner = vi.fn();
vi.mock('../../../../shared/services/identity/IdentityResolver', () => ({
  quickSightUserFor: (email: string | undefined) => owner(email),
}));

const quickSight = {
  createDataSet: vi.fn(),
  createFolderMembership: vi.fn(),
  describeDatasetPermissions: vi.fn(),
  tagResource: vi.fn(),
};
vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => quickSight },
}));
vi.mock('../../../../shared/services/catalog/assetFreshness', () => ({
  keepCatalogFresh: vi.fn(),
}));
vi.mock('../../../../shared/services/audit/AuditLog', () => ({
  auditLog: { record: vi.fn() },
  actorFromAuth: () => ({
    actor: { kind: 'user', id: 'u', label: 'rob@example.com' },
    channel: 'web',
  }),
}));

const { seed } = useTestCatalog();

const LISTING: CatalogListing = {
  listingId: 'l-cust',
  assetId: 'a-cust',
  name: 'dim_customer',
  assetType: 'amazon.datazone.GlueTableAssetType',
  owningProjectId: 'proj',
  table: { database: 'published_prod', name: 'dim_customer' },
  columns: [
    { name: 'customer_id', type: 'bigint' },
    { name: 'signed_up', type: 'timestamp' },
  ],
  glossaryTerms: [],
  forms: [],
};

const smus = {
  listing: vi.fn(async (id: string) => (id === 'l-cust' ? LISTING : undefined)),
  listingFor: vi.fn(async ({ physicalTables }: any) =>
    physicalTables.some(
      (t: any) =>
        (t.type === 'RELATIONAL' && t.name === 'dim_customer') ||
        t.sqlTables?.includes('published_prod.dim_customer')
    )
      ? {
          datasetId: '',
          linked: true,
          listingId: 'l-cust',
          listingName: 'dim_customer',
          matchType: 'source-table' as const,
        }
      : { datasetId: '', linked: false }
  ),
  getLinkMap: vi.fn(async () => new Map([['ds-cust', { datasetId: 'ds-cust', linked: true }]])),
};
const athena = { querySchema: vi.fn() };
const rebind = { permissionsOf: vi.fn() };
const auth = { userId: 'u', accountId: '1', email: 'rob@example.com' };

const service = (configured = true) =>
  new NewDatasetService('1', rebind as any, smus as any, athena as any, configured);

describe('NewDatasetService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(settings)) delete settings[key];
    owner.mockResolvedValue({ userName: 'rob', arn: 'arn:user/rob' });
    quickSight.createDataSet.mockResolvedValue({ arn: 'arn:ds/new', dataSetId: 'new' });
    quickSight.createFolderMembership.mockResolvedValue({});
    athena.querySchema.mockResolvedValue([
      { name: 'customer_id', type: 'bigint' },
      { name: 'signups', type: 'bigint' },
      { name: 'month', type: 'date' },
    ]);
    await seed([
      catalogEntry('datasource', 'athena-1', {
        assetName: 'Athena',
        metadata: { sourceType: 'ATHENA', workGroup: 'analytics' },
      }),
      catalogEntry('datasource', 'rs', {
        assetName: 'Redshift',
        metadata: { sourceType: 'REDSHIFT' },
      }),
      catalogEntry('dataset', 'ds-cust', {
        assetName: 'Customers (gold)',
        metadata: {
          lineageData: {
            datasourceIds: ['athena-1'],
            physicalTables: [
              { tableId: 't1', type: 'RELATIONAL', schema: 'published_prod', name: 'dim_customer' },
            ],
          },
        },
      }),
    ]);
  });

  it('ranks the data sources a new dataset can read through', async () => {
    expect(
      (await service().dataSources()).map((d) => [d.id, d.datasets, d.governedDatasets])
    ).toEqual([
      ['athena-1', 1, 1],
      ['rs', 0, 0],
    ]);
  });

  it("reads a custom SQL dataset's columns from Athena, in the source's workgroup, and names the listing it links to", async () => {
    const preview = await service().preview(
      {
        name: 'Signups by month',
        source: {
          kind: 'sql',
          dataSourceId: 'athena-1',
          sql: 'select customer_id, count(*) signups, date_trunc(month, signed_up) month from published_prod.dim_customer group by 1, 3;',
        },
      },
      auth
    );
    expect(athena.querySchema).toHaveBeenCalledWith(
      expect.objectContaining({
        workGroup: 'analytics',
        outputLocation: expect.stringMatching(/^s3:\/\/.+\/athena-results\/$/),
      })
    );
    expect(preview).toMatchObject({
      dataSource: { id: 'athena-1', name: 'Athena', type: 'ATHENA' },
      table: { kind: 'CUSTOM_SQL', name: 'Signups by month' },
      columns: [
        { name: 'customer_id', type: 'INTEGER' },
        { name: 'signups', type: 'INTEGER' },
        { name: 'month', type: 'DATETIME' },
      ],
      columnsFrom: 'query',
      listing: { listingId: 'l-cust', name: 'dim_customer', matchType: 'source-table' },
      similar: [
        {
          dataSetId: 'ds-cust',
          name: 'Customers (gold)',
          table: 'published_prod.dim_customer',
          how: 'table',
        },
      ],
    });
    expect(preview.warnings).toEqual([
      'A dataset already reads published_prod.dim_customer: Customers (gold) (ds-cust).',
    ]);
  });

  it('types a plain select over a published table from the listing, without Athena', async () => {
    const preview = await service().preview(
      {
        name: 'Recent customers',
        source: {
          kind: 'sql',
          dataSourceId: 'athena-1',
          sql: "select customer_id, signed_up as joined_on from published_prod.dim_customer where signed_up > date '2026-01-01'",
        },
      },
      auth
    );
    expect(athena.querySchema).not.toHaveBeenCalled();
    expect(preview).toMatchObject({
      columns: [
        { name: 'customer_id', type: 'INTEGER' },
        { name: 'joined_on', type: 'DATETIME' },
      ],
      columnsFrom: 'listing',
      listing: { listingId: 'l-cust' },
    });
    // A column the listing does not have, or anything the listing cannot type, goes to the engine.
    await service().preview(
      {
        name: 'x',
        source: {
          kind: 'sql',
          dataSourceId: 'athena-1',
          sql: 'select nope from published_prod.dim_customer',
        },
      },
      auth
    );
    expect(athena.querySchema).toHaveBeenCalledTimes(1);
  });

  it("says Athena's reason when the query cannot be planned, and asks for declared columns elsewhere", async () => {
    athena.querySchema.mockRejectedValue(new Error('SYNTAX_ERROR: line 1:8: mismatched input'));
    await expect(
      service().preview({
        name: 'x',
        source: { kind: 'sql', dataSourceId: 'athena-1', sql: 'selec 1' },
      })
    ).rejects.toThrow(
      'Athena (workgroup analytics) could not run the query to read its columns: SYNTAX_ERROR'
    );
    await expect(
      service().preview({ name: 'x', source: { kind: 'sql', dataSourceId: 'rs', sql: 'select 1' } })
    ).rejects.toThrow("'Redshift' is a REDSHIFT data source: declare columns");
    await expect(
      service().preview({
        name: 'x',
        source: { kind: 'sql', dataSourceId: 'nope', sql: 'select 1' },
      })
    ).rejects.toThrow("not one of this account's data sources");
    expect(quickSight.createDataSet).not.toHaveBeenCalled();
  });

  it('takes declared columns as they are, for any engine, without asking Athena', async () => {
    const preview = await service().preview({
      name: 'Warehouse orders',
      source: { kind: 'table', dataSourceId: 'rs', schema: 'public', table: 'orders' },
      columns: [{ name: 'id', type: 'INTEGER' }],
    });
    expect(athena.querySchema).not.toHaveBeenCalled();
    expect(preview).toMatchObject({
      table: {
        kind: 'CUSTOM_SQL',
        name: 'Warehouse orders',
        sql: 'SELECT * FROM "public"."orders"',
      },
      columns: [{ name: 'id', type: 'INTEGER' }],
      columnsFrom: 'declared',
      similar: [],
    });
    expect(preview.table.catalog).toBeUndefined();
    expect(preview.listing).toBeUndefined();
  });

  it('builds over a listing with its own columns, through the Athena source the governed datasets use', async () => {
    const preview = await service()
      .preview({ name: '', source: { kind: 'listing', listingId: 'l-cust' } })
      .catch((e) => e);
    expect(preview.message).toBe('A name is required');
    const built = await service().preview({
      name: 'Customers v2',
      source: { kind: 'listing', listingId: 'l-cust' },
    });
    // Read as a select-all query, still typed from the listing and linked to it.
    expect(built).toMatchObject({
      dataSource: { id: 'athena-1' },
      table: {
        kind: 'CUSTOM_SQL',
        name: 'Customers v2',
        sql: 'SELECT * FROM "published_prod"."dim_customer"',
      },
      columns: [
        { name: 'customer_id', type: 'INTEGER' },
        { name: 'signed_up', type: 'DATETIME' },
      ],
      columnsFrom: 'listing',
      listing: { listingId: 'l-cust' },
    });
    expect(
      (
        await service().preview({
          name: 'Customers as table',
          source: { kind: 'listing', listingId: 'l-cust', asTable: true },
        })
      ).table
    ).toEqual({
      kind: 'RELATIONAL',
      catalog: 'AwsDataCatalog',
      schema: 'published_prod',
      name: 'dim_customer',
    });
    await expect(
      service().preview({ name: 'x', source: { kind: 'listing', listingId: 'nope' } })
    ).rejects.toThrow("No published asset with listing id 'nope'");
    await expect(
      service(false).preview({ name: 'x', source: { kind: 'listing', listingId: 'nope' } })
    ).rejects.toThrow('SMUS is not configured');
  });

  it('creates exactly what the preview settled, owned by the person, filed and tagged', async () => {
    settings['authoring.defaultFolderIds'] = ['f-default'];
    rebind.permissionsOf.mockResolvedValue([
      { Principal: 'arn:user/ana', Actions: ['quicksight:UpdateDashboard'] },
      { Principal: 'arn:group/viewers', Actions: ['quicksight:DescribeDashboard'] },
    ]);
    const result = await service().create(
      {
        name: 'Signups by month',
        importMode: 'SPICE',
        source: { kind: 'sql', dataSourceId: 'athena-1', sql: 'select 1 as customer_id' },
        permissionsFrom: { assetType: 'dashboard', assetId: 'd1' },
        folderId: 'f-shared',
        tags: [{ key: 'env', value: 'prod' }],
        newDataSetId: 'ds-new',
      },
      auth
    );
    const call = quickSight.createDataSet.mock.calls[0]![0];
    expect(call).toMatchObject({
      dataSetId: 'ds-new',
      name: 'Signups by month',
      importMode: 'SPICE',
    });
    const physical = Object.values(call.physicalTableMap)[0] as any;
    expect(physical.CustomSql).toEqual({
      DataSourceArn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/athena-1',
      Name: 'Signups by month',
      SqlQuery: 'select 1 as customer_id',
      // Every column carries an id: the new experience refuses one without.
      Columns: [
        { Id: expect.any(String), Name: 'customer_id', Type: 'INTEGER' },
        { Id: expect.any(String), Name: 'signups', Type: 'INTEGER' },
        { Id: expect.any(String), Name: 'month', Type: 'DATETIME' },
      ],
    });
    // An analysis reads the pipeline: the table imported and every column
    // projected, in the new data prep experience, never the legacy map.
    const [physicalTableId] = Object.keys(call.physicalTableMap);
    expect(call.logicalTableMap).toBeUndefined();
    const prep = call.dataPrepConfiguration;
    const [sourceId] = Object.keys(prep.SourceTableMap);
    expect(prep.SourceTableMap[sourceId!]).toEqual({ PhysicalTableId: physicalTableId });
    const steps = Object.entries(prep.TransformStepMap) as Array<[string, any]>;
    expect(steps.map(([, s]) => Object.keys(s)[0])).toEqual(['ImportTableStep', 'ProjectStep']);
    expect(steps[1]![1].ProjectStep.ProjectedColumns).toEqual(['customer_id', 'signups', 'month']);
    expect(Object.values(prep.DestinationTableMap)).toEqual([
      { Alias: 'Signups by month', Source: { TransformOperationId: steps[1]![0] } },
    ]);
    expect(Object.values(call.semanticModelConfiguration.TableMap)).toEqual([
      { Alias: 'Signups by month', DestinationTableId: Object.keys(prep.DestinationTableMap)[0] },
    ]);
    // The dashboard's owners own it, its viewers read it, and the person owns it.
    const principals = Object.fromEntries(
      call.permissions.map((p: any) => [p.Principal, p.Actions])
    );
    expect(principals['arn:user/ana']).toContain('quicksight:UpdateDataSet');
    expect(principals['arn:group/viewers']).not.toContain('quicksight:UpdateDataSet');
    expect(principals['arn:user/rob']).toContain('quicksight:DeleteDataSet');
    expect(call.tags).toEqual(
      expect.arrayContaining([
        { key: 'env', value: 'prod' },
        { key: 'portal:authored-by', value: 'user:rob@example.com' },
      ])
    );
    expect(quickSight.createFolderMembership.mock.calls.map((c) => c.slice(0, 3))).toEqual([
      ['f-shared', 'new', 'DATASET'],
      ['f-default', 'new', 'DATASET'],
    ]);
    expect(result).toMatchObject({
      assetType: 'dataset',
      assetId: 'new',
      arn: 'arn:ds/new',
      folderIds: ['f-shared', 'f-default'],
      owner: 'rob',
    });
  });

  it('holds a new dataset in SPICE unless the request or Settings says direct query, and names the first import', async () => {
    quickSight.createDataSet.mockResolvedValue({
      arn: 'arn:ds/new',
      dataSetId: 'new',
      ingestionArn: 'arn:aws:quicksight:us-east-1:1:dataset/new/ingestion/ing-1',
    });
    const request = {
      name: 'Signups',
      source: { kind: 'sql' as const, dataSourceId: 'athena-1', sql: 'select 1 as customer_id' },
    };
    expect((await service().preview(request, auth)).importMode).toBe('SPICE');
    const created = await service().create(request, auth);
    expect(quickSight.createDataSet.mock.calls[0]![0].importMode).toBe('SPICE');
    expect(created.ingestionId).toBe('ing-1');

    settings['authoring.datasetImportMode'] = 'DIRECT_QUERY';
    expect((await service().preview(request, auth)).importMode).toBe('DIRECT_QUERY');
    expect((await service().preview({ ...request, importMode: 'SPICE' }, auth)).importMode).toBe(
      'SPICE'
    );
  });

  it('warns when nothing gives the dataset an audience', async () => {
    owner.mockResolvedValue(undefined);
    const preview = await service().preview(
      { name: 'x', source: { kind: 'sql', dataSourceId: 'athena-1', sql: 'select 1' } },
      auth
    );
    expect(preview.folderIds).toEqual([]);
    expect(preview.warnings.join('\n')).toContain('Only account admins will see this');
  });
});
