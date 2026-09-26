import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssetRestoreService } from '../AssetRestoreService';

const mocks = vi.hoisted(() => ({
  archive: { getArchivedAsset: vi.fn(), markRestored: vi.fn() },
  live: vi.fn(),
  owner: vi.fn(),
  freshness: vi.fn(),
}));

vi.mock('../../../../shared/services/archive/ArchiveService', () => ({
  ArchiveService: vi.fn(function () {
    return mocks.archive;
  }),
}));
vi.mock('../../../../shared/services/cache/CacheService', () => ({ cacheService: {} }));
vi.mock('../../../../shared/services/cache/assetFreshness', () => ({
  keepCacheFresh: mocks.freshness,
}));
vi.mock('../../../../shared/services/identity/livePrincipals', () => ({
  keepLivePrincipals: mocks.live,
}));
vi.mock('../../../../shared/services/identity/IdentityResolver', () => ({
  quickSightUserFor: mocks.owner,
}));
vi.mock('../../../../shared/services/audit/AuditLog', () => ({
  actorFromAuth: () => ({ actor: {}, channel: 'ui' }),
  auditLog: { record: vi.fn() },
}));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const notFound = () => Object.assign(new Error('nope'), { name: 'ResourceNotFoundException' });
const SRC_ARN = 'arn:aws:quicksight:us-east-1:1:datasource/athena-main';
const ANN = 'arn:aws:quicksight:us-east-1:1:user/default/ann';

function datasetRecord(described: Record<string, any> | null = {}) {
  return {
    apiResponses: {
      list: { data: { Name: 'orders' } },
      describe: {
        data: described && {
          Name: 'orders',
          ImportMode: 'SPICE',
          PhysicalTableMap: {
            t1: { RelationalTable: { DataSourceArn: SRC_ARN, Name: 'orders', InputColumns: [] } },
          },
          DataPrepConfiguration: { SourceTableMap: {} },
          ...described,
        },
      },
      permissions: { data: [{ Principal: ANN, Actions: ['quicksight:DescribeDataSet'] }] },
      tags: { data: [{ key: 'team', value: 'sales' }] },
      refreshSchedules: {
        data: [{ ScheduleId: 'nightly', Arn: 'arn:x', RefreshType: 'FULL_REFRESH' }],
      },
    },
  };
}

describe('AssetRestoreService', () => {
  const quickSight = {
    describeDataset: vi.fn(),
    describeDatasource: vi.fn(),
    createDataSet: vi.fn(),
    createDataSource: vi.fn(),
    createRefreshSchedule: vi.fn(),
  };
  let service: AssetRestoreService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.getArchivedAsset.mockResolvedValue(datasetRecord());
    mocks.live.mockImplementation(async (permissions: any[]) => ({
      permissions,
      dropped: [],
      warnings: [],
    }));
    mocks.owner.mockResolvedValue({ userName: 'rob', arn: 'arn:user/rob' });
    quickSight.describeDataset.mockRejectedValue(notFound());
    quickSight.describeDatasource.mockResolvedValue({ DataSourceId: 'athena-main' });
    quickSight.createDataSet.mockResolvedValue({ arn: 'arn:dataset/orders', dataSetId: 'orders' });
    service = new AssetRestoreService(quickSight as any);
  });

  it('can restore a dataset whose id is free and whose data source still exists', async () => {
    const preview = await service.preview('dataset', 'orders');
    expect(preview.canRestore).toBe(true);
    expect(preview.checks.map((c) => c.label)).toEqual([
      'Archived definition',
      'Id',
      'Data source athena-main',
      'Audience',
    ]);
  });

  it('blocks on a data source that is gone, or an id that is taken', async () => {
    quickSight.describeDatasource.mockRejectedValue(notFound());
    expect((await service.preview('dataset', 'orders')).canRestore).toBe(false);

    quickSight.describeDatasource.mockResolvedValue({});
    quickSight.describeDataset.mockResolvedValue({ DataSetId: 'orders' });
    const taken = await service.preview('dataset', 'orders');
    expect(taken.canRestore).toBe(false);
    expect(taken.checks.find((c) => c.label === 'Id')?.detail).toContain('new id');
    await expect(service.restore('dataset', 'orders', {})).rejects.toThrow('cannot be restored');
  });

  it('creates the dataset with its data prep, audience plus owner, tags and schedules', async () => {
    const result = await service.restore(
      'dataset',
      'orders',
      {},
      { userId: 'u', accountId: '1', email: 'rob@example.com' }
    );

    const call = quickSight.createDataSet.mock.calls[0]?.[0];
    expect(call.dataSetId).toBe('orders');
    expect(call.dataPrepConfiguration).toEqual({ SourceTableMap: {} });
    expect(call.permissions.map((p: any) => p.Principal)).toEqual([ANN, 'arn:user/rob']);
    expect(call.tags).toEqual([{ key: 'team', value: 'sales' }]);
    expect(quickSight.createRefreshSchedule).toHaveBeenCalledWith('orders', {
      ScheduleId: 'nightly',
      RefreshType: 'FULL_REFRESH',
    });
    expect(mocks.archive.markRestored).toHaveBeenCalledWith(
      'dataset',
      'orders',
      expect.objectContaining({ restoredAs: 'orders', restoredBy: 'rob@example.com' })
    );
    expect(mocks.freshness).toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
  });

  it('will not restore an uploaded file, or a data source that needs a password', async () => {
    mocks.archive.getArchivedAsset.mockResolvedValue(datasetRecord(null));
    expect((await service.preview('dataset', 'orders')).checks[0]?.ok).toBe(false);

    mocks.archive.getArchivedAsset.mockResolvedValue({
      apiResponses: { describe: { data: { Name: 'warehouse', Type: 'POSTGRESQL' } } },
    });
    quickSight.describeDatasource.mockRejectedValue(notFound());
    const preview = await service.preview('datasource', 'warehouse');
    expect(preview.canRestore).toBe(false);
    expect(preview.checks.find((c) => c.label === 'Credentials')?.detail).toContain('password');
  });
});
