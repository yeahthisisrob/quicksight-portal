import { vi, type Mocked, type MockedClass } from 'vitest';

import { logger } from '../../../utils/logger';
import { S3Service } from '../../aws/S3Service';
import { type CacheService } from '../../cache/CacheService';
import { ArchiveService } from '../ArchiveService';

// Mock dependencies
vi.mock('../../aws/S3Service');
vi.mock('../../cache/CacheService');
vi.mock('../../../utils/logger');

// Test constants
const TEST_BUCKET = 'test-bucket';
const MILLISECONDS_IN_DAY = 86400000;
const BYTES_PER_GB = 1073741824;
const DAYS_IN_MONTH = 30;
const GB_ARCHIVE_QUARTER = 4;
const TOTAL_ARCHIVED_COUNT = 5;
const EXPECTED_SIZE_GB = 1.75;
const EXPECTED_USER_COUNT = 3;
const PRECISION_PLACES = 2;
const EXPECTED_CALLS = 3;
const MAX_DASHBOARD_COUNT = 2;

// Shared test setup
let archiveService: ArchiveService;
let mockS3Service: Mocked<S3Service>;
let mockCacheService: Mocked<CacheService>;

beforeEach(() => {
  vi.clearAllMocks();

  // Create mock instances
  mockS3Service = new S3Service('test-account') as Mocked<S3Service>;
  mockCacheService = {
    getCacheEntries: vi.fn(),
    updateAsset: vi.fn(),
  } as any;

  // Mock S3Service constructor to return our mock
  (S3Service as MockedClass<typeof S3Service>).mockImplementation(() => mockS3Service);

  archiveService = new ArchiveService(TEST_BUCKET, mockCacheService);
});

describe('ArchiveService - archiveAsset individual', () => {
  it('should successfully archive an individual asset', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';
    const originalPath = 'assets/dashboards/dash-123.json';
    const archivePath = 'archived/dashboards/dash-123.json';
    const assetData = { id: assetId, name: 'Test Dashboard' };

    mockCacheService.getCacheEntries.mockResolvedValue([
      {
        assetId,
        assetType,
        assetName: 'Test Dashboard',
        arn: `arn:aws:quicksight:us-east-1:123456789012:dashboard/${assetId}`,
        status: 'active',
        enrichmentStatus: 'enriched',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
        exportedAt: new Date(),
        exportFilePath: originalPath,
        storageType: 'individual',
        tags: [],
        permissions: [],
        metadata: {},
      } as any,
    ]);

    mockS3Service.objectExists = vi
      .fn()
      .mockResolvedValueOnce(true) // Original exists
      .mockResolvedValueOnce(true); // Archive created successfully
    mockS3Service.getObject = vi.fn().mockResolvedValue(assetData);
    mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);
    mockS3Service.deleteObject = vi.fn().mockResolvedValue(undefined);

    const result = await archiveService.archiveAsset(
      assetType,
      assetId,
      'Test archive reason',
      'user@example.com'
    );

    expect(result.success).toBe(true);
    expect(result.assetId).toBe(assetId);
    expect(result.originalPath).toBe(originalPath);
    expect(result.archivePath).toBe(archivePath);
    expect(mockS3Service.putObject).toHaveBeenCalledWith(
      TEST_BUCKET,
      archivePath,
      expect.objectContaining({
        ...assetData,
        archivedMetadata: expect.objectContaining({
          archiveReason: 'Test archive reason',
          archivedBy: 'user@example.com',
          originalPath,
        }),
      })
    );
    expect(mockS3Service.deleteObject).toHaveBeenCalledWith(TEST_BUCKET, originalPath);
    expect(mockCacheService.updateAsset).toHaveBeenCalled();
  });

  it('should skip archiving if asset is already archived', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';
    const archivePath = 'archived/dashboards/dash-123.json';

    mockCacheService.getCacheEntries.mockResolvedValue([
      {
        assetId,
        assetType,
        assetName: 'Test Dashboard',
        arn: `arn:aws:quicksight:us-east-1:123456789012:dashboard/${assetId}`,
        status: 'archived',
        enrichmentStatus: 'enriched',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
        exportedAt: new Date(),
        exportFilePath: archivePath,
        storageType: 'individual',
        tags: [],
        permissions: [],
        metadata: {},
      } as any,
    ]);

    const result = await archiveService.archiveAsset(assetType, assetId);

    expect(result.success).toBe(true);
    expect(result.archivePath).toBe(archivePath);
    expect(mockS3Service.putObject).not.toHaveBeenCalled();
    expect(mockS3Service.deleteObject).not.toHaveBeenCalled();
  });

  it('should handle archive failure gracefully', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';

    mockCacheService.getCacheEntries.mockResolvedValue([
      {
        assetId,
        assetType,
        assetName: 'Test Dashboard',
        arn: `arn:aws:quicksight:us-east-1:123456789012:dashboard/${assetId}`,
        status: 'active',
        enrichmentStatus: 'enriched',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
        exportedAt: new Date(),
        exportFilePath: '',
        storageType: 'individual',
        tags: [],
        permissions: [],
        metadata: {},
      } as any,
    ]);

    mockS3Service.objectExists = vi.fn().mockResolvedValue(false);

    const result = await archiveService.archiveAsset(assetType, assetId);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('ArchiveService - archiveAsset collection', () => {
  it('should archive collection items correctly', async () => {
    const assetType = 'user';
    const itemId = 'user-123';
    const collectionPath = 'assets/organization/users.json';

    const activeCollection = {
      'user-123': { name: 'Test User', email: 'test@example.com' },
      'user-456': { name: 'Other User', email: 'other@example.com' },
    };

    // Need to provide a cache entry so archiveAsset doesn't think the asset doesn't exist
    mockCacheService.getCacheEntries.mockResolvedValue([
      {
        assetId: itemId,
        assetType,
        assetName: 'Test User',
        arn: `arn:aws:quicksight:us-east-1:123456789012:user/default/${itemId}`,
        status: 'active',
        enrichmentStatus: 'enriched',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
        exportedAt: new Date(),
        exportFilePath: `${collectionPath}#${itemId}`,
        storageType: 'collection',
        tags: [],
        permissions: [],
        metadata: {},
      } as any,
    ]);

    mockS3Service.getObject = vi
      .fn()
      .mockResolvedValueOnce(activeCollection) // Get active collection
      .mockResolvedValueOnce({}); // Get archived collection (empty)

    mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);

    const result = await archiveService.archiveAsset(
      assetType,
      itemId,
      'User left organization',
      'admin@example.com'
    );

    expect(result.success).toBe(true);
    expect(result.assetId).toBe(itemId);

    // Verify item was removed from active collection
    expect(mockS3Service.putObject).toHaveBeenCalledWith(TEST_BUCKET, collectionPath, {
      'user-456': activeCollection['user-456'],
    });

    // Verify item was added to archived collection
    const archivedPath = 'archived/organization/users.json';
    expect(mockS3Service.putObject).toHaveBeenCalledWith(
      TEST_BUCKET,
      archivedPath,
      expect.objectContaining({
        'user-123': expect.objectContaining({
          ...activeCollection['user-123'],
          archivedMetadata: expect.objectContaining({
            archiveReason: 'User left organization',
            archivedBy: 'admin@example.com',
          }),
        }),
      })
    );
  });
});

describe('ArchiveService - bulk operations', () => {
  describe('archiveAssetsBulk', () => {
    it('should archive multiple assets in bulk', async () => {
      const assetsToArchive = [
        { assetType: 'dashboard' as const, assetId: 'dash-1' },
        { assetType: 'analysis' as const, assetId: 'anal-1' },
        { assetType: 'dataset' as const, assetId: 'data-1' },
      ];

      // Provide cache entries for each asset so they are found
      mockCacheService.getCacheEntries.mockImplementation(async (filter: any) => {
        const assetMap: Record<string, any> = {
          dashboard: {
            assetId: 'dash-1',
            assetType: 'dashboard',
            assetName: 'Dashboard 1',
            arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-1',
            status: 'active',
            enrichmentStatus: 'enriched',
            createdTime: new Date(),
            lastUpdatedTime: new Date(),
            exportedAt: new Date(),
            exportFilePath: 'assets/dashboards/dash-1.json',
            storageType: 'individual',
            tags: [],
            permissions: [],
            metadata: {},
          },
          analysis: {
            assetId: 'anal-1',
            assetType: 'analysis',
            assetName: 'Analysis 1',
            arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/anal-1',
            status: 'active',
            enrichmentStatus: 'enriched',
            createdTime: new Date(),
            lastUpdatedTime: new Date(),
            exportedAt: new Date(),
            exportFilePath: 'assets/analyses/anal-1.json',
            storageType: 'individual',
            tags: [],
            permissions: [],
            metadata: {},
          },
          dataset: {
            assetId: 'data-1',
            assetType: 'dataset',
            assetName: 'Dataset 1',
            arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/data-1',
            status: 'active',
            enrichmentStatus: 'enriched',
            createdTime: new Date(),
            lastUpdatedTime: new Date(),
            exportedAt: new Date(),
            exportFilePath: 'assets/datasets/data-1.json',
            storageType: 'individual',
            tags: [],
            permissions: [],
            metadata: {},
          },
        };
        return filter?.assetType && assetMap[filter.assetType] ? [assetMap[filter.assetType]] : [];
      });

      mockS3Service.objectExists = vi.fn().mockResolvedValue(true);
      mockS3Service.getObject = vi.fn().mockResolvedValue({ id: 'test' });
      mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);
      mockS3Service.deleteObject = vi.fn().mockResolvedValue(undefined);

      const results = await archiveService.archiveAssetsBulk(assetsToArchive);

      expect(results).toHaveLength(assetsToArchive.length);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockS3Service.putObject).toHaveBeenCalledTimes(EXPECTED_CALLS);
      expect(mockS3Service.deleteObject).toHaveBeenCalledTimes(EXPECTED_CALLS);
    });
  });
});

describe('ArchiveService - getArchivedAsset', () => {
  it('should retrieve an archived individual asset', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';
    const archivePath = 'archived/dashboards/dash-123.json';
    const assetData = { id: assetId, name: 'Archived Dashboard' };

    mockS3Service.objectExists = vi.fn().mockResolvedValue(true);
    mockS3Service.getObject = vi.fn().mockResolvedValue(assetData);

    const result = await archiveService.getArchivedAsset(assetType, assetId);

    expect(result).toEqual(assetData);
    expect(mockS3Service.getObject).toHaveBeenCalledWith(TEST_BUCKET, archivePath);
  });

  it('should retrieve an archived collection item', async () => {
    const assetType = 'user';
    const itemId = 'user-123';
    const archivedCollection = {
      'user-123': { name: 'Archived User', email: 'archived@example.com' },
    };

    mockS3Service.getObject = vi.fn().mockResolvedValue(archivedCollection);

    const result = await archiveService.getArchivedAsset(assetType, itemId);

    expect(result).toEqual({
      id: itemId,
      ...archivedCollection['user-123'],
    });
  });

  it('should return null if archived asset does not exist', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-999';

    mockS3Service.objectExists = vi.fn().mockResolvedValue(false);

    const result = await archiveService.getArchivedAsset(assetType, assetId);

    expect(result).toBeNull();
  });
});

describe('ArchiveService - getArchivedAssets', () => {
  it('should retrieve all archived assets of a type', async () => {
    const assetType = 'dashboard';
    const prefix = 'archived/dashboards/';
    const archivedAssets = [
      { id: 'dash-1', name: 'Dashboard 1' },
      { id: 'dash-2', name: 'Dashboard 2' },
    ];

    mockS3Service.listObjects = vi
      .fn()
      .mockResolvedValue([
        { key: 'archived/dashboards/dash-1.json' },
        { key: 'archived/dashboards/dash-2.json' },
      ]);
    mockS3Service.getObject = vi
      .fn()
      .mockResolvedValueOnce(archivedAssets[0])
      .mockResolvedValueOnce(archivedAssets[1]);

    const result = await archiveService.getArchivedAssets(assetType);

    expect(result).toEqual(archivedAssets);
    expect(mockS3Service.listObjects).toHaveBeenCalledWith(TEST_BUCKET, prefix);
  });

  it('should retrieve all archived collection items', async () => {
    const assetType = 'user';
    const archivedCollection = {
      'user-1': { name: 'User 1', email: 'user1@example.com' },
      'user-2': { name: 'User 2', email: 'user2@example.com' },
    };

    mockS3Service.getObject = vi.fn().mockResolvedValue(archivedCollection);

    const result = await archiveService.getArchivedAssets(assetType);

    const expectedLength = 2;
    expect(result).toHaveLength(expectedLength);
    expect(result[0]).toEqual({ id: 'user-1', ...archivedCollection['user-1'] });
    expect(result[1]).toEqual({ id: 'user-2', ...archivedCollection['user-2'] });
  });
});

describe('ArchiveService - getArchivedAssetsPaginated', () => {
  it('should return paginated archived assets', async () => {
    const options = {
      assetType: 'dashboard' as const,
      page: 1,
      pageSize: 2,
      search: 'test',
      sortBy: 'name',
      sortOrder: 'asc' as const,
    };

    const mockAssetsCount = 5;
    const mockAssets = Array.from({ length: mockAssetsCount }, (_, i) => ({
      assetId: `dash-${i}`,
      assetName: `Test Dashboard ${i}`,
      assetType: 'dashboard' as const,
      arn: `arn:aws:quicksight:us-east-1:123456789012:dashboard/dash-${i}`,
      status: 'archived' as const,
      enrichmentStatus: 'enriched' as const,
      createdTime: new Date(),
      lastUpdatedTime: new Date(),
      exportedAt: new Date(),
      exportFilePath: `archived/dashboards/dash-${i}.json`,
      storageType: 'individual' as const,
      tags: [],
      permissions: [],
      metadata: {
        archived: {
          archivedAt: new Date().toISOString(),
          archiveReason: 'Test reason',
          archivedBy: 'user',
          originalPath: `assets/dashboards/dash-${i}.json`,
        },
      },
    }));

    vi.spyOn(archiveService, 'getArchivedAssets').mockResolvedValue(mockAssets);

    const result = await archiveService.getArchivedAssetsPaginated(options);

    const expectedPageSize = 2;
    expect(result.items).toHaveLength(expectedPageSize);
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.nextToken).toBeDefined();
  });

  it('should filter by date range', async () => {
    const options = {
      assetType: 'dashboard' as const,
      dateRange: '7d',
      page: 1,
      pageSize: 10,
    };

    const oldAsset = {
      assetId: 'old-dash',
      assetName: 'Old Dashboard',
      assetType: 'dashboard' as const,
      arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/old-dash',
      status: 'archived' as const,
      enrichmentStatus: 'enriched' as const,
      createdTime: new Date(),
      lastUpdatedTime: new Date(),
      exportedAt: new Date(),
      exportFilePath: 'archived/dashboards/old-dash.json',
      storageType: 'individual' as const,
      tags: [],
      permissions: [],
      metadata: {
        archived: {
          archivedAt: new Date(Date.now() - MILLISECONDS_IN_DAY * DAYS_IN_MONTH).toISOString(),
          archiveReason: 'Old',
          archivedBy: 'user',
          originalPath: 'assets/dashboards/old-dash.json',
        },
      },
    };

    const recentAsset = {
      assetId: 'recent-dash',
      assetName: 'Recent Dashboard',
      assetType: 'dashboard' as const,
      arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/recent-dash',
      status: 'archived' as const,
      enrichmentStatus: 'enriched' as const,
      createdTime: new Date(),
      lastUpdatedTime: new Date(),
      exportedAt: new Date(),
      exportFilePath: 'archived/dashboards/recent-dash.json',
      storageType: 'individual' as const,
      tags: [],
      permissions: [],
      metadata: {
        archived: {
          archivedAt: new Date().toISOString(),
          archiveReason: 'Recent',
          archivedBy: 'user',
          originalPath: 'assets/dashboards/recent-dash.json',
        },
      },
    };

    vi.spyOn(archiveService, 'getArchivedAssets').mockResolvedValue([oldAsset, recentAsset]);

    const result = await archiveService.getArchivedAssetsPaginated(options);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('recent-dash');
  });
});

describe('ArchiveService - statistics', () => {
  describe('getArchiveStatistics', () => {
    it('should calculate archive statistics correctly', async () => {
      const dashboardObjects = [
        {
          key: 'archived/dashboards/dash-1.json',
          size: BYTES_PER_GB,
          lastModified: new Date('2024-01-01'),
        },
        {
          key: 'archived/dashboards/dash-2.json',
          size: BYTES_PER_GB / 2,
          lastModified: new Date('2024-02-01'),
        },
      ];

      const userCollection = {
        'user-1': { name: 'User 1' },
        'user-2': { name: 'User 2' },
        'user-3': { name: 'User 3' },
      };

      // Mock listObjects calls for individual types and collection file size checks
      mockS3Service.listObjects = vi
        .fn()
        .mockImplementation(async (_bucket: string, prefix: string) => {
          if (prefix === 'archived/dashboards/') {
            return dashboardObjects;
          }
          if (prefix === 'archived/analyses/') {
            return [];
          }
          if (prefix === 'archived/datasets/') {
            return [];
          }
          if (prefix === 'archived/datasources/') {
            return [];
          }
          if (prefix === 'archived/organization/users.json') {
            return [
              { key: 'archived/organization/users.json', size: BYTES_PER_GB / GB_ARCHIVE_QUARTER },
            ];
          }
          if (prefix === 'archived/organization/groups.json') {
            return [];
          }
          if (prefix === 'archived/organization/folders.json') {
            return [];
          }
          return [];
        });

      // Mock getObject calls for collection types
      mockS3Service.getObject = vi
        .fn()
        .mockImplementation(async (_bucket: string, path: string) => {
          if (path === 'archived/organization/users.json') {
            return userCollection;
          }
          if (path === 'archived/organization/groups.json') {
            throw new Error('Not found');
          }
          if (path === 'archived/organization/folders.json') {
            throw new Error('Not found');
          }
          throw new Error('Not found');
        });

      const stats = await archiveService.getArchiveStatistics();

      expect(stats.totalArchived).toBe(TOTAL_ARCHIVED_COUNT); // 2 dashboards + 3 users
      expect(stats.totalSizeGB).toBeCloseTo(EXPECTED_SIZE_GB, PRECISION_PLACES); // 1 + 0.5 + 0.25
      expect(stats.byType.dashboard).toBe(MAX_DASHBOARD_COUNT);
      expect(stats.byType.user).toBe(EXPECTED_USER_COUNT);
      expect(stats.oldestArchive).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should handle empty archives', async () => {
      mockS3Service.listObjects = vi.fn().mockResolvedValue([]);
      mockS3Service.getObject = vi.fn().mockRejectedValue(new Error('Not found'));

      const stats = await archiveService.getArchiveStatistics();

      expect(stats.totalArchived).toBe(0);
      expect(stats.totalSizeGB).toBe(0);
      Object.values(stats.byType).forEach((count) => {
        expect(count).toBe(0);
      });
    });
  });
});

describe('ArchiveService - transformations', () => {
  describe('transformArchivedAsset', () => {
    it('should transform cache entry to archived asset response', () => {
      const cacheEntry = {
        assetId: 'dash-123',
        assetName: 'Test Dashboard',
        assetType: 'dashboard' as const,
        status: 'archived',
        createdTime: new Date('2024-01-01'),
        lastUpdatedTime: new Date('2024-02-01'),
        exportedAt: new Date('2024-01-15'),
        enrichmentStatus: 'enriched' as const,
        tags: [{ Key: 'env', Value: 'prod' }],
        permissions: [{ Principal: 'user1', Actions: ['read'] }],
        metadata: {
          enrichmentTimestamps: { tags: '2024-01-10' },
          archived: {
            archivedAt: '2024-03-01T00:00:00.000Z',
            archivedBy: 'admin',
            archiveReason: 'Cleanup',
            originalPath: 'assets/dashboards/dash-123.json',
          },
        },
      };

      const result = archiveService.transformArchivedAsset(cacheEntry as any);

      expect(result.id).toBe('dash-123');
      expect(result.name).toBe('Test Dashboard');
      expect(result.type).toBe('dashboard');
      expect(result.status).toBe('archived');
      expect(result.archiveMetadata.archivedAt).toBe('2024-03-01T00:00:00.000Z');
      expect(result.archiveMetadata.archivedBy).toBe('admin');
      expect(result.archiveMetadata.archiveReason).toBe('Cleanup');
      expect(result.canRestore).toBe(true);
    });
  });
});

describe('ArchiveService - edge cases', () => {
  it('should handle archiving when cache service is not available', async () => {
    const serviceWithoutCache = new ArchiveService(TEST_BUCKET);
    const assetType = 'dashboard';
    const assetId = 'dash-123';

    mockS3Service.objectExists = vi.fn().mockResolvedValue(true);
    mockS3Service.getObject = vi.fn().mockResolvedValue({ id: assetId });
    mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);
    mockS3Service.deleteObject = vi.fn().mockResolvedValue(undefined);

    const result = await serviceWithoutCache.archiveAsset(assetType, assetId);

    expect(result.success).toBe(true);
    expect(mockCacheService.getCacheEntries).not.toHaveBeenCalled();
    expect(mockCacheService.updateAsset).not.toHaveBeenCalled();
  });

  it('should handle invalid asset type for collection archiving', async () => {
    // archiveCollectionItem throws an error for invalid types, it doesn't return a result
    await expect(
      archiveService.archiveCollectionItem('dashboard' as any, 'dash-123', 'Invalid', 'user')
    ).rejects.toThrow('dashboard is not a collection type');
  });

  it('should handle missing item in collection', async () => {
    const activeCollection = {
      'user-456': { name: 'Other User' },
    };

    mockS3Service.getObject = vi.fn().mockResolvedValue(activeCollection);

    const result = await archiveService.archiveCollectionItem(
      'user',
      'user-123',
      'Not found',
      'admin'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found in user collection');
  });

  it('should verify archive creation before deleting original', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';

    mockCacheService.getCacheEntries.mockResolvedValue([]);
    mockS3Service.objectExists = vi
      .fn()
      .mockResolvedValueOnce(true) // Original exists
      .mockResolvedValueOnce(false); // Archive verification fails
    mockS3Service.getObject = vi.fn().mockResolvedValue({ id: assetId });
    mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);

    const result = await archiveService.archiveIndividualAsset(assetType, assetId);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to verify archive creation');
    expect(mockS3Service.deleteObject).not.toHaveBeenCalled();
  });
});
