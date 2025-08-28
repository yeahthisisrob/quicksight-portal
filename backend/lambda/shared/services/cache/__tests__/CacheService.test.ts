import { vi, type Mocked, type MockedClass } from 'vitest';

// Mock dependencies first
vi.mock('../../aws/S3Service', () => ({ S3Service: vi.fn() }));

import { expectAsyncToComplete } from '../../../utils/testUtils/asyncTestHelper';
import { S3Service } from '../../aws/S3Service';
import { CacheService } from '../CacheService';

// Create a global mock S3Service that all describe blocks can use
const createMockS3Service = (): Mocked<S3Service> =>
  ({
    getObject: vi.fn(),
    putObject: vi.fn(),
    listObjects: vi.fn(),
  }) as any;

// Test constants
const TEST_CONSTANTS = {
  HTTP_OK: 200,
  RETRY_COUNT: 3,
  SMALL_BATCH: 5,
  MEDIUM_BATCH: 10,
  LARGE_BATCH: 20,
  PAGE_SIZE: 50,
  TTL_MS: 60000,
  MAX_OPERATION_TIME_MS: 100,
} as const;

// Helper to create a delay promise
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    global.setTimeout(() => resolve(), ms);
  });
};

// Test data factories
const createTestJob = (overrides = {}) => ({
  jobId: 'job-1',
  status: 'completed',
  startTime: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createTestJobs = () => [
  createTestJob({ jobId: 'job-1', status: 'completed', startTime: '2024-01-01T00:00:00Z' }),
  createTestJob({ jobId: 'job-2', status: 'processing', startTime: '2024-01-01T01:00:00Z' }),
  createTestJob({ jobId: 'job-3', status: 'queued', startTime: '2024-01-01T02:00:00Z' }),
];

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

describe('CacheService - Job Index Operations', () => {
  let cacheService: CacheService;
  let mockS3Service: Mocked<S3Service>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the singleton instance and static s3Service to ensure clean state
    (CacheService as any).instance = null;
    (CacheService as any).s3Service = null;

    // Create mock S3Service
    mockS3Service = {
      getObject: vi.fn(),
      putObject: vi.fn(),
      listObjects: vi.fn(),
    } as any;

    // Mock the S3Service constructor to return our mock
    const S3ServiceMock = S3Service as unknown as MockedClass<typeof S3Service>;
    S3ServiceMock.mockImplementation(() => mockS3Service);

    // Get the singleton instance
    cacheService = CacheService.getInstance();
  });

  describe('updateJobIndex', () => {
    const testJobs = createTestJobs();

    it('should update job index in memory cache only', async () => {
      await cacheService.updateJobIndex(testJobs);

      // Verify S3 putObject was NOT called (memory-first pattern)
      expect(mockS3Service.putObject).not.toHaveBeenCalled();

      // Verify memory cache was updated by trying to get the jobs
      const jobs = await cacheService.getJobIndex();
      expect(jobs).toEqual(testJobs);
    });

    it('should complete job index update quickly (not 30 seconds!)', async () => {
      mockS3Service.putObject.mockResolvedValue(undefined);

      const startTime = Date.now();
      await cacheService.updateJobIndex(testJobs);
      const elapsed = Date.now() - startTime;

      // Should complete in milliseconds, not 30 seconds
      expect(elapsed).toBeLessThan(TEST_CONSTANTS.MAX_OPERATION_TIME_MS);
    });

    it('should handle persistJobIndex S3 errors gracefully', async () => {
      const error = new Error('S3 PutObject failed');
      mockS3Service.putObject.mockRejectedValue(error);

      // updateJobIndex should succeed (memory only)
      await expect(cacheService.updateJobIndex(testJobs)).resolves.toBeUndefined();

      // persistJobIndex should fail with S3 error
      await expect(cacheService.persistJobIndex()).rejects.toThrow('S3 PutObject failed');
      expect(mockS3Service.putObject).toHaveBeenCalledTimes(1);
    });

    it('should handle large job arrays efficiently', async () => {
      // Create a large job array (simulating production scenario)
      const largeJobArray = Array(TEST_CONSTANTS.HTTP_OK)
        .fill(null)
        .map((_, i) => ({
          jobId: `job-${i}`,
          status:
            i % TEST_CONSTANTS.RETRY_COUNT === 0
              ? 'completed'
              : i % TEST_CONSTANTS.RETRY_COUNT === 1
                ? 'processing'
                : 'queued',
          startTime: new Date(Date.now() - i * TEST_CONSTANTS.TTL_MS).toISOString(),
          jobType: 'export',
          progress:
            i % TEST_CONSTANTS.RETRY_COUNT === 0
              ? TEST_CONSTANTS.MAX_OPERATION_TIME_MS
              : i % TEST_CONSTANTS.RETRY_COUNT === 1
                ? TEST_CONSTANTS.PAGE_SIZE
                : 0,
        }));

      const startTime = Date.now();
      await cacheService.updateJobIndex(largeJobArray);
      const elapsed = Date.now() - startTime;

      // Even with 200 jobs, should complete quickly (memory only)
      expect(elapsed).toBeLessThan(TEST_CONSTANTS.PAGE_SIZE);
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });

    it('should not block on S3 throttling since it only updates memory', async () => {
      // Even if S3 would throttle, updateJobIndex doesn't touch S3
      mockS3Service.putObject.mockImplementation(() => delay(TEST_CONSTANTS.MAX_OPERATION_TIME_MS));

      const startTime = Date.now();
      await cacheService.updateJobIndex(testJobs);
      const elapsed = Date.now() - startTime;

      // Should complete instantly (memory only, no S3)
      expect(elapsed).toBeLessThan(TEST_CONSTANTS.PAGE_SIZE);
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });
  });
});

describe('CacheService - getJobIndex', () => {
  let cacheService: CacheService;
  let mockS3Service: ReturnType<typeof createMockS3Service>;

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
  });

  describe('getJobIndex', () => {
    const testJobs = [
      createTestJob({ jobId: 'job-1', status: 'completed' }),
      createTestJob({ jobId: 'job-2', status: 'processing' }),
    ];

    it('should return jobs from memory cache if available', async () => {
      // Set jobs in memory cache
      (cacheService as any).memoryAdapter.set('jobs', testJobs);

      const result = await cacheService.getJobIndex();

      expect(result).toEqual(testJobs);
      // Should not call S3 when in memory cache
      expect(mockS3Service.getObject).not.toHaveBeenCalled();
    });

    it('should fetch from S3 if not in memory cache', async () => {
      mockS3Service.getObject.mockResolvedValue(testJobs);

      const result = await cacheService.getJobIndex();

      expect(result).toEqual(testJobs);
      expect(mockS3Service.getObject).toHaveBeenCalledWith(expect.any(String), 'cache/jobs.json');
    });

    it('should return empty array if job index does not exist', async () => {
      const error = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      mockS3Service.getObject.mockRejectedValue(error);

      const result = await cacheService.getJobIndex();

      expect(result).toEqual([]);
      expect(mockS3Service.getObject).toHaveBeenCalledTimes(1);
    });

    it('should complete getJobIndex quickly', async () => {
      mockS3Service.getObject.mockResolvedValue(testJobs);

      const startTime = Date.now();
      const result = await cacheService.getJobIndex();
      const elapsed = Date.now() - startTime;

      expect(result).toEqual(testJobs);
      expect(elapsed).toBeLessThan(TEST_CONSTANTS.MAX_OPERATION_TIME_MS);
    });
  });
});

describe('CacheService - Performance regression tests', () => {
  let cacheService: CacheService;
  let mockS3Service: ReturnType<typeof createMockS3Service>;

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
  });

  describe('Basic performance tests', () => {
    it('should handle concurrent job updates without blocking', async () => {
      mockS3Service.putObject.mockResolvedValue(undefined);
      mockS3Service.getObject.mockResolvedValue([]);

      const operations = [];

      // Simulate multiple concurrent job updates
      for (let i = 0; i < TEST_CONSTANTS.SMALL_BATCH; i++) {
        operations.push(
          cacheService.updateJobIndex([
            { jobId: `job-${i}`, status: 'processing', startTime: new Date().toISOString() },
          ])
        );
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const elapsed = Date.now() - startTime;

      // All operations should complete reasonably quickly (memory only)
      expect(elapsed).toBeLessThan(TEST_CONSTANTS.MAX_OPERATION_TIME_MS);
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });

    it('should not touch S3 so no retry issues', async () => {
      const error = new Error('S3 Service Unavailable');
      error.name = 'ServiceUnavailable';

      mockS3Service.putObject.mockRejectedValue(error);

      const startTime = Date.now();

      // updateJobIndex should succeed (memory only)
      await expect(cacheService.updateJobIndex([{ jobId: 'test' }])).resolves.toBeUndefined();

      const elapsed = Date.now() - startTime;

      // Should complete instantly
      expect(elapsed).toBeLessThan(TEST_CONSTANTS.PAGE_SIZE);
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });
  });
});

describe('CacheService - Async/Await validation', () => {
  let cacheService: CacheService;
  let mockS3Service: ReturnType<typeof createMockS3Service>;

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
  });

  describe('Async/Await validation', () => {
    it('should be truly async via process.nextTick', async () => {
      let hasCompleted = false;

      // Call updateJobIndex
      const updatePromise = cacheService.updateJobIndex([{ jobId: 'test-1' }]).then(() => {
        hasCompleted = true;
      });

      // Should not have completed synchronously
      expect(hasCompleted).toBe(false);

      // Wait for it to complete
      await updatePromise;

      // Now it should be completed
      expect(hasCompleted).toBe(true);
      // Should not touch S3
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });

    it('should properly await S3 getObject in getJobIndex', async () => {
      let s3OperationCompleted = false;

      mockS3Service.getObject.mockImplementation(async () => {
        // Simulate async operation without setTimeout
        await Promise.resolve();
        s3OperationCompleted = true;
        return [{ jobId: 'test-1' }];
      });

      // Clear memory cache to force S3 read
      (cacheService as any).memoryAdapter.clear();

      const result = await cacheService.getJobIndex();

      // S3 operation should be completed
      expect(s3OperationCompleted).toBe(true);
      expect(result).toEqual([{ jobId: 'test-1' }]);
    });

    it('should handle concurrent updateJobIndex calls properly', async () => {
      // Call updateJobIndex multiple times concurrently
      const promises = [
        cacheService.updateJobIndex([{ jobId: 'job-1' }]),
        cacheService.updateJobIndex([{ jobId: 'job-2' }]),
        cacheService.updateJobIndex([{ jobId: 'job-3' }]),
      ];

      // All promises should complete
      await Promise.all(promises);

      // Should not touch S3
      expect(mockS3Service.putObject).not.toHaveBeenCalled();

      // Last update should win in memory cache
      const jobs = await cacheService.getJobIndex();
      expect(jobs).toEqual([{ jobId: 'job-3' }]);
    });

    it('should complete within timeout using expectAsyncToComplete', async () => {
      await expectAsyncToComplete(
        () => cacheService.updateJobIndex([{ jobId: 'test' }]),
        TEST_CONSTANTS.HTTP_OK // 200ms timeout
      );

      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });

    it('should not encounter S3 errors since it only updates memory', async () => {
      const error = new Error('S3 Error');
      mockS3Service.putObject.mockRejectedValue(error);

      // Should succeed despite S3 mock error (memory only)
      await expect(cacheService.updateJobIndex([{ jobId: 'test' }])).resolves.toBeUndefined();

      // Verify S3 was not called
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });
  });
});

describe('CacheService - persistJobIndex', () => {
  let cacheService: CacheService;
  let mockS3Service: ReturnType<typeof createMockS3Service>;

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
  });

  describe('persistJobIndex', () => {
    it('should write memory cache to S3', async () => {
      const testJobs = [
        { jobId: 'job-1', status: 'completed' },
        { jobId: 'job-2', status: 'processing' },
      ];

      // First update memory
      await cacheService.updateJobIndex(testJobs);

      // Then persist to S3
      await cacheService.persistJobIndex();

      // Verify S3 was called with the jobs from memory
      expect(mockS3Service.putObject).toHaveBeenCalledWith(
        expect.any(String),
        'cache/jobs.json',
        testJobs
      );
    });

    it('should handle empty job list', async () => {
      // Clear memory cache
      await cacheService.updateJobIndex([]);

      // Persist empty list
      await cacheService.persistJobIndex();

      expect(mockS3Service.putObject).toHaveBeenCalledWith(
        expect.any(String),
        'cache/jobs.json',
        []
      );
    });

    it('should propagate S3 errors', async () => {
      const error = new Error('S3 Write Failed');
      mockS3Service.putObject.mockRejectedValue(error);

      await cacheService.updateJobIndex([{ jobId: 'test' }]);

      await expect(cacheService.persistJobIndex()).rejects.toThrow('S3 Write Failed');
    });
  });
});

describe('CacheService - Memory-first pattern integration', () => {
  let cacheService: CacheService;
  let mockS3Service: ReturnType<typeof createMockS3Service>;

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
  });

  describe('Memory-first pattern integration', () => {
    it('should allow reading from memory while S3 persist is pending', async () => {
      const initialJobs = [{ jobId: 'job-1', status: 'processing' }];
      const updatedJobs = [{ jobId: 'job-1', status: 'completed' }];

      // Set initial state
      await cacheService.updateJobIndex(initialJobs);

      // Update memory (instant)
      await cacheService.updateJobIndex(updatedJobs);

      // Immediately read - should get updated value from memory
      const jobs = await cacheService.getJobIndex();
      expect(jobs).toEqual(updatedJobs);

      // S3 hasn't been called yet
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });

    it('should handle rapid updates efficiently', async () => {
      // Simulate rapid job status updates
      for (let i = 0; i < TEST_CONSTANTS.MEDIUM_BATCH; i++) {
        await cacheService.updateJobIndex([
          { jobId: 'job-1', status: 'processing', progress: i * TEST_CONSTANTS.MEDIUM_BATCH },
        ]);
      }

      // All updates should be instant (memory only)
      expect(mockS3Service.putObject).not.toHaveBeenCalled();

      // Final state should be in memory
      const jobs = await cacheService.getJobIndex();
      expect(jobs).toEqual([{ jobId: 'job-1', status: 'processing', progress: 90 }]);

      // Now persist once
      await cacheService.persistJobIndex();
      expect(mockS3Service.putObject).toHaveBeenCalledTimes(1);
    });

    it('should maintain consistency between memory and S3 after persist', async () => {
      const testJobs = [
        { jobId: 'job-1', status: 'completed' },
        { jobId: 'job-2', status: 'failed' },
      ];

      // Update memory
      await cacheService.updateJobIndex(testJobs);

      // Read from memory
      const memoryJobs = await cacheService.getJobIndex();
      expect(memoryJobs).toEqual(testJobs);

      // Persist to S3
      await cacheService.persistJobIndex();

      // Clear memory cache to force S3 read
      (cacheService as any).memoryAdapter.delete('jobs');

      // Mock S3 to return what we persisted
      mockS3Service.getObject.mockResolvedValue(testJobs);

      // Read again - should fetch from S3 and match
      const s3Jobs = await cacheService.getJobIndex();
      expect(s3Jobs).toEqual(testJobs);
    });
  });
});

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
