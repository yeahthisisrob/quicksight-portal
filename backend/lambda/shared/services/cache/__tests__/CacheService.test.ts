import { vi, type Mocked, type MockedClass } from 'vitest';

// Mock dependencies first
vi.mock('../../aws/S3Service', () => ({ S3Service: vi.fn() }));

import { S3Service } from '../../aws/S3Service';
import { CacheService } from '../CacheService';

// Create a global mock S3Service that all describe blocks can use
const createMockS3Service = (): Mocked<S3Service> =>
  ({
    getObject: vi.fn(),
    putObject: vi.fn(),
    listObjects: vi.fn(),
  }) as any;

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the S3Client
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
}));

// Mock the http config
vi.mock('../../../config/httpConfig', () => ({
  getOptimizedAwsConfig: vi.fn().mockReturnValue({
    region: 'us-east-1',
  }),
}));

describe('CacheService - Data Consistency', () => {
  let cacheService: CacheService;
  let mockS3Service: ReturnType<typeof createMockS3Service>;
  let mockCacheReader: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the singleton instance and static s3Service to ensure clean state
    (CacheService as any).instance = null;
    (CacheService as any).s3Service = null;

    // Create fresh mock S3Service
    mockS3Service = createMockS3Service();

    // Mock the S3Service constructor to return our mock
    vi.mocked(S3Service).mockImplementation(() => mockS3Service as any);

    // Get the singleton instance
    cacheService = CacheService.getInstance();
    mockCacheReader = (cacheService as any).cacheReader;
  });

  describe('getMasterCache returns data as-is', () => {
    it('should return user groups without filtering', async () => {
      const mockCache = {
        entries: {
          user: [
            {
              id: 'user1',
              name: 'User One',
              groups: ['ActiveGroup', 'DeletedGroup', 'ArchivedGroup'],
            },
            {
              id: 'user2',
              name: 'User Two',
              groups: ['ActiveGroup'],
            },
          ],
          group: [
            { assetName: 'ActiveGroup', status: 'active' },
            { assetName: 'AnotherActiveGroup', status: 'active' },
          ],
        },
      };

      mockCacheReader.getMasterCache = vi.fn().mockResolvedValue(mockCache);

      const result = await cacheService.getMasterCache();

      // CacheService now returns data as-is without filtering
      expect((result.entries.user?.[0] as any)?.groups).toEqual([
        'ActiveGroup',
        'DeletedGroup',
        'ArchivedGroup',
      ]);
      expect((result.entries.user?.[1] as any)?.groups).toEqual(['ActiveGroup']);
    });

    it('should handle users with no groups', async () => {
      const mockCache = {
        entries: {
          user: [
            { id: 'user1', name: 'User One' },
            { id: 'user2', name: 'User Two', groups: [] },
            { id: 'user3', name: 'User Three', groups: null },
          ],
          group: [{ assetName: 'Group1' }],
        },
      };

      mockCacheReader.getMasterCache = vi.fn().mockResolvedValue(mockCache);

      const result = await cacheService.getMasterCache();

      expect((result.entries.user?.[0] as any)?.groups).toBeUndefined();
      expect((result.entries.user?.[1] as any)?.groups).toEqual([]);
      expect((result.entries.user?.[2] as any)?.groups).toBeNull();
    });

    it('should return user groups unchanged', async () => {
      const mockCache = {
        entries: {
          user: [{ id: 'user1', groups: ['Group1', 'Group2'] }],
        },
      };

      mockCacheReader.getMasterCache = vi.fn().mockResolvedValue(mockCache);

      const result = await cacheService.getMasterCache();

      // CacheService returns data as-is now
      expect((result.entries.user?.[0] as any)?.groups).toEqual(['Group1', 'Group2']);
    });
  });

  describe('getAsset returns data as-is', () => {
    it('should return user groups without filtering', async () => {
      const mockUser = {
        id: 'user1',
        name: 'User One',
        groups: ['ActiveGroup', 'DeletedGroup'],
      };

      mockCacheReader.getAsset = vi.fn().mockResolvedValue(mockUser);

      const result = await cacheService.getAsset('user', 'user1');

      // CacheService now returns data as-is without filtering
      expect(result.groups).toEqual(['ActiveGroup', 'DeletedGroup']);
    });

    it('should not modify non-user assets', async () => {
      const mockDashboard = {
        id: 'dash1',
        name: 'Dashboard One',
        datasets: ['dataset1', 'dataset2'],
      };

      mockCacheReader.getAsset = vi.fn().mockResolvedValue(mockDashboard);

      const result = await cacheService.getAsset('dashboard', 'dash1');

      expect(result).toEqual(mockDashboard);
    });

    it('should handle null asset', async () => {
      mockCacheReader.getAsset = vi.fn().mockResolvedValue(null);

      const result = await cacheService.getAsset('user', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('Performance with large datasets', () => {
    it('should handle large numbers of users efficiently', async () => {
      const LARGE_USER_COUNT = 1000;
      const users = Array.from({ length: LARGE_USER_COUNT }, (_, i) => ({
        id: `user${i}`,
        groups: ['Group1', 'Group2', 'DeletedGroup'],
      }));

      const mockCache = {
        entries: {
          user: users,
          group: [{ assetName: 'Group1' }, { assetName: 'Group2' }],
        },
      };

      mockCacheReader.getMasterCache = vi.fn().mockResolvedValue(mockCache);

      const result = await cacheService.getMasterCache();

      result.entries.user.forEach((user: any) => {
        // CacheService returns data as-is without filtering
        expect(user.groups).toEqual(['Group1', 'Group2', 'DeletedGroup']);
      });
    });
  });
});

describe('CacheService - ETag revalidation', () => {
  let cacheService: CacheService;
  let mockS3Service: Mocked<S3Service>;

  const KEY = 'cache/activity-cache.json';
  const VALUE_V1 = { version: 1 };
  const VALUE_V2 = { version: 2 };
  const REVALIDATE_WINDOW_MS = 3000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (CacheService as any).instance = null;
    (CacheService as any).s3Service = null;

    mockS3Service = {
      getObject: vi.fn(),
      getObjectWithETag: vi.fn(),
      headObject: vi.fn(),
      putObject: vi.fn(),
      listObjects: vi.fn(),
    } as any;

    const S3ServiceMock = S3Service as unknown as MockedClass<typeof S3Service>;
    S3ServiceMock.mockImplementation(() => mockS3Service);

    cacheService = CacheService.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves the memory copy without any S3 call within the revalidation window', async () => {
    mockS3Service.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"etag-1"' });

    expect(await cacheService.get(KEY)).toEqual(VALUE_V1); // cold: S3 GET
    expect(await cacheService.get(KEY)).toEqual(VALUE_V1); // warm: memory

    expect(mockS3Service.getObjectWithETag).toHaveBeenCalledTimes(1);
    expect(mockS3Service.headObject).not.toHaveBeenCalled();
  });

  it('revalidates via HEAD after the window and serves memory when the ETag matches', async () => {
    mockS3Service.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"etag-1"' });
    mockS3Service.headObject.mockResolvedValue({ etag: '"etag-1"' });

    await cacheService.get(KEY);
    vi.advanceTimersByTime(REVALIDATE_WINDOW_MS + 1);

    expect(await cacheService.get(KEY)).toEqual(VALUE_V1);
    expect(mockS3Service.headObject).toHaveBeenCalledTimes(1);
    expect(mockS3Service.getObjectWithETag).toHaveBeenCalledTimes(1); // no second GET
  });

  it('re-fetches when the S3 ETag has changed (cross-instance write becomes visible)', async () => {
    mockS3Service.getObjectWithETag
      .mockResolvedValueOnce({ data: VALUE_V1, etag: '"etag-1"' })
      .mockResolvedValueOnce({ data: VALUE_V2, etag: '"etag-2"' });
    mockS3Service.headObject.mockResolvedValue({ etag: '"etag-2"' });

    await cacheService.get(KEY);
    vi.advanceTimersByTime(REVALIDATE_WINDOW_MS + 1);

    expect(await cacheService.get(KEY)).toEqual(VALUE_V2);
    expect(mockS3Service.getObjectWithETag).toHaveBeenCalledTimes(2);
  });

  it('drops the memory copy when the object no longer exists in S3', async () => {
    mockS3Service.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"etag-1"' });
    const notFound = Object.assign(new Error('NotFound'), { name: 'NotFound' });
    mockS3Service.headObject.mockRejectedValue(notFound);

    await cacheService.get(KEY);
    vi.advanceTimersByTime(REVALIDATE_WINDOW_MS + 1);

    expect(await cacheService.get(KEY)).toBeNull();
  });

  it('serves the memory copy when the HEAD fails transiently', async () => {
    mockS3Service.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"etag-1"' });
    mockS3Service.headObject.mockRejectedValue(new Error('Timeout'));

    await cacheService.get(KEY);
    vi.advanceTimersByTime(REVALIDATE_WINDOW_MS + 1);

    expect(await cacheService.get(KEY)).toEqual(VALUE_V1);
    expect(mockS3Service.getObjectWithETag).toHaveBeenCalledTimes(1);
  });

  it('put() seeds memory with the new ETag so the writing instance reads its own write', async () => {
    mockS3Service.putObject.mockResolvedValue('"etag-new"');

    await cacheService.put(KEY, VALUE_V2);

    expect(await cacheService.get(KEY)).toEqual(VALUE_V2);
    expect(mockS3Service.getObjectWithETag).not.toHaveBeenCalled();
  });
});
