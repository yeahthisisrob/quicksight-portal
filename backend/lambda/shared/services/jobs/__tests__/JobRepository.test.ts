import { vi, type Mocked } from 'vitest';

import { S3Service } from '../../aws/S3Service';
import { CacheService } from '../../cache/CacheService';
import { JobRepository, type JobMetadata } from '../JobRepository';

// Test constants
const TEST_CONSTANTS = {
  TEST_YEAR: 2025,
  RETRY_COUNT: 3,
  SMALL_BATCH: 5,
  MEDIUM_BATCH: 10,
} as const;

// Mock dependencies
vi.mock('../../aws/S3Service');
vi.mock('../../cache/CacheService');
vi.mock('../../../utils/logger');

// Test data factories
const createMockJob = (overrides = {}): JobMetadata => ({
  jobId: 'export-123',
  jobType: 'export',
  status: 'completed',
  progress: 100,
  message: 'Export completed successfully',
  startTime: '2025-01-01T00:00:00.000Z',
  endTime: '2025-01-01T00:05:00.000Z',
  duration: 300000,
  stats: {
    totalAssets: 10,
    processedAssets: 10,
    failedAssets: 0,
    operations: { describeDashboard: 10, describeDataset: 20 },
  },
  ...overrides,
});

const createMockJobs = (): JobMetadata[] => [
  createMockJob({
    jobId: 'export-123',
    status: 'completed',
    startTime: '2025-01-01T00:00:00.000Z',
  }),
  createMockJob({
    jobId: 'export-456',
    status: 'processing',
    progress: 50,
    startTime: '2025-01-01T00:01:00.000Z',
    endTime: undefined,
    duration: undefined,
  }),
];

describe('JobRepository', () => {
  let repository: JobRepository;
  let mockS3Service: Mocked<S3Service>;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockS3Service = new S3Service('test-account') as Mocked<S3Service>;

    // Mock CacheService.getInstance to return our mock
    mockCacheService = {
      getJobIndex: vi.fn(),
      updateJobIndex: vi.fn(),
      setBucketName: vi.fn(),
      persistJobIndex: vi.fn(),
    } as any;

    (CacheService.getInstance as any) = vi.fn().mockReturnValue(mockCacheService);

    // Create repository instance
    repository = new JobRepository(mockS3Service, 'test-bucket');
  });

  describe('listJobs', () => {
    it('should return jobs from cache service', async () => {
      // Arrange
      const mockJobs = createMockJobs();

      mockCacheService.getJobIndex.mockResolvedValue(mockJobs);

      // Act
      const result = await repository.listJobs({ jobType: 'export' });

      // Assert
      expect(mockCacheService.getJobIndex).toHaveBeenCalled();
      // Jobs are sorted by start time descending (newest first)
      expect(result).toEqual([mockJobs[1], mockJobs[0]]);
    });

    it('should return empty array when cache returns empty', async () => {
      // Arrange
      mockCacheService.getJobIndex.mockResolvedValue([]);

      // Act
      const result = await repository.listJobs({ jobType: 'export' });

      // Assert
      expect(mockCacheService.getJobIndex).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should filter jobs by type', async () => {
      // Arrange
      const mockJobs = [
        {
          jobId: 'export-123',
          jobType: 'export',
          status: 'completed',
          startTime: '2025-01-01T00:00:00.000Z',
        },
        {
          jobId: 'deploy-456',
          jobType: 'deploy',
          status: 'completed',
          startTime: '2025-01-01T00:01:00.000Z',
        },
      ];

      mockCacheService.getJobIndex.mockResolvedValue(mockJobs);

      // Act
      const result = await repository.listJobs({ jobType: 'export' });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.jobType).toBe('export');
    });

    it('should filter jobs by status', async () => {
      // Arrange
      const mockJobs = [
        {
          jobId: 'export-123',
          jobType: 'export',
          status: 'completed',
          startTime: '2025-01-01T00:00:00.000Z',
        },
        {
          jobId: 'export-456',
          jobType: 'export',
          status: 'processing',
          startTime: '2025-01-01T00:01:00.000Z',
        },
      ];

      mockCacheService.getJobIndex.mockResolvedValue(mockJobs);

      // Act
      const result = await repository.listJobs({
        jobType: 'export',
        status: 'completed',
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('completed');
    });

    it('should sort jobs by start time descending', async () => {
      // Arrange
      const mockJobs = [
        {
          jobId: 'export-old',
          jobType: 'export',
          status: 'completed',
          startTime: '2025-01-01T00:00:00.000Z',
        },
        {
          jobId: 'export-new',
          jobType: 'export',
          status: 'completed',
          startTime: '2025-01-02T00:00:00.000Z',
        },
        {
          jobId: 'export-middle',
          jobType: 'export',
          status: 'completed',
          startTime: '2025-01-01T12:00:00.000Z',
        },
      ];

      mockCacheService.getJobIndex.mockResolvedValue(mockJobs);

      // Act
      const result = await repository.listJobs({ jobType: 'export' });

      // Assert
      expect(result[0]?.jobId).toBe('export-new');
      expect(result[1]?.jobId).toBe('export-middle');
      expect(result[2]?.jobId).toBe('export-old');
    });

    it('should apply limit correctly', async () => {
      // Arrange
      const mockJobs = Array.from({ length: 100 }, (_, i) => ({
        jobId: `export-${i}`,
        jobType: 'export',
        status: 'completed',
        startTime: new Date(TEST_CONSTANTS.TEST_YEAR, 0, 1, 0, i).toISOString(),
      }));

      mockCacheService.getJobIndex.mockResolvedValue(mockJobs);

      // Act
      const result = await repository.listJobs({
        jobType: 'export',
        limit: TEST_CONSTANTS.MEDIUM_BATCH,
      });

      // Assert
      expect(result).toHaveLength(TEST_CONSTANTS.MEDIUM_BATCH);
    });

    it('should handle cache service errors gracefully', async () => {
      // Arrange
      mockCacheService.getJobIndex.mockRejectedValue(new Error('Cache error'));

      // Act
      const result = await repository.listJobs();

      // Assert - errors are caught and empty array returned
      expect(result).toEqual([]);
    });

    it('should handle undefined/null from cache', async () => {
      // Arrange
      mockCacheService.getJobIndex.mockResolvedValue(undefined as any);

      // Act
      const result = await repository.listJobs();

      // Assert
      expect(result).toEqual([]);
    });
  });
});

describe('JobRepository - createJob', () => {
  let repository: JobRepository;
  let mockS3Service: Mocked<S3Service>;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Service = new S3Service('test-account') as Mocked<S3Service>;
    mockCacheService = {
      getJobIndex: vi.fn(),
      updateJobIndex: vi.fn(),
      setBucketName: vi.fn(),
      persistJobIndex: vi.fn(),
    } as any;
    (CacheService.getInstance as any) = vi.fn().mockReturnValue(mockCacheService);
    repository = new JobRepository(mockS3Service, 'test-bucket');
  });

  describe('createJob', () => {
    it('should save job to cache only', async () => {
      // Arrange
      const jobMetadata = {
        jobId: 'export-789',
        jobType: 'export' as const,
        status: 'queued' as const,
        progress: 0,
        message: 'Job queued',
        startTime: '2025-01-01T00:00:00.000Z',
      };

      mockCacheService.getJobIndex.mockResolvedValue([]);
      mockS3Service.putObject.mockResolvedValue(undefined);

      // Act
      await repository.createJob(jobMetadata);

      // Assert
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
      expect(mockCacheService.updateJobIndex).toHaveBeenCalledWith([jobMetadata]);
    });
  });
});

describe('JobRepository - updateJob', () => {
  let repository: JobRepository;
  let mockS3Service: Mocked<S3Service>;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Service = new S3Service('test-account') as Mocked<S3Service>;
    mockCacheService = {
      getJobIndex: vi.fn(),
      updateJobIndex: vi.fn(),
      setBucketName: vi.fn(),
      persistJobIndex: vi.fn(),
    } as any;
    (CacheService.getInstance as any) = vi.fn().mockReturnValue(mockCacheService);
    repository = new JobRepository(mockS3Service, 'test-bucket');
  });

  describe('updateJob', () => {
    it('should update job in cache only', async () => {
      // Arrange
      const existingJob = createMockJob({
        jobId: 'export-123',
        status: 'processing' as const,
        progress: 50,
        startTime: '2025-01-01T00:00:00.000Z',
        endTime: undefined,
        duration: undefined,
      });

      const updates = {
        status: 'completed' as const,
        progress: 100,
        endTime: '2025-01-01T00:01:00.000Z',
      };

      mockCacheService.getJobIndex.mockResolvedValue([existingJob]);

      // Act
      await repository.updateJob('export-123', updates);

      // Assert
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
      expect(mockCacheService.updateJobIndex).toHaveBeenCalledWith([
        expect.objectContaining({
          ...existingJob,
          ...updates,
          duration: 60000, // Should calculate duration
        }),
      ]);
    });
  });
});

describe('JobRepository - Memory-first pattern', () => {
  let repository: JobRepository;
  let mockS3Service: Mocked<S3Service>;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Service = new S3Service('test-account') as Mocked<S3Service>;
    mockCacheService = {
      getJobIndex: vi.fn(),
      updateJobIndex: vi.fn(),
      setBucketName: vi.fn(),
      persistJobIndex: vi.fn(),
    } as any;
    (CacheService.getInstance as any) = vi.fn().mockReturnValue(mockCacheService);
    repository = new JobRepository(mockS3Service, 'test-bucket');
  });

  describe('Memory-first pattern with scheduled persistence', () => {
    beforeEach(() => {
      // Use fake timers for this test suite
      vi.useFakeTimers();
      vi.spyOn(global, 'setTimeout');
      vi.spyOn(global, 'clearTimeout');
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should persist immediately when job completes', async () => {
      // Arrange
      const existingJob = {
        jobId: 'test-job',
        jobType: 'export',
        status: 'processing',
        startTime: '2025-01-01T00:00:00.000Z',
      };
      mockCacheService.getJobIndex.mockResolvedValue([existingJob]);

      // Act - update job to completed
      await repository.updateJob('test-job', { status: 'completed' });

      // Assert - persistence should happen immediately (not scheduled)
      expect(mockCacheService.persistJobIndex).toHaveBeenCalled();
      // No setTimeout for completed status
      expect(global.setTimeout).not.toHaveBeenCalled();
    });

    it('should persist immediately when job fails', async () => {
      // Arrange
      const existingJob = {
        jobId: 'test-job',
        jobType: 'export',
        status: 'processing',
        startTime: '2025-01-01T00:00:00.000Z',
      };
      mockCacheService.getJobIndex.mockResolvedValue([existingJob]);

      // Act - update job to failed
      await repository.updateJob('test-job', { status: 'failed', error: 'Test error' });

      // Assert - persistence should happen immediately (not scheduled)
      expect(mockCacheService.persistJobIndex).toHaveBeenCalled();
      // No setTimeout for failed status
      expect(global.setTimeout).not.toHaveBeenCalled();
    });

    it('should persist immediately for multiple completed jobs', async () => {
      // Arrange
      const jobs = [
        {
          jobId: 'job-1',
          jobType: 'export',
          status: 'processing',
          startTime: '2025-01-01T00:00:00.000Z',
        },
        {
          jobId: 'job-2',
          jobType: 'export',
          status: 'processing',
          startTime: '2025-01-01T00:00:00.000Z',
        },
        {
          jobId: 'job-3',
          jobType: 'export',
          status: 'processing',
          startTime: '2025-01-01T00:00:00.000Z',
        },
      ];

      // Mock getJobIndex to return all jobs (it's called for each update)
      mockCacheService.getJobIndex.mockResolvedValue(jobs);

      // Act - complete multiple jobs rapidly
      await repository.updateJob('job-1', { status: 'completed' });
      await repository.updateJob('job-2', { status: 'completed' });
      await repository.updateJob('job-3', { status: 'completed' });

      // Assert - persistence should be called immediately for each completion
      // (3 times total since each completed job triggers immediate persistence)
      expect(mockCacheService.persistJobIndex).toHaveBeenCalledTimes(TEST_CONSTANTS.RETRY_COUNT);
      // No setTimeout for completed status
      expect(global.setTimeout).not.toHaveBeenCalled();
    });

    it('should persist immediately for progress updates', async () => {
      // Arrange
      const existingJob = {
        jobId: 'test-job',
        jobType: 'export',
        status: 'processing',
        startTime: '2025-01-01T00:00:00.000Z',
      };
      mockCacheService.getJobIndex.mockResolvedValue([existingJob]);

      // Act - update job progress (not a terminal status)
      await repository.updateJob('test-job', { progress: 50, message: 'Processing...' });

      // Assert - persistence should happen immediately now
      expect(mockCacheService.persistJobIndex).toHaveBeenCalled();
      expect(global.setTimeout).not.toHaveBeenCalled();
    });
  });

  describe('forcePersist', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(global, 'setTimeout');
      vi.spyOn(global, 'clearTimeout');
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should immediately persist job index', async () => {
      // Act
      await repository.forcePersist();

      // Assert
      expect(mockCacheService.persistJobIndex).toHaveBeenCalledTimes(1);
    });

    it('should persist immediately without timer management', async () => {
      // Arrange - update job with progress (not terminal status)
      const existingJob = {
        jobId: 'test-job',
        jobType: 'export',
        status: 'processing',
        startTime: '2025-01-01T00:00:00.000Z',
      };
      mockCacheService.getJobIndex.mockResolvedValue([existingJob]);

      // Update with progress (this now persists immediately)
      await repository.updateJob('test-job', { progress: 50, message: 'In progress' });

      // Should persist immediately without timer
      expect(mockCacheService.persistJobIndex).toHaveBeenCalledTimes(1);
      expect(global.setTimeout).not.toHaveBeenCalled();

      // Act - force persist
      await repository.forcePersist();

      // Assert - should persist again
      expect(mockCacheService.persistJobIndex).toHaveBeenCalledTimes(2);
      // No timer management needed anymore
      expect(global.clearTimeout).not.toHaveBeenCalled();
    });

    it('should propagate errors from persistence', async () => {
      // Arrange
      const error = new Error('S3 write failed');
      mockCacheService.persistJobIndex = vi.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(repository.forcePersist()).rejects.toThrow('S3 write failed');
    });
  });
});

describe('JobRepository - Memory updates', () => {
  let repository: JobRepository;
  let mockS3Service: Mocked<S3Service>;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Service = new S3Service('test-account') as Mocked<S3Service>;
    mockCacheService = {
      getJobIndex: vi.fn(),
      updateJobIndex: vi.fn(),
      setBucketName: vi.fn(),
      persistJobIndex: vi.fn(),
    } as any;
    (CacheService.getInstance as any) = vi.fn().mockReturnValue(mockCacheService);
    repository = new JobRepository(mockS3Service, 'test-bucket');
  });

  describe('Memory updates are instant', () => {
    it('should update memory immediately without waiting for S3', async () => {
      // Arrange
      const initialJobs = [
        {
          jobId: 'job-1',
          jobType: 'export',
          status: 'processing',
          startTime: '2025-01-01T00:00:00.000Z',
        },
      ];
      mockCacheService.getJobIndex.mockResolvedValue(initialJobs);

      // Act - create a new job
      await repository.createJob({
        jobId: 'job-2',
        jobType: 'export',
        status: 'queued',
        startTime: '2025-01-01T00:01:00.000Z',
      });

      // Assert - memory should be updated immediately
      expect(mockCacheService.updateJobIndex).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ jobId: 'job-1' }),
          expect.objectContaining({ jobId: 'job-2' }),
        ])
      );

      // Persistence IS triggered immediately on create (for UI visibility)
      expect(mockCacheService.persistJobIndex).toHaveBeenCalled();
    });

    it('should allow concurrent reads while updates are happening', async () => {
      // Arrange
      const jobs = [];
      for (let i = 0; i < TEST_CONSTANTS.SMALL_BATCH; i++) {
        jobs.push({
          jobId: `job-${i}`,
          jobType: 'export',
          status: 'processing',
          startTime: '2025-01-01T00:00:00.000Z',
        });
      }
      mockCacheService.getJobIndex.mockResolvedValue(jobs);

      // Act - concurrent operations
      const operations = [
        repository.listJobs({ limit: 10 }),
        repository.updateJob('job-0', { progress: 50 }),
        repository.listJobs({ jobType: 'export' }),
        repository.updateJob('job-1', { progress: 75 }),
        repository.getJob('job-2'),
      ];

      const results = await Promise.all(operations);

      // Assert - all operations should complete successfully
      expect(results[0]).toHaveLength(TEST_CONSTANTS.SMALL_BATCH); // First listJobs
      expect(results[2]).toHaveLength(TEST_CONSTANTS.SMALL_BATCH); // Second listJobs
      const job = results[4] as JobMetadata | null;
      expect(job?.jobId).toBe('job-2'); // getJob

      // Memory updates should have been called
      expect(mockCacheService.updateJobIndex).toHaveBeenCalled();
    });
  });
});
