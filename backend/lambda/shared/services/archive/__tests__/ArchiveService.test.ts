import { beforeEach, describe, expect, it, type Mocked, type MockedClass, vi } from 'vitest';

import { AssetStatusFilter } from '../../../types/assetFilterTypes';
import { logger } from '../../../utils/logger';
import { catalogEntry, useTestCatalog } from '../../../utils/testUtils/testCatalog';
import { S3Service } from '../../aws/S3Service';
import { catalog } from '../../catalog/catalogStore';
import { ArchiveService } from '../ArchiveService';

vi.mock('../../aws/S3Service');
vi.mock('../../../utils/logger');

const { seed } = useTestCatalog();

// Test constants
const TEST_BUCKET = 'test-bucket';
const BYTES_PER_GB = 1073741824;
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

beforeEach(() => {
  vi.clearAllMocks();

  mockS3Service = new S3Service('test-account') as Mocked<S3Service>;
  // A read-change-write over the mocked get and put, as the real one does (less the ETags).
  mockS3Service.updateObject = vi.fn(async (bucket: string, key: string, change: any) => {
    const current = (await mockS3Service.getObject(bucket, key)) ?? undefined;
    const next = change(current);
    if (next !== undefined) await mockS3Service.putObject(bucket, key, next);
    return next ?? current;
  }) as any;

  (S3Service as MockedClass<typeof S3Service>).mockImplementation(function () {
    return mockS3Service;
  });

  archiveService = new ArchiveService(TEST_BUCKET);
});

describe('ArchiveService - archiveAsset individual', () => {
  it('moves the file to archived/ and archives the catalog entry', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';
    const originalPath = 'assets/dashboards/dash-123.json';
    const archivePath = 'archived/dashboards/dash-123.json';
    const assetData = { id: assetId, name: 'Test Dashboard' };

    await seed([catalogEntry(assetType, assetId, { assetName: 'Test Dashboard' })]);

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

    const entry = await catalog.get(assetType, assetId);
    expect(entry).toMatchObject({
      status: 'archived',
      assetName: 'Test Dashboard',
      exportFilePath: archivePath,
      metadata: {
        archived: { archiveReason: 'Test archive reason', archivedBy: 'user@example.com' },
      },
    });
    expect(await catalog.list(assetType)).toEqual([]);
  });

  it('skips archiving if the asset is already archived', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';
    const archivePath = 'archived/dashboards/dash-123.json';

    await seed([catalogEntry(assetType, assetId, { status: 'archived' })]);

    const result = await archiveService.archiveAsset(assetType, assetId);

    expect(result.success).toBe(true);
    expect(result.archivePath).toBe(archivePath);
    expect(mockS3Service.putObject).not.toHaveBeenCalled();
    expect(mockS3Service.deleteObject).not.toHaveBeenCalled();
  });

  it('handles archive failure gracefully and leaves the entry live', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';

    await seed([catalogEntry(assetType, assetId)]);
    mockS3Service.objectExists = vi.fn().mockResolvedValue(false);

    const result = await archiveService.archiveAsset(assetType, assetId);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(logger.error).toHaveBeenCalled();
    expect((await catalog.get(assetType, assetId))?.status).toBe('active');
  });

  it('fails for an asset the catalog does not know, touching no files', async () => {
    const result = await archiveService.archiveAsset('dashboard', 'ghost');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(mockS3Service.putObject).not.toHaveBeenCalled();
    expect(await catalog.get('dashboard', 'ghost')).toBeNull();
  });
});

describe('ArchiveService - archiveAsset collection', () => {
  it('archives collection items correctly', async () => {
    const assetType = 'user';
    const itemId = 'user-123';
    const collectionPath = 'assets/organization/users.json';

    const activeCollection = {
      'user-123': { name: 'Test User', email: 'test@example.com' },
      'user-456': { name: 'Other User', email: 'other@example.com' },
    };

    await seed([catalogEntry(assetType, itemId, { storageType: 'collection' })]);

    mockS3Service.getObject = vi.fn(async (_bucket: string, key: string) =>
      key === collectionPath ? activeCollection : {}
    ) as any;
    mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);

    const result = await archiveService.archiveAsset(
      assetType,
      itemId,
      'User left organization',
      'admin@example.com'
    );

    expect(result.success).toBe(true);
    expect(result.assetId).toBe(itemId);

    expect(mockS3Service.putObject).toHaveBeenCalledWith(TEST_BUCKET, collectionPath, {
      'user-456': activeCollection['user-456'],
    });

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
    expect(await catalog.get(assetType, itemId)).toMatchObject({
      status: 'archived',
      exportFilePath: archivedPath,
    });
  });
});

describe('ArchiveService - bulk operations', () => {
  describe('archiveAssetsBulk', () => {
    it('archives multiple assets in bulk', async () => {
      const assetsToArchive = [
        { assetType: 'dashboard' as const, assetId: 'dash-1' },
        { assetType: 'analysis' as const, assetId: 'anal-1' },
        { assetType: 'dataset' as const, assetId: 'data-1' },
      ];

      await seed(assetsToArchive.map((a) => catalogEntry(a.assetType, a.assetId)));

      mockS3Service.objectExists = vi.fn().mockResolvedValue(true);
      mockS3Service.getObject = vi.fn().mockResolvedValue({ id: 'test' });
      mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);
      mockS3Service.deleteObject = vi.fn().mockResolvedValue(undefined);

      const results = await archiveService.archiveAssetsBulk(assetsToArchive);

      expect(results).toHaveLength(assetsToArchive.length);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockS3Service.putObject).toHaveBeenCalledTimes(EXPECTED_CALLS);
      expect(mockS3Service.deleteObject).toHaveBeenCalledTimes(EXPECTED_CALLS);
      for (const { assetType, assetId } of assetsToArchive) {
        expect((await catalog.get(assetType, assetId))?.status).toBe('archived');
      }
    });

    it('lands every archive when many run at once', async () => {
      const ids = Array.from({ length: 8 }, (_, i) => `dash-${i}`);
      await seed(ids.map((id) => catalogEntry('dashboard', id)));

      mockS3Service.objectExists = vi.fn().mockResolvedValue(true);
      mockS3Service.getObject = vi.fn().mockResolvedValue({ id: 'test' });
      mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);
      mockS3Service.deleteObject = vi.fn().mockResolvedValue(undefined);

      const results = await Promise.all(
        ids.map((id) => archiveService.archiveAsset('dashboard', id))
      );

      expect(results.every((r) => r.success)).toBe(true);
      expect(await catalog.list('dashboard')).toEqual([]);
      expect(
        (await catalog.list('dashboard', AssetStatusFilter.ARCHIVED)).map((e) => e.assetId).sort()
      ).toEqual([...ids].sort());
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

describe('ArchiveService - edge cases', () => {
  it('should handle invalid asset type for collection archiving', async () => {
    // archiveCollectionItem throws an error for invalid types, it doesn't return a result
    await expect(
      archiveService.archiveCollectionItem('dashboard' as any, 'dash-123', 'Invalid', 'user')
    ).rejects.toThrow('dashboard is not a collection type');
  });

  it('treats an item no longer in the active collection as archived, and writes nothing', async () => {
    const activeCollection = {
      'user-456': { name: 'Other User' },
    };

    mockS3Service.getObject = vi.fn().mockResolvedValue(activeCollection);
    mockS3Service.putObject = vi.fn();

    const result = await archiveService.archiveCollectionItem(
      'user',
      'user-123',
      'Not found',
      'admin'
    );

    expect(result.success).toBe(true);
    expect(mockS3Service.putObject).not.toHaveBeenCalled();
  });

  it('should verify archive creation before deleting original', async () => {
    const assetType = 'dashboard';
    const assetId = 'dash-123';

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

describe('ArchiveService - delete and restore ledger', () => {
  it('finishArchive removes the live file and archives the entry', async () => {
    await seed([catalogEntry('dataset', 'ds-1')]);
    mockS3Service.deleteObject = vi.fn().mockResolvedValue(undefined);

    await archiveService.finishArchive('dataset', 'ds-1', 'Deleted via portal', 'pat');

    expect(mockS3Service.deleteObject).toHaveBeenCalledWith(
      TEST_BUCKET,
      'assets/datasets/ds-1.json'
    );
    expect(await catalog.get('dataset', 'ds-1')).toMatchObject({
      status: 'archived',
      metadata: { archived: { archiveReason: 'Deleted via portal', archivedBy: 'pat' } },
    });
  });

  it('markRestored records the restore on the archive file and the archived entry', async () => {
    await seed([catalogEntry('dashboard', 'dash-1', { status: 'archived' })]);
    const restoration = {
      restoredAt: '2026-09-28T00:00:00.000Z',
      restoredBy: 'pat',
      restoredAs: 'dash-2',
    };
    mockS3Service.getObject = vi.fn().mockResolvedValue({
      id: 'dash-1',
      archivedMetadata: { archivedAt: '2026-09-01T00:00:00.000Z' },
    });
    mockS3Service.putObject = vi.fn().mockResolvedValue(undefined);

    await archiveService.markRestored('dashboard', 'dash-1', restoration);

    expect(mockS3Service.putObject).toHaveBeenCalledWith(
      TEST_BUCKET,
      'archived/dashboards/dash-1.json',
      expect.objectContaining({
        archivedMetadata: expect.objectContaining({ restorations: [restoration] }),
      })
    );
    expect((await catalog.get('dashboard', 'dash-1'))?.metadata.archived).toMatchObject({
      restorations: [restoration],
    });
  });
});

describe('ArchiveService - a user archived half-way is archived once, not every export', () => {
  const ACTIVE = 'assets/organization/users.json';
  const ARCHIVED = 'archived/organization/users.json';

  function files(active: Record<string, unknown>, archived: Record<string, unknown>) {
    mockS3Service.getObject = vi.fn(async (_bucket: string, key: string) =>
      key === ACTIVE ? active : key === ARCHIVED ? archived : null
    ) as any;
    mockS3Service.putObject = vi.fn(async () => undefined) as any;
  }

  it('prefers the live entry when an archived copy of the same user is also in the catalog', async () => {
    await seed([catalogEntry('user', 'pat', { status: 'archived' }), catalogEntry('user', 'pat')]);
    files({ pat: { UserName: 'pat' } }, {});

    const result = await archiveService.archiveAsset(
      'user',
      'pat',
      'Gone from QuickSight',
      'system'
    );

    expect(result.success).toBe(true);
    expect(mockS3Service.putObject).toHaveBeenCalledWith(TEST_BUCKET, ACTIVE, {});
    expect(await catalog.list('user')).toEqual([]);
    expect(await catalog.get('user', 'pat')).toMatchObject({
      status: 'archived',
      exportFilePath: ARCHIVED,
      metadata: { archived: { archiveReason: 'Gone from QuickSight' } },
    });
  });

  it('marks the catalog when the record already left the active file, so the next export skips it', async () => {
    // Deleted through the portal long ago: the entry says archived, the path never moved.
    await seed([catalogEntry('user', 'pat', { status: 'archived', exportFilePath: ACTIVE })]);
    files({}, { pat: { UserName: 'pat' } });

    const result = await archiveService.archiveAsset(
      'user',
      'pat',
      'Gone from QuickSight',
      'system'
    );

    expect(result.success).toBe(true);
    expect(await catalog.get('user', 'pat')).toMatchObject({
      status: 'archived',
      exportFilePath: ARCHIVED,
    });
  });

  it('still settles a record that is in neither file', async () => {
    await seed([catalogEntry('user', 'pat', { status: 'archived', exportFilePath: ACTIVE })]);
    files({}, {});

    const result = await archiveService.archiveAsset('user', 'pat');

    expect(result.success).toBe(true);
    expect((await catalog.get('user', 'pat'))?.exportFilePath).toBe(ARCHIVED);
  });
});
