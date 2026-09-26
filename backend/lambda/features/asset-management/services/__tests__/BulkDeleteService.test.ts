import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BulkDeleteService } from '../BulkDeleteService';

const mocks = vi.hoisted(() => ({
  archive: {
    keepCopy: vi.fn(),
    finishArchive: vi.fn(),
    abandonArchive: vi.fn(),
    archiveAssetsBulk: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/archive/ArchiveService', () => ({
  ArchiveService: vi.fn(function () {
    return mocks.archive;
  }),
}));
vi.mock('../../../../shared/services/cache/CacheService', () => ({ cacheService: {} }));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('BulkDeleteService', () => {
  const quickSight = {
    deleteAnalysis: vi.fn(),
    deleteDashboard: vi.fn(),
    deleteDataset: vi.fn(),
    deleteDatasource: vi.fn(),
  };
  const refresh = vi.fn();
  let service: BulkDeleteService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.keepCopy.mockResolvedValue({ kept: true, replaced: null });
    refresh.mockResolvedValue({ refreshed: ['dashboard:d1'], missing: [], failed: [] });
    service = new BulkDeleteService(quickSight as any, refresh);
  });

  const del = (assets: Array<{ type: any; id: string }>) =>
    service.deleteAssets({ assets, reason: 'tidy', deletedBy: 'rob@example.com' });

  it('re-exports, keeps a copy, deletes, then finishes the archive', async () => {
    const order: string[] = [];
    refresh.mockImplementation(async () => {
      order.push('refresh');
      return { refreshed: [], missing: [], failed: [] };
    });
    mocks.archive.keepCopy.mockImplementation(async () => {
      order.push('keep');
      return { kept: true, replaced: null };
    });
    quickSight.deleteDashboard.mockImplementation(async () => order.push('delete'));
    mocks.archive.finishArchive.mockImplementation(async () => order.push('finish'));

    const result = await del([{ type: 'dashboard', id: 'd1' }]);

    expect(order).toEqual(['refresh', 'keep', 'delete', 'finish']);
    expect(refresh).toHaveBeenCalledWith([{ assetType: 'dashboard', assetId: 'd1' }]);
    expect(result.deleted.total).toBe(1);
    expect(result.archived.total).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('does not delete what it could not keep a copy of', async () => {
    mocks.archive.keepCopy.mockResolvedValue({ kept: false, error: 'no export of it' });

    const result = await del([{ type: 'analysis', id: 'a1' }]);

    expect(quickSight.deleteAnalysis).not.toHaveBeenCalled();
    expect(result.deleted.total).toBe(0);
    expect(result.errors[0]?.error).toBe('Not deleted: no export of it');
  });

  it('puts the archive back when QuickSight refuses the delete', async () => {
    const earlier = { archivedMetadata: { archivedAt: '2026-01-01' } };
    mocks.archive.keepCopy.mockResolvedValue({ kept: true, replaced: earlier });
    quickSight.deleteDataset.mockRejectedValue(new Error('AccessDenied'));

    const result = await del([{ type: 'dataset', id: 'ds1' }]);

    expect(mocks.archive.abandonArchive).toHaveBeenCalledWith('dataset', 'ds1', earlier);
    expect(mocks.archive.finishArchive).not.toHaveBeenCalled();
    expect(result.deleted.total).toBe(0);
    expect(result.archived.total).toBe(0);
  });

  it('still deletes on the last export when the re-export fails', async () => {
    refresh.mockRejectedValue(new Error('throttled'));
    const result = await del([{ type: 'datasource', id: 'src1' }]);
    expect(quickSight.deleteDatasource).toHaveBeenCalledWith('src1');
    expect(result.archived.total).toBe(1);
  });
});
