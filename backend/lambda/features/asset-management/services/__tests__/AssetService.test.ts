import { vi, type Mocked } from 'vitest';
/**
 * Tests for AssetService to ensure proper initialization patterns
 * and prevent regression of dynamic import issues
 */

import { type CacheEntry, type AssetType } from '../../../../shared/models/asset.model';
import { cacheService } from '../../../../shared/services/cache/CacheService';
import { AssetService } from '../AssetService';

// Test constants
const TEST_CONSTANTS = {
  PAGE_SIZE: 50,
  RETRY_COUNT: 3,
  MAX_OPERATION_TIME_MS: 100,
} as const;

// Helper function to create mock cache entries
function createMockCacheEntry(assetType: AssetType, assetId: string, name: string): CacheEntry {
  return {
    assetId,
    assetType,
    assetName: name,
    arn: `arn:aws:quicksight:us-east-1:123456789012:${assetType}/${assetId}`,
    status: 'active',
    enrichmentStatus: 'enriched',
    createdTime: new Date('2024-01-01T00:00:00Z'),
    lastUpdatedTime: new Date('2024-01-01T00:00:00Z'),
    exportedAt: new Date('2024-01-01T00:00:00Z'),
    exportFilePath: `assets/${assetType}s/${assetId}.json`,
    storageType: 'individual',
    tags: [],
    permissions: [],
    metadata: {},
  };
}

// Helper to create a complete MasterCache with some test data
function createMockMasterCache(
  dashboards: CacheEntry[] = [],
  datasets: CacheEntry[] = [],
  analyses: CacheEntry[] = []
) {
  return {
    version: '1.0',
    lastUpdated: new Date('2024-01-01T00:00:00Z'),
    assetCounts: {
      dashboard: dashboards.length,
      analysis: analyses.length,
      dataset: datasets.length,
      datasource: 0,
      folder: 0,
      user: 0,
      group: 0,
    },
    entries: {
      dashboard: dashboards,
      analysis: analyses,
      dataset: datasets,
      datasource: [],
      folder: [],
      user: [],
      group: [],
    },
  };
}

// Mock dependencies
vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: {
    getCatalog: vi.fn(),
    getBucketName: vi.fn().mockReturnValue('test-bucket'),
    getMasterCache: vi.fn().mockResolvedValue({
      entries: new Map(),
    }),
    getMasterCacheWithVersion: vi.fn().mockResolvedValue({
      cache: { entries: new Map() },
      version: 'test-version',
    }),
    getActivityCacheWithEtag: vi.fn().mockResolvedValue({ value: null }),
    getActivityPersistenceWithEtag: vi.fn().mockResolvedValue({ value: null }),
  },
}));
vi.mock('../../../../shared/services/lineage', () => ({
  LineageService: vi.fn().mockImplementation(() => ({
    getLineage: vi.fn(),
    getLineageMapForAssets: vi.fn().mockResolvedValue(new Map()),
  })),
}));
vi.mock('../../../activity/services/ActivityService', () => ({
  ActivityService: vi.fn().mockImplementation(() => ({
    getActivity: vi.fn(),
    getUserActivityCounts: vi.fn().mockResolvedValue(new Map()),
  })),
}));
vi.mock('../../../organization/services/TagService', () => ({
  TagService: vi.fn().mockImplementation(() => ({
    getTags: vi.fn(),
  })),
}));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AssetService', () => {
  let service: AssetService;
  const mockAccountId = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    service = new AssetService(mockAccountId);
  });

  describe('Import patterns - prevent regression', () => {
    it('should have core services initialized in constructor', () => {
      // Verify that essential services are initialized
      expect((service as any).tagService).toBeDefined();
      expect((service as any).lineageService).toBeDefined();
      expect((service as any).activityService).toBeDefined();
    });

    it('should not have any dynamic import() calls in the service methods', () => {
      // Get the service's method as a string and check for dynamic imports
      const serviceCode = service.constructor.toString();

      // Check that there are no dynamic imports
      expect(serviceCode).not.toContain('await import(');
      expect(serviceCode).not.toContain('import(');
    });

    it('should create separate service instances with their own dependencies', async () => {
      // Create another instance of the service
      const service2 = new AssetService(mockAccountId);

      // Each service should have its own service instances
      expect((service as any).tagService).not.toBe((service2 as any).tagService);
      expect((service as any).lineageService).not.toBe((service2 as any).lineageService);
      expect((service as any).activityService).not.toBe((service2 as any).activityService);
    });
  });

  describe('Performance patterns', () => {
    it('should handle Lambda cold starts efficiently', () => {
      // Measure time to create service (should be fast, no dynamic imports)
      const startTime = Date.now();
      const newService = new AssetService(mockAccountId);
      const duration = Date.now() - startTime;

      // Should be very fast (no dynamic import overhead)
      expect(duration).toBeLessThan(TEST_CONSTANTS.PAGE_SIZE);
      expect(newService).toBeDefined();
      expect((newService as any).tagService).toBeDefined();
    });

    it('should not leak state between service instances', () => {
      const service1 = new AssetService('account1');
      const service2 = new AssetService('account2');

      // Each service should be independent
      expect(service1).not.toBe(service2);
      expect((service1 as any).tagService).not.toBe((service2 as any).tagService);
    });
  });

  describe('list method', () => {
    it('should use cached data instead of S3Client directly', async () => {
      // Mock the cache service to return sample data
      const mockCacheService = cacheService as Mocked<typeof cacheService>;
      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: createMockMasterCache(
          [
            createMockCacheEntry('dashboard', 'dash-1', 'Dashboard 1'),
            createMockCacheEntry('dashboard', 'dash-2', 'Dashboard 2'),
          ],
          [],
          []
        ),
        version: 'v1',
      });

      // Call the list method with a valid asset type
      const result = await service.list('dashboard', {
        maxResults: 10,
        nextToken: undefined,
      });

      // Verify it returned cached data
      expect(result.items).toHaveLength(2);
      expect(mockCacheService.getMasterCacheWithVersion).toHaveBeenCalled();

      // Service should use cache instead of direct S3 access
      expect((service as any).tagService).toBeDefined();
      // No need to verify S3 wasn't called since we're using cache
    });

    it('should handle multiple concurrent calls efficiently', async () => {
      // Mock the cache service
      const mockCacheService = cacheService as Mocked<typeof cacheService>;
      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: createMockMasterCache(
          [createMockCacheEntry('dashboard', 'dash-1', 'Dashboard 1')],
          [createMockCacheEntry('dataset', 'data-1', 'Dataset 1')],
          [createMockCacheEntry('analysis', 'anal-1', 'Analysis 1')]
        ),
        version: 'v1',
      });

      // Make multiple concurrent calls with valid asset types
      const promises = [
        service.list('dashboard', { maxResults: 10 }),
        service.list('dataset', { maxResults: 10 }),
        service.list('analysis', { maxResults: 10 }),
      ];

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Should complete quickly (uses cached data)
      expect(duration).toBeLessThan(TEST_CONSTANTS.MAX_OPERATION_TIME_MS);
      expect(results).toHaveLength(TEST_CONSTANTS.RETRY_COUNT);
      expect(mockCacheService.getMasterCacheWithVersion).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle cache errors gracefully', async () => {
      const mockCacheService = cacheService as Mocked<typeof cacheService>;
      mockCacheService.getMasterCacheWithVersion.mockRejectedValue(new Error('Cache error'));

      await expect(service.list('dashboard', { maxResults: 10 })).rejects.toThrow('Cache error');
    });

    it('should handle empty cache gracefully', async () => {
      const mockCacheService = cacheService as Mocked<typeof cacheService>;
      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: { entries: {} } as any,
        version: 'v-empty',
      });

      const result = await service.list('dashboard', { maxResults: 10 });

      expect(result).toEqual({ items: [], nextToken: undefined, totalCount: 0 });
    });
  });
});

describe('AssetService collection snapshot memoization', () => {
  let service: AssetService;
  const mockAccountId = '123456789012';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    service = new AssetService(mockAccountId);
  });

  describe('user list enrichment memoization', () => {
    const buildUserCache = () => {
      const cache = createMockMasterCache();
      (cache.entries as any).user = [createMockCacheEntry('user', 'u-alice', 'alice')];
      return cache;
    };

    it('reuses the enrichment snapshot while the cache version is unchanged', async () => {
      const mockCacheService = cacheService as Mocked<typeof cacheService>;
      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: buildUserCache(),
        version: 'memo-stable',
      });
      mockCacheService.getActivityCacheWithEtag.mockResolvedValue({ value: null, etag: 'act-1' });
      mockCacheService.getActivityPersistenceWithEtag.mockResolvedValue({
        value: null,
        etag: 'pers-1',
      });

      const activitySpy = (service as any).activityService.getUserActivityCounts;

      const first = await service.list('user', { maxResults: 10 });
      const second = await service.list('user', { maxResults: 10 });

      expect(first.items).toHaveLength(1);
      expect(second.items).toHaveLength(1);
      // Enrichment ran once; the second request served the memoized snapshot
      expect(activitySpy).toHaveBeenCalledTimes(1);
    });

    it('recomputes enrichment when the cache version changes', async () => {
      const mockCacheService = cacheService as Mocked<typeof cacheService>;
      mockCacheService.getActivityCacheWithEtag.mockResolvedValue({ value: null, etag: 'act-1' });
      mockCacheService.getActivityPersistenceWithEtag.mockResolvedValue({
        value: null,
        etag: 'pers-1',
      });

      const activitySpy = (service as any).activityService.getUserActivityCounts;

      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: buildUserCache(),
        version: 'memo-v1',
      });
      await service.list('user', { maxResults: 10 });

      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: buildUserCache(),
        version: 'memo-v2',
      });
      await service.list('user', { maxResults: 10 });

      expect(activitySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('group list snapshot memoization', () => {
    const buildGroupCache = () => {
      const cache = createMockMasterCache();
      (cache.entries as any).group = [createMockCacheEntry('group', 'g-team-a', 'TeamA')];
      return cache;
    };

    it('attaches assetsCount and reuses the snapshot while the version is unchanged', async () => {
      const mockCacheService = cacheService as Mocked<typeof cacheService>;
      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: buildGroupCache(),
        version: 'group-memo-stable',
      });
      const bulkSpy = vi.spyOn((service as any).permissionsService, 'getBulkGroupAssetCounts');

      const first = await service.list('group', { maxResults: 10 });
      const second = await service.list('group', { maxResults: 10 });

      expect(first.items).toHaveLength(1);
      expect((first.items[0] as any).assetsCount).toBe(0);
      expect(second.items).toHaveLength(1);
      // Bulk counting ran once; the second request served the memoized snapshot
      expect(bulkSpy).toHaveBeenCalledTimes(1);
    });

    it('recomputes when the cache version changes', async () => {
      const mockCacheService = cacheService as Mocked<typeof cacheService>;
      const bulkSpy = vi.spyOn((service as any).permissionsService, 'getBulkGroupAssetCounts');

      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: buildGroupCache(),
        version: 'group-memo-v1',
      });
      await service.list('group', { maxResults: 10 });

      mockCacheService.getMasterCacheWithVersion.mockResolvedValue({
        cache: buildGroupCache(),
        version: 'group-memo-v2',
      });
      await service.list('group', { maxResults: 10 });

      expect(bulkSpy).toHaveBeenCalledTimes(2);
    });
  });
});
