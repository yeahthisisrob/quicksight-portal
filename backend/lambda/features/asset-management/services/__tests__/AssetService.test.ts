import { type Mocked, vi } from 'vitest';
/**
 * Tests for AssetService to ensure proper initialization patterns
 * and prevent regression of dynamic import issues
 */

import { cacheService } from '../../../../shared/services/cache/CacheService';
import { catalog } from '../../../../shared/services/catalog/catalogStore';
import { catalogEntry, useTestCatalog } from '../../../../shared/utils/testUtils/testCatalog';
import { AssetService } from '../AssetService';

// Test constants
const TEST_CONSTANTS = {
  PAGE_SIZE: 50,
  RETRY_COUNT: 3,
  MAX_OPERATION_TIME_MS: 100,
} as const;

const { seed } = useTestCatalog();

// Mock dependencies
vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: {
    getActivityCacheWithEtag: vi.fn().mockResolvedValue({ value: null }),
    getActivityPersistenceWithEtag: vi.fn().mockResolvedValue({ value: null }),
  },
}));
vi.mock('../../../../shared/services/lineage', () => ({
  LineageService: vi.fn().mockImplementation(function () {
    return {
      getLineage: vi.fn(),
      getLineageMapForAssets: vi.fn().mockResolvedValue(new Map()),
    };
  }),
}));
const activity = vi.hoisted(() => ({
  getAssetActivity: vi.fn(),
  getAssetActivityCounts: vi.fn(),
  getDatasetActivityCounts: vi.fn(),
  getUserActivityCounts: vi.fn(),
}));
// Activity is read through the port the composition root fills.
vi.mock('../../../../shared/services/activity/activityReader', () => ({
  activityReader: () => activity,
}));
vi.mock('../../../../shared/services/organization/TagService', () => ({
  TagService: vi.fn().mockImplementation(function () {
    return {
      getTags: vi.fn(),
    };
  }),
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
    activity.getUserActivityCounts.mockResolvedValue(new Map());
    activity.getAssetActivityCounts.mockResolvedValue(new Map());
    activity.getDatasetActivityCounts.mockResolvedValue(new Map());
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    service = new AssetService(mockAccountId);
  });

  describe('Import patterns - prevent regression', () => {
    it('should have core services initialized in constructor', () => {
      // Verify that essential services are initialized
      expect((service as any).tagService).toBeDefined();
      expect((service as any).lineageService).toBeDefined();
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
    it('lists a type from the catalog', async () => {
      await seed([
        catalogEntry('dashboard', 'dash-1', { assetName: 'Dashboard 1' }),
        catalogEntry('dashboard', 'dash-2', { assetName: 'Dashboard 2' }),
        catalogEntry('dataset', 'data-1', { assetName: 'Dataset 1' }),
      ]);

      const result = await service.list('dashboard', { maxResults: 10, nextToken: undefined });

      expect(result.items.map((item) => item.id).sort()).toEqual(['dash-1', 'dash-2']);
    });

    it('serves concurrent lists of different types', async () => {
      await seed([
        catalogEntry('dashboard', 'dash-1', { assetName: 'Dashboard 1' }),
        catalogEntry('dataset', 'data-1', { assetName: 'Dataset 1' }),
        catalogEntry('analysis', 'anal-1', { assetName: 'Analysis 1' }),
      ]);

      const results = await Promise.all([
        service.list('dashboard', { maxResults: 10 }),
        service.list('dataset', { maxResults: 10 }),
        service.list('analysis', { maxResults: 10 }),
      ]);

      expect(results).toHaveLength(TEST_CONSTANTS.RETRY_COUNT);
      expect(results.map((r) => r.items.length)).toEqual([1, 1, 1]);
    });
  });

  describe('folders', () => {
    // Members are kept as QuickSight lists them: MemberId, MemberArn, MemberType.
    const finance = catalogEntry('folder', 'f-finance', {
      assetName: 'Finance',
      metadata: {
        members: [
          { MemberId: 'dash-1', MemberArn: 'arn:dashboard/dash-1', MemberType: 'DASHBOARD' },
          { MemberId: 'data-1', MemberArn: 'arn:dataset/data-1', MemberType: 'DATASET' },
        ],
      },
    });

    it('lists the folders an asset is in', async () => {
      await seed([finance, catalogEntry('dashboard', 'dash-1')]);

      const result = await service.list('dashboard', { maxResults: 10 });

      expect(result.items.find((d) => d.id === 'dash-1')).toMatchObject({
        folders: [expect.objectContaining({ id: 'f-finance', name: 'Finance' })],
      });
    });
  });

  describe('Error handling', () => {
    it('should handle catalog errors gracefully', async () => {
      vi.spyOn(catalog, 'snapshot').mockRejectedValueOnce(new Error('Catalog error'));

      await expect(service.list('dashboard', { maxResults: 10 })).rejects.toThrow('Catalog error');
    });

    it('should handle an empty catalog gracefully', async () => {
      const result = await service.list('dashboard', { maxResults: 10 });

      expect(result).toEqual({ items: [], nextToken: undefined, totalCount: 0 });
    });
  });
});

describe('AssetService collection snapshot memoization', () => {
  let service: AssetService;
  const mockAccountId = '123456789012';
  const mockCacheService = cacheService as Mocked<typeof cacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    activity.getUserActivityCounts.mockResolvedValue(new Map());
    activity.getAssetActivityCounts.mockResolvedValue(new Map());
    activity.getDatasetActivityCounts.mockResolvedValue(new Map());
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    service = new AssetService(mockAccountId);
  });

  describe('user list enrichment memoization', () => {
    beforeEach(async () => {
      mockCacheService.getActivityCacheWithEtag.mockResolvedValue({ value: null, etag: 'act-1' });
      mockCacheService.getActivityPersistenceWithEtag.mockResolvedValue({
        value: null,
        etag: 'pers-1',
      });
      await seed([catalogEntry('user', 'u-alice', { assetName: 'alice' })]);
    });

    it('reuses the enrichment snapshot while the catalog version is unchanged', async () => {
      const first = await service.list('user', { maxResults: 10 });
      const second = await service.list('user', { maxResults: 10 });

      expect(first.items).toHaveLength(1);
      expect(second.items).toHaveLength(1);
      // Enrichment ran once; the second request served the memoized snapshot
      expect(activity.getUserActivityCounts).toHaveBeenCalledTimes(1);
    });

    it('recomputes enrichment when the catalog version changes', async () => {
      await service.list('user', { maxResults: 10 });
      await catalog.patch('user', 'u-alice', { assetName: 'alice-renamed' });
      const second = await service.list('user', { maxResults: 10 });

      expect(activity.getUserActivityCounts).toHaveBeenCalledTimes(2);
      expect(second.items[0]?.name).toBe('alice-renamed');
    });
  });

  describe('group list snapshot memoization', () => {
    beforeEach(async () => {
      await seed([catalogEntry('group', 'g-team-a', { assetName: 'TeamA' })]);
    });

    it('attaches assetsCount and reuses the snapshot while the version is unchanged', async () => {
      const bulkSpy = vi.spyOn((service as any).permissionsService, 'getBulkGroupAssetCounts');

      const first = await service.list('group', { maxResults: 10 });
      const second = await service.list('group', { maxResults: 10 });

      expect(first.items).toHaveLength(1);
      expect((first.items[0] as any).assetsCount).toBe(0);
      expect(second.items).toHaveLength(1);
      // Bulk counting ran once; the second request served the memoized snapshot
      expect(bulkSpy).toHaveBeenCalledTimes(1);
    });

    it('recomputes when the catalog version changes', async () => {
      const bulkSpy = vi.spyOn((service as any).permissionsService, 'getBulkGroupAssetCounts');

      await service.list('group', { maxResults: 10 });
      await seed([catalogEntry('dashboard', 'd-new')]);
      await service.list('group', { maxResults: 10 });

      expect(bulkSpy).toHaveBeenCalledTimes(2);
    });
  });
});
