import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatasetFieldService } from '../DatasetFieldService';
import type { RebindService } from '../RebindService';

const mocks = vi.hoisted(() => ({
  qs: {
    describeDataset: vi.fn(),
    updateDataSet: vi.fn(),
    listIngestions: vi.fn(),
  },
  freshness: vi.fn(),
}));

vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => mocks.qs },
}));
vi.mock('../../../../shared/services/catalog/assetFreshness', () => ({
  keepCatalogFresh: mocks.freshness,
}));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const described = () => ({
  Name: 'orders',
  ImportMode: 'SPICE',
  PhysicalTableMap: { p1: { RelationalTable: { Name: 'orders', InputColumns: [] } } },
  LogicalTableMap: {
    l1: {
      Alias: 'orders',
      Source: { PhysicalTableId: 'p1' },
      DataTransforms: [
        {
          CreateColumnsOperation: {
            Columns: [
              { ColumnName: 'Margin', ColumnId: 'c1', Expression: '{revenue} - {cost}' },
              { ColumnName: 'c_ds_margin', ColumnId: 'c9', Expression: '{revenue} - {cost}' },
            ],
          },
        },
      ],
    },
  },
  RowLevelPermissionDataSet: { Arn: 'arn:rls', PermissionPolicy: 'GRANT_ACCESS' },
  OutputColumns: [{ Name: 'Margin' }, { Name: 'c_ds_margin' }],
});

/** Lineage: one dashboard and one archived analysis use the dataset. */
const lineage = {
  getLineageMapForAssets: vi.fn(
    async () =>
      new Map([
        [
          'dataset:ds1',
          {
            relationships: [
              {
                relationshipType: 'used_by',
                targetAssetType: 'dashboard',
                targetAssetId: 'd1',
                targetAssetName: 'Pipeline',
              },
              {
                relationshipType: 'used_by',
                targetAssetType: 'analysis',
                targetAssetId: 'a-old',
                targetAssetName: 'Gone',
                targetIsArchived: true,
              },
            ],
          },
        ],
      ])
  ),
};

function service(readsMargin: boolean | 'unreadable') {
  const rebind = {
    describeDatasets: vi.fn(async () => {
      if (readsMargin === 'unreadable') throw new Error('AccessDenied');
      return {
        name: 'Pipeline',
        datasets: [
          {
            identifier: 'orders',
            dataSetId: 'ds1',
            columns: [{ name: readsMargin ? 'Margin' : 'c_ds_margin', usage: {} }],
          },
        ],
      };
    }),
  } as unknown as RebindService;
  return { svc: new DatasetFieldService('1', rebind, lineage as never), rebind };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.qs.describeDataset.mockResolvedValue(described());
  mocks.qs.listIngestions.mockResolvedValue({
    ingestions: [
      { IngestionStatus: 'FAILED', CreatedTime: '2026-09-01' },
      { IngestionStatus: 'COMPLETED', CreatedTime: '2026-09-02' },
    ],
  });
});

describe('DatasetFieldService', () => {
  it('lists fields with their live readers, skipping archived dependents, and the latest refresh', async () => {
    const { svc, rebind } = service(true);
    const result = await svc.fields('ds1', { readers: true });
    expect(result).toMatchObject({
      shape: 'legacy',
      importMode: 'SPICE',
      latestRefresh: 'completed',
    });
    expect(result.fields.find((f) => f.name === 'Margin')!.readers).toEqual([
      { assetType: 'dashboard', assetId: 'd1', name: 'Pipeline', identifier: 'orders' },
    ]);
    expect(result.fields.find((f) => f.name === 'c_ds_margin')!.readers).toEqual([]);
    expect(rebind.describeDatasets).toHaveBeenCalledTimes(1);
  });

  it('refuses to retire a name a dashboard still reads, and writes nothing', async () => {
    const { svc } = service(true);
    await expect(
      svc.apply('ds1', [{ op: 'retireCalculatedField', name: 'Margin', replacedBy: 'c_ds_margin' }])
    ).rejects.toThrow('Margin is read by dashboard Pipeline');
    expect(mocks.qs.updateDataSet).not.toHaveBeenCalled();
  });

  it('refuses to retire when a reader cannot be read', async () => {
    const { svc } = service('unreadable');
    await expect(
      svc.apply('ds1', [{ op: 'retireCalculatedField', name: 'Margin', replacedBy: 'c_ds_margin' }])
    ).rejects.toThrow('Could not check dashboard Pipeline');
  });

  it('retires once nothing reads it, resending everything else as described', async () => {
    const { svc } = service(false);
    const dry = await svc.apply(
      'ds1',
      [{ op: 'retireCalculatedField', name: 'Margin', replacedBy: 'c_ds_margin' }],
      { dryRun: true }
    );
    expect(dry.written).toBe(false);
    expect(mocks.qs.updateDataSet).not.toHaveBeenCalled();

    const done = await svc.apply('ds1', [
      { op: 'retireCalculatedField', name: 'Margin', replacedBy: 'c_ds_margin' },
    ]);
    expect(done.written).toBe(true);
    const sent = mocks.qs.updateDataSet.mock.calls[0]![0];
    expect(
      sent.logicalTableMap.l1.DataTransforms[0].CreateColumnsOperation.Columns.map(
        (c: { ColumnName: string }) => c.ColumnName
      )
    ).toEqual(['c_ds_margin']);
    expect(sent.rowLevelPermissionDataSet).toEqual({
      Arn: 'arn:rls',
      PermissionPolicy: 'GRANT_ACCESS',
    });
    expect(mocks.freshness).toHaveBeenCalled();
  });

  it('a copy does not look downstream at all', async () => {
    const { svc, rebind } = service(true);
    await svc.apply('ds1', [{ op: 'copyCalculatedField', name: 'Margin', to: 'c_ds_margin2' }]);
    expect(rebind.describeDatasets).not.toHaveBeenCalled();
    expect(mocks.qs.updateDataSet).toHaveBeenCalledTimes(1);
  });
});
