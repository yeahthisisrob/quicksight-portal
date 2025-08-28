import { vi, type Mocked } from 'vitest';

import { type CacheService } from '../../../../shared/services/cache/CacheService';
import { logger } from '../../../../shared/utils/logger';
import { AssetComparisonService } from '../AssetComparisonService';

vi.mock('../../../../shared/utils/logger');

// eslint-disable-next-line max-lines-per-function
describe('AssetComparisonService', () => {
  let service: AssetComparisonService;
  let mockCacheService: Mocked<CacheService>;
  const MOCK_ASSETS_COUNT = 3;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock CacheService instance
    mockCacheService = {
      getTypeCache: vi.fn(),
      getMasterCache: vi.fn(),
      updateAsset: vi.fn(),
    } as unknown as Mocked<CacheService>;

    // Inject the mock into AssetComparisonService
    service = new AssetComparisonService(mockCacheService);
  });

  // eslint-disable-next-line max-lines-per-function
  describe('compareAndDetectChanges', () => {
    const mockAssets: any[] = [
      { id: 'asset1', name: 'Asset 1', lastModified: '2025-01-15T10:00:00Z' },
      { id: 'asset2', name: 'Asset 2', lastModified: '2025-01-15T11:00:00Z' },
      { id: 'asset3', name: 'Asset 3', lastModified: undefined },
    ];

    const mockCachedEntries: any[] = [
      { assetId: 'asset1', assetName: 'Asset 1', lastUpdatedTime: '2025-01-15T09:00:00Z' },
      { assetId: 'asset2', assetName: 'Asset 2', lastUpdatedTime: '2025-01-15T11:00:00Z' },
    ];

    describe('with forceRefresh', () => {
      it('should mark all assets as needing update', async () => {
        // Mock getMasterCache for deletion detection
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { dashboard: [] },
        } as any);
        const result = await service.compareAndDetectChanges(
          'dashboard',
          mockAssets,
          [],
          true // forceRefresh
        );

        expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
        expect(result.needsUpdate.has('asset1')).toBe(true);
        expect(result.needsUpdate.has('asset2')).toBe(true);
        expect(result.needsUpdate.has('asset3')).toBe(true);
        expect(result.unchanged.size).toBe(0);
      });
    });

    describe('organizational assets', () => {
      it('should always mark users as needing update', async () => {
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { user: [] },
        } as any);
        mockCacheService.getTypeCache.mockResolvedValue(mockCachedEntries);

        const result = await service.compareAndDetectChanges('user', mockAssets, [], false);

        expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
        expect(result.unchanged.size).toBe(0);
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('always refresh (organizational asset)')
        );
      });

      it('should always mark groups as needing update', async () => {
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { group: [] },
        } as any);
        mockCacheService.getTypeCache.mockResolvedValue(mockCachedEntries);

        const result = await service.compareAndDetectChanges('group', mockAssets, [], false);

        expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
        expect(result.unchanged.size).toBe(0);
      });

      it('should always mark folders as needing update', async () => {
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { folder: [] },
        } as any);
        mockCacheService.getTypeCache.mockResolvedValue(mockCachedEntries);

        const result = await service.compareAndDetectChanges('folder', mockAssets, [], false);

        expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
        expect(result.unchanged.size).toBe(0);
      });
    });

    describe('regular assets with timestamps', () => {
      it('should detect updated assets based on timestamps', async () => {
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { dashboard: mockCachedEntries },
        } as any);
        mockCacheService.getTypeCache.mockResolvedValue(mockCachedEntries);

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        // asset1: lastModified (10:00) > cached (09:00) = needs update
        expect(result.needsUpdate.has('asset1')).toBe(true);
        // asset2: lastModified (11:00) = cached (11:00) = unchanged
        expect(result.unchanged.has('asset2')).toBe(true);
        // asset3: new asset not in cache = needs update
        expect(result.needsUpdate.has('asset3')).toBe(true);
      });

      it('should handle assets without timestamps', async () => {
        const assetsNoTimestamp: any[] = [{ id: 'asset1', name: 'Asset 1' }];
        const cacheNoTimestamp: any[] = [{ assetId: 'asset1', assetName: 'Asset 1' }];

        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { dashboard: cacheNoTimestamp },
        } as any);
        mockCacheService.getTypeCache.mockResolvedValue(cacheNoTimestamp);

        const result = await service.compareAndDetectChanges(
          'dashboard',
          assetsNoTimestamp,
          [],
          false
        );

        // Both have no timestamp = unchanged for non-organizational assets
        expect(result.unchanged.has('asset1')).toBe(true);
      });
    });

    describe('deleted assets', () => {
      it('should identify deleted assets and return them in deletedAssetIds', async () => {
        // Mock getMasterCache for deletion detection
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: {
            dashboard: [
              { assetId: 'deleted1', assetName: 'Deleted Asset', status: 'ACTIVE' },
              ...mockCachedEntries,
            ],
          },
        } as any);

        mockCacheService.getTypeCache.mockResolvedValue(mockCachedEntries);

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        // deleted1 is in cache but not in current assets, so should be detected as deleted
        expect(result.deletedAssetIds.has('deleted1')).toBe(true);
        expect(result.deletedAssetIds.size).toBe(1);

        // Should NOT update cache directly anymore - that's handled by ArchiveService
        expect(mockCacheService.updateAsset).not.toHaveBeenCalled();
      });

      it('should not mark already archived assets as deleted', async () => {
        // Mock getMasterCache for deletion detection
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: {
            dashboard: [
              { assetId: 'already-archived', assetName: 'Already Archived', status: 'archived' },
              ...mockCachedEntries,
            ],
          },
        } as any);

        mockCacheService.getTypeCache.mockResolvedValue(mockCachedEntries);

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        // already-archived should NOT be in deletedAssetIds since it's already archived
        expect(result.deletedAssetIds.has('already-archived')).toBe(false);
        expect(result.deletedAssetIds.size).toBe(0);
      });

      it('should handle soft-deleted analyses', async () => {
        const softDeletedAnalyses = [
          { AnalysisId: 'soft-deleted1', Name: 'Soft Deleted Analysis', Status: 'DELETED' },
        ];

        mockCacheService.getMasterCache.mockResolvedValue({
          entries: {
            analysis: [
              { assetId: 'soft-deleted1', assetName: 'Soft Deleted Analysis', status: 'ACTIVE' },
              ...mockCachedEntries,
            ],
          },
        } as any);

        mockCacheService.getTypeCache.mockResolvedValue(mockCachedEntries);

        const result = await service.compareAndDetectChanges(
          'analysis',
          mockAssets,
          softDeletedAnalyses,
          false
        );

        // soft-deleted1 should be in deletedAssetIds
        expect(result.deletedAssetIds.has('soft-deleted1')).toBe(true);
        expect(result.deletedAssetIds.size).toBe(1);
      });

      it('should handle multiple deleted assets', async () => {
        // Multiple assets in cache but none in current list
        const manyDeletedAssets = [
          { assetId: 'deleted1', assetName: 'Deleted 1', status: 'ACTIVE' },
          { assetId: 'deleted2', assetName: 'Deleted 2', status: 'ACTIVE' },
          { assetId: 'deleted3', assetName: 'Deleted 3', status: 'ACTIVE' },
        ];

        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { dashboard: manyDeletedAssets },
        } as any);

        mockCacheService.getTypeCache.mockResolvedValue([]);

        const result = await service.compareAndDetectChanges('dashboard', [], [], false);

        // All should be marked as deleted
        const EXPECTED_DELETED_COUNT = 3;
        expect(result.deletedAssetIds.size).toBe(EXPECTED_DELETED_COUNT);
        expect(result.deletedAssetIds.has('deleted1')).toBe(true);
        expect(result.deletedAssetIds.has('deleted2')).toBe(true);
        expect(result.deletedAssetIds.has('deleted3')).toBe(true);
      });

      it('should only detect active assets as deleted (not already archived)', async () => {
        const mixedStatusAssets = [
          { assetId: 'active1', assetName: 'Active 1', status: 'ACTIVE' },
          { assetId: 'archived1', assetName: 'Archived 1', status: 'archived' },
          { assetId: 'active2', assetName: 'Active 2', status: 'ACTIVE' },
        ];

        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { dashboard: mixedStatusAssets },
        } as any);

        mockCacheService.getTypeCache.mockResolvedValue([]);

        const result = await service.compareAndDetectChanges('dashboard', [], [], false);

        // Only active assets should be detected as deleted
        expect(result.deletedAssetIds.size).toBe(2);
        expect(result.deletedAssetIds.has('active1')).toBe(true);
        expect(result.deletedAssetIds.has('active2')).toBe(true);
        expect(result.deletedAssetIds.has('archived1')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty cache', async () => {
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { dashboard: [] },
        } as any);
        mockCacheService.getTypeCache.mockResolvedValue([]);

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        // All assets should need export when cache is empty
        expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
        expect(result.unchanged.size).toBe(0);
      });

      it('should handle null cache', async () => {
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { dashboard: [] },
        } as any);
        mockCacheService.getTypeCache.mockResolvedValue(null as any);

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        // All assets should need export when cache is null
        expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
        expect(result.unchanged.size).toBe(0);
      });

      it('should handle empty assets list', async () => {
        mockCacheService.getMasterCache.mockResolvedValue({
          entries: { dashboard: mockCachedEntries },
        } as any);
        mockCacheService.getTypeCache.mockResolvedValue(mockCachedEntries);

        const result = await service.compareAndDetectChanges('dashboard', [], [], false);

        expect(result.needsUpdate.size).toBe(0);
        expect(result.unchanged.size).toBe(0);
      });
    });
  });

  describe('detectDeletedAssets', () => {
    it('should return asset IDs that exist in cache but not in current list', async () => {
      const cachedAssets = [
        { assetId: 'asset1', assetName: 'Asset 1', status: 'ACTIVE' },
        { assetId: 'asset2', assetName: 'Asset 2', status: 'ACTIVE' },
        { assetId: 'deleted1', assetName: 'Deleted 1', status: 'ACTIVE' },
        { assetId: 'deleted2', assetName: 'Deleted 2', status: 'ACTIVE' },
      ];

      const currentAssets = [
        { id: 'asset1', name: 'Asset 1' },
        { id: 'asset2', name: 'Asset 2' },
      ];

      mockCacheService.getMasterCache.mockResolvedValue({
        entries: { dashboard: cachedAssets },
      } as any);

      const deletedIds = await service.detectDeletedAssets('dashboard', currentAssets, []);

      expect(deletedIds).toEqual(new Set(['deleted1', 'deleted2']));
      expect(deletedIds.size).toBe(2);
    });

    it('should include soft-deleted assets in deletion detection', async () => {
      const cachedAssets = [
        { assetId: 'asset1', assetName: 'Asset 1', status: 'ACTIVE' },
        { assetId: 'soft1', assetName: 'Soft 1', status: 'ACTIVE' },
      ];

      const currentAssets = [{ id: 'asset1', name: 'Asset 1' }];
      const softDeleted = [
        {
          analysisId: 'soft1',
          name: 'Soft 1',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/soft1',
          createdTime: new Date(),
          lastUpdatedTime: new Date(),
          status: 'DELETED',
        },
      ];

      mockCacheService.getMasterCache.mockResolvedValue({
        entries: { analysis: cachedAssets },
      } as any);

      const deletedIds = await service.detectDeletedAssets('analysis', currentAssets, softDeleted);

      expect(deletedIds).toEqual(new Set(['soft1']));
    });

    it('should not include already archived assets', async () => {
      const cachedAssets = [
        { assetId: 'active1', assetName: 'Active 1', status: 'ACTIVE' },
        { assetId: 'archived1', assetName: 'Archived 1', status: 'archived' },
        { assetId: 'deleted1', assetName: 'Deleted 1', status: 'ACTIVE' },
      ];

      const currentAssets = [{ id: 'active1', name: 'Active 1' }];

      mockCacheService.getMasterCache.mockResolvedValue({
        entries: { dashboard: cachedAssets },
      } as any);

      const deletedIds = await service.detectDeletedAssets('dashboard', currentAssets, []);

      expect(deletedIds).toEqual(new Set(['deleted1']));
      expect(deletedIds.has('archived1')).toBe(false);
    });

    it('should handle cache retrieval errors gracefully', async () => {
      mockCacheService.getMasterCache.mockRejectedValue(new Error('Cache error'));

      const deletedIds = await service.detectDeletedAssets('dashboard', [], []);

      expect(deletedIds).toEqual(new Set());
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to detect deleted dashboard assets:',
        expect.any(Error)
      );
    });

    it('should handle missing cache entries', async () => {
      mockCacheService.getMasterCache.mockResolvedValue({
        entries: {},
      } as any);

      const deletedIds = await service.detectDeletedAssets('dashboard', [], []);

      expect(deletedIds).toEqual(new Set());
    });
  });

  describe('integration scenarios', () => {
    it('should correctly handle a complete export cycle with deletions', async () => {
      // Simulate a scenario where assets are added, modified, and deleted
      const initialCache = [
        {
          assetId: 'unchanged1',
          assetName: 'Unchanged 1',
          lastUpdatedTime: '2025-01-01T10:00:00Z',
          status: 'ACTIVE',
        },
        {
          assetId: 'updated1',
          assetName: 'Updated 1',
          lastUpdatedTime: '2025-01-01T10:00:00Z',
          status: 'ACTIVE',
        },
        {
          assetId: 'deleted1',
          assetName: 'Deleted 1',
          lastUpdatedTime: '2025-01-01T10:00:00Z',
          status: 'ACTIVE',
        },
        {
          assetId: 'deleted2',
          assetName: 'Deleted 2',
          lastUpdatedTime: '2025-01-01T10:00:00Z',
          status: 'ACTIVE',
        },
      ];

      const currentAssets = [
        { id: 'unchanged1', name: 'Unchanged 1', lastModified: '2025-01-01T10:00:00Z' },
        { id: 'updated1', name: 'Updated 1', lastModified: '2025-01-02T10:00:00Z' },
        { id: 'new1', name: 'New 1', lastModified: '2025-01-02T10:00:00Z' },
      ];

      mockCacheService.getMasterCache.mockResolvedValue({
        entries: { dashboard: initialCache },
      } as any);
      mockCacheService.getTypeCache.mockResolvedValue(initialCache as any);

      const result = await service.compareAndDetectChanges(
        'dashboard',
        currentAssets as any,
        [],
        false
      );

      // Verify the complete state
      expect(result.unchanged.has('unchanged1')).toBe(true);
      expect(result.needsUpdate.has('updated1')).toBe(true);
      expect(result.needsUpdate.has('new1')).toBe(true);
      expect(result.deletedAssetIds.has('deleted1')).toBe(true);
      expect(result.deletedAssetIds.has('deleted2')).toBe(true);

      expect(result.unchanged.size).toBe(1);
      expect(result.needsUpdate.size).toBe(2);
      expect(result.deletedAssetIds.size).toBe(2);
    });

    it('should handle organizational assets with deletions correctly', async () => {
      const cachedFolders = [
        { assetId: 'folder1', assetName: 'Folder 1', status: 'ACTIVE' },
        { assetId: 'folder2', assetName: 'Folder 2', status: 'ACTIVE' },
        { assetId: 'deleted-folder', assetName: 'Deleted Folder', status: 'ACTIVE' },
      ];

      const currentFolders = [
        { id: 'folder1', name: 'Folder 1' },
        { id: 'folder2', name: 'Folder 2' },
      ];

      mockCacheService.getMasterCache.mockResolvedValue({
        entries: { folder: cachedFolders },
      } as any);
      mockCacheService.getTypeCache.mockResolvedValue(cachedFolders as any);

      const result = await service.compareAndDetectChanges(
        'folder',
        currentFolders as any,
        [],
        false
      );

      // Organizational assets always need update
      expect(result.needsUpdate.has('folder1')).toBe(true);
      expect(result.needsUpdate.has('folder2')).toBe(true);

      // But deletions should still be detected
      expect(result.deletedAssetIds.has('deleted-folder')).toBe(true);
      expect(result.deletedAssetIds.size).toBe(1);
    });
  });
});
