import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatasetSourceService } from '../DatasetSourceService';

const mocks = vi.hoisted(() => ({
  qs: {
    describeDataset: vi.fn(),
    updateDataSet: vi.fn(),
  },
  cache: {
    getCacheEntries: vi.fn(),
    updateAsset: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => mocks.qs },
}));

vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: mocks.cache,
}));

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SOURCE_A = 'arn:aws:quicksight:us-east-1:1:datasource/athena-a';
const SOURCE_B = 'arn:aws:quicksight:us-east-1:1:datasource/athena-b';

/** A dataset with one relational table and one custom SQL table. */
const describeResponse = () => ({
  Name: 'orders_fact',
  ImportMode: 'SPICE',
  PhysicalTableMap: {
    't-rel': {
      RelationalTable: {
        DataSourceArn: SOURCE_A,
        Catalog: 'AwsDataCatalog',
        Schema: 'analytics_dev',
        Name: 'orders',
        InputColumns: [{ Name: 'id', Type: 'STRING' }],
      },
    },
    't-sql': {
      CustomSql: {
        DataSourceArn: SOURCE_A,
        Name: 'revenue_calc',
        SqlQuery: 'SELECT 1',
        Columns: [{ Name: 'total', Type: 'DECIMAL' }],
      },
    },
  },
  LogicalTableMap: { l1: { Alias: 'orders' } },
  ColumnGroups: [{ GeoSpatialColumnGroup: {} }],
});

describe('DatasetSourceService', () => {
  let service: DatasetSourceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qs.describeDataset.mockResolvedValue(describeResponse());
    mocks.qs.updateDataSet.mockResolvedValue({ arn: 'a', dataSetId: 'ds-1' });
    mocks.cache.getCacheEntries.mockResolvedValue([
      { assetId: 'athena-a', assetName: 'Athena A', arn: SOURCE_A, metadata: {} },
      { assetId: 'athena-b', assetName: 'Athena B', arn: SOURCE_B, metadata: {} },
    ]);
    service = new DatasetSourceService('1');
  });

  describe('getSource', () => {
    it('flattens each physical table for editing', async () => {
      const source = await service.getSource('ds-1');

      expect(source.name).toBe('orders_fact');
      expect(source.tables).toEqual([
        {
          id: 't-rel',
          kind: 'RELATIONAL',
          dataSourceArn: SOURCE_A,
          name: 'orders',
          catalog: 'AwsDataCatalog',
          schema: 'analytics_dev',
          columnCount: 1,
          editable: true,
        },
        {
          id: 't-sql',
          kind: 'CUSTOM_SQL',
          dataSourceArn: SOURCE_A,
          name: 'revenue_calc',
          sqlQuery: 'SELECT 1',
          columnCount: 1,
          editable: true,
        },
      ]);
    });

    it('reports an S3 table as not editable rather than hiding it', async () => {
      mocks.qs.describeDataset.mockResolvedValue({
        Name: 'uploads',
        ImportMode: 'SPICE',
        PhysicalTableMap: {
          s3: { S3Source: { DataSourceArn: SOURCE_A, InputColumns: [{ Name: 'a' }] } },
        },
      });

      const [table] = (await service.getSource('ds-1')).tables;
      expect(table).toMatchObject({ kind: 'S3', editable: false });
    });

    it('explains that flat-file datasets cannot be described', async () => {
      mocks.qs.describeDataset.mockResolvedValue({ Name: 'upload', ImportMode: 'SPICE' });
      await expect(service.getSource('ds-1')).rejects.toThrow(/flat file/i);
    });
  });

  describe('updateSource', () => {
    it('changes a relational schema and resends everything else untouched', async () => {
      await service.updateSource('ds-1', {
        tables: [{ id: 't-rel', schema: 'analytics_prod' }],
      });

      const sent = mocks.qs.updateDataSet.mock.calls[0]![0];
      expect(sent.physicalTableMap['t-rel'].RelationalTable).toEqual({
        DataSourceArn: SOURCE_A,
        Catalog: 'AwsDataCatalog',
        Schema: 'analytics_prod',
        Name: 'orders',
        // Columns are deliberately preserved: logical tables and every
        // downstream dashboard reference these names.
        InputColumns: [{ Name: 'id', Type: 'STRING' }],
      });
      expect(sent.logicalTableMap).toEqual({ l1: { Alias: 'orders' } });
      expect(sent.columnGroups).toEqual([{ GeoSpatialColumnGroup: {} }]);
      expect(sent.name).toBe('orders_fact');
    });

    it('edits custom SQL without touching its columns', async () => {
      await service.updateSource('ds-1', {
        tables: [{ id: 't-sql', sqlQuery: '  SELECT 2  ' }],
      });

      const sent = mocks.qs.updateDataSet.mock.calls[0]![0];
      expect(sent.physicalTableMap['t-sql'].CustomSql).toEqual({
        DataSourceArn: SOURCE_A,
        Name: 'revenue_calc',
        SqlQuery: 'SELECT 2',
        Columns: [{ Name: 'total', Type: 'DECIMAL' }],
      });
    });

    it('repoints a table at another data source', async () => {
      await service.updateSource('ds-1', {
        tables: [{ id: 't-rel', dataSourceArn: SOURCE_B }],
      });

      const sent = mocks.qs.updateDataSet.mock.calls[0]![0];
      expect(sent.physicalTableMap['t-rel'].RelationalTable.DataSourceArn).toBe(SOURCE_B);
    });

    it("rejects a data source ARN that is not one of the account's", async () => {
      await expect(
        service.updateSource('ds-1', {
          tables: [{ id: 't-rel', dataSourceArn: 'arn:aws:quicksight:::datasource/made-up' }],
        })
      ).rejects.toThrow(/not one of this account/i);
      expect(mocks.qs.updateDataSet).not.toHaveBeenCalled();
    });

    it('refuses SQL on a relational table', async () => {
      await expect(
        service.updateSource('ds-1', { tables: [{ id: 't-rel', sqlQuery: 'SELECT 1' }] })
      ).rejects.toThrow(/relational table/i);
    });

    it('refuses a schema change on custom SQL', async () => {
      await expect(
        service.updateSource('ds-1', { tables: [{ id: 't-sql', schema: 'x' }] })
      ).rejects.toThrow(/custom SQL/i);
    });

    it('refuses an unknown physical table', async () => {
      await expect(
        service.updateSource('ds-1', { tables: [{ id: 'nope', schema: 'x' }] })
      ).rejects.toThrow(/no physical table/i);
    });

    it('refuses empty SQL', async () => {
      await expect(
        service.updateSource('ds-1', { tables: [{ id: 't-sql', sqlQuery: '   ' }] })
      ).rejects.toThrow(/cannot be empty/i);
    });

    it('drops the catalog when cleared rather than sending an empty string', async () => {
      await service.updateSource('ds-1', { tables: [{ id: 't-rel', catalog: '  ' }] });

      const sent = mocks.qs.updateDataSet.mock.calls[0]![0];
      expect(sent.physicalTableMap['t-rel'].RelationalTable).not.toHaveProperty('Catalog');
    });

    it('renames the dataset and refreshes the cached name', async () => {
      const result = await service.updateSource('ds-1', { name: '  orders_fact_v2 ' });

      expect(mocks.qs.updateDataSet.mock.calls[0]![0].name).toBe('orders_fact_v2');
      expect(mocks.cache.updateAsset).toHaveBeenCalledWith('dataset', 'ds-1', {
        assetName: 'orders_fact_v2',
      });
      expect(result.name).toBe('orders_fact_v2');
    });

    it('does not touch the cache when the name is unchanged', async () => {
      await service.updateSource('ds-1', { tables: [{ id: 't-rel', schema: 'other' }] });
      expect(mocks.cache.updateAsset).not.toHaveBeenCalled();
    });

    it('leaves the live dataset alone if any edit is invalid', async () => {
      await expect(
        service.updateSource('ds-1', {
          tables: [
            { id: 't-rel', schema: 'analytics_prod' },
            { id: 't-sql', schema: 'not allowed here' },
          ],
        })
      ).rejects.toThrow();
      expect(mocks.qs.updateDataSet).not.toHaveBeenCalled();
    });
  });

  describe('listDataSourceOptions', () => {
    it('returns the account data sources sorted by name', async () => {
      mocks.cache.getCacheEntries.mockResolvedValue([
        { assetId: 'b', assetName: 'Zeta', arn: SOURCE_B, metadata: { dataSourceType: 'ATHENA' } },
        { assetId: 'a', assetName: 'Alpha', arn: SOURCE_A, metadata: {} },
      ]);

      const options = await service.listDataSourceOptions();
      expect(options.map((o) => o.name)).toEqual(['Alpha', 'Zeta']);
      expect(options[1]!).toMatchObject({ arn: SOURCE_B, type: 'ATHENA' });
    });

    it('skips entries with no ARN, which could never be selected', async () => {
      mocks.cache.getCacheEntries.mockResolvedValue([
        { assetId: 'a', assetName: 'No arn', arn: '', metadata: {} },
      ]);
      expect(await service.listDataSourceOptions()).toEqual([]);
    });
  });
});
