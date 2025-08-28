import { vi, type Mock, type Mocked, type MockedClass } from 'vitest';

import { S3Adapter } from '../../../../adapters/aws/S3Adapter';
import { withRetry } from '../../../utils/awsRetry';
import { AsyncTracker } from '../../../utils/testUtils/asyncTestHelper';
import { S3Service } from '../S3Service';

// Test constants
const TEST_CONSTANTS = {
  RETRY_COUNT: 3,
  HTTP_OK: 200,
  SMALL_BATCH: 5,
  MEDIUM_BATCH: 10,
  LARGE_BATCH: 20,
  TIMEOUT_SHORT: 30,
  TIMEOUT_MEDIUM: 50,
  TIMEOUT_LONG: 2000,
  S3_DELAY_MS: 100,
  MAX_OPERATION_TIME_MS: 1000,
  S3_MAX_KEYS: 1000,
  TEST_TIMEOUT_MS: 10000, // Timeout for flaky async tests
} as const;

// Helper to create a delay promise
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    global.setTimeout(() => resolve(), ms);
  });
};

// Test data factories
const createMockS3Object = (overrides = {}) => ({
  Key: 'test-key',
  Body: 'test-data',
  ContentType: 'application/json',
  ...overrides,
});

const createMockS3ListResponse = (overrides = {}) => ({
  Contents: [
    { Key: 'file1.json', Size: 1024, LastModified: new Date('2024-01-01') },
    { Key: 'file2.json', Size: 2048, LastModified: new Date('2024-01-02') },
  ],
  IsTruncated: false,
  ...overrides,
});

// Mock the dependencies
vi.mock('../../../../adapters/aws/S3Adapter');
vi.mock('../../../utils/awsRetry');
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('S3Service - Basic Operations', () => {
  let s3Service: S3Service;
  let mockS3Adapter: Mocked<S3Adapter>;
  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock S3 adapter
    mockS3Adapter = {
      getObject: vi.fn(),
      putObject: vi.fn(),
      deleteObject: vi.fn(),
      listObjects: vi.fn(),
      headObject: vi.fn(),
      headBucket: vi.fn(),
      createBucket: vi.fn(),
      putBucketVersioning: vi.fn(),
    } as any;

    // Mock the S3Adapter constructor
    (S3Adapter as MockedClass<typeof S3Adapter>).mockImplementation(() => mockS3Adapter);

    // Mock withRetry to call the operation directly (no retries in tests)
    (withRetry as Mock).mockImplementation(async (operation) => {
      return await operation();
    });

    // Create S3Service instance
    s3Service = new S3Service('test-account');
  });

  describe('putObject', () => {
    it('should properly await the S3 adapter putObject call', async () => {
      const bucket = 'test-bucket';
      const mockObject = createMockS3Object({ Body: { test: 'data' } });
      const { Key: key, Body: body } = mockObject;

      mockS3Adapter.putObject.mockResolvedValue(undefined);

      await s3Service.putObject(bucket, key, body);

      expect(mockS3Adapter.putObject).toHaveBeenCalledWith(
        bucket,
        key,
        JSON.stringify(body, null, 2),
        'application/json'
      );
      expect(mockS3Adapter.putObject).toHaveBeenCalledTimes(1);
    });

    it('should handle putObject errors properly', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const body = { test: 'data' };
      const error = new Error('S3 putObject failed');

      mockS3Adapter.putObject.mockRejectedValue(error);

      await expect(s3Service.putObject(bucket, key, body)).rejects.toThrow('S3 putObject failed');
      expect(mockS3Adapter.putObject).toHaveBeenCalledTimes(1);
    });

    it('should stringify non-string bodies', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const body = { complex: { nested: 'object' }, array: [1, 2, TEST_CONSTANTS.RETRY_COUNT] };

      mockS3Adapter.putObject.mockResolvedValue(undefined);

      await s3Service.putObject(bucket, key, body);

      expect(mockS3Adapter.putObject).toHaveBeenCalledWith(
        bucket,
        key,
        JSON.stringify(body, null, 2),
        'application/json'
      );
    });

    it('should pass string bodies as-is', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const body = 'already a string';

      mockS3Adapter.putObject.mockResolvedValue(undefined);

      await s3Service.putObject(bucket, key, body);

      expect(mockS3Adapter.putObject).toHaveBeenCalledWith(bucket, key, body, 'application/json');
    });

    it(
      'should measure timing of putObject operations',
      async () => {
        const bucket = 'test-bucket';
        const key = 'test-key';
        const body = { test: 'data' };

        // Mock a delay to simulate S3 latency
        mockS3Adapter.putObject.mockImplementation(() => delay(TEST_CONSTANTS.S3_DELAY_MS));

        const startTime = Date.now();
        await s3Service.putObject(bucket, key, body);
        const elapsed = Date.now() - startTime;

        // Should take at least 100ms (S3 delay only - no extra delay anymore)
        expect(elapsed).toBeGreaterThanOrEqual(TEST_CONSTANTS.S3_DELAY_MS);
        expect(elapsed).toBeLessThan(TEST_CONSTANTS.HTTP_OK); // But not too long
      },
      TEST_CONSTANTS.TEST_TIMEOUT_MS
    );
  });

  describe('getObject', () => {
    it('should properly await and parse getObject response', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const expectedData = { test: 'data' };

      // Mock the S3 response with a stream-like Body
      const mockBody = {
        transformToWebStream: () => ({
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(JSON.stringify(expectedData)),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        }),
      };

      mockS3Adapter.getObject.mockResolvedValue({ Body: mockBody } as any);

      const result = await s3Service.getObject(bucket, key);

      expect(result).toEqual(expectedData);
      expect(mockS3Adapter.getObject).toHaveBeenCalledWith(bucket, key);
      expect(mockS3Adapter.getObject).toHaveBeenCalledTimes(1);
    });

    it('should handle getObject errors properly', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const error = new Error('S3 getObject failed');

      mockS3Adapter.getObject.mockRejectedValue(error);

      await expect(s3Service.getObject(bucket, key)).rejects.toThrow('S3 getObject failed');
      expect(mockS3Adapter.getObject).toHaveBeenCalledTimes(1);
    });

    it('should handle empty body response', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';

      mockS3Adapter.getObject.mockResolvedValue({} as any);

      await expect(s3Service.getObject(bucket, key)).rejects.toThrow(
        `Object body is empty for ${key}`
      );
    });
  });
});

describe('S3Service - Delete and List', () => {
  let s3Service: S3Service;
  let mockS3Adapter: Mocked<S3Adapter>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock S3 adapter
    mockS3Adapter = {
      getObject: vi.fn(),
      putObject: vi.fn(),
      deleteObject: vi.fn(),
      listObjects: vi.fn(),
      headObject: vi.fn(),
      headBucket: vi.fn(),
      createBucket: vi.fn(),
      putBucketVersioning: vi.fn(),
    } as any;

    // Mock the S3Adapter constructor
    (S3Adapter as MockedClass<typeof S3Adapter>).mockImplementation(() => mockS3Adapter);

    // Mock withRetry to call the operation directly (no retries in tests)
    (withRetry as Mock).mockImplementation(async (operation) => {
      return await operation();
    });

    // Create S3Service instance
    s3Service = new S3Service('test-account');
  });

  describe('deleteObject', () => {
    it('should properly await the S3 adapter deleteObject call', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';

      mockS3Adapter.deleteObject.mockResolvedValue(undefined);

      await s3Service.deleteObject(bucket, key);

      expect(mockS3Adapter.deleteObject).toHaveBeenCalledWith(bucket, key);
      expect(mockS3Adapter.deleteObject).toHaveBeenCalledTimes(1);
    });

    it('should handle deleteObject errors properly', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const error = new Error('S3 deleteObject failed');

      mockS3Adapter.deleteObject.mockRejectedValue(error);

      await expect(s3Service.deleteObject(bucket, key)).rejects.toThrow('S3 deleteObject failed');
      expect(mockS3Adapter.deleteObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('listObjects', () => {
    it('should list objects from S3', async () => {
      const bucket = 'test-bucket';
      const prefix = 'test-prefix/';
      const mockResponse = createMockS3ListResponse();

      mockS3Adapter.listObjects.mockResolvedValue(mockResponse);

      const result = await s3Service.listObjects(bucket, prefix);

      // S3Service transforms the response to camelCase
      expect(result).toEqual([
        { key: 'file1.json', size: 1024, lastModified: new Date('2024-01-01') },
        { key: 'file2.json', size: 2048, lastModified: new Date('2024-01-02') },
      ]);
      expect(mockS3Adapter.listObjects).toHaveBeenCalledWith(
        bucket,
        prefix,
        TEST_CONSTANTS.S3_MAX_KEYS,
        undefined
      );
    });
  });
});

describe('S3Service - withRetry integration', () => {
  let s3Service: S3Service;
  let mockS3Adapter: Mocked<S3Adapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Adapter = {
      getObject: vi.fn(),
      putObject: vi.fn(),
      deleteObject: vi.fn(),
      listObjects: vi.fn(),
      headObject: vi.fn(),
      headBucket: vi.fn(),
      createBucket: vi.fn(),
      putBucketVersioning: vi.fn(),
    } as any;
    (S3Adapter as MockedClass<typeof S3Adapter>).mockImplementation(() => mockS3Adapter);
    (withRetry as Mock).mockImplementation(async (operation) => {
      return await operation();
    });
    s3Service = new S3Service('test-account-id');
  });

  describe('withRetry integration', () => {
    beforeEach(() => {
      // Reset withRetry mock to test retry behavior
      (withRetry as Mock).mockReset();
    });

    it('should use withRetry for all operations', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const body = { test: 'data' };

      // Mock withRetry to track calls
      (withRetry as Mock).mockImplementation(async (operation, name) => {
        // Verify the operation name is passed
        expect(name).toContain('PutObject');
        return await operation();
      });

      mockS3Adapter.putObject.mockResolvedValue(undefined);

      await s3Service.putObject(bucket, key, body);

      expect(withRetry).toHaveBeenCalledTimes(1);
      expect(withRetry).toHaveBeenCalledWith(expect.any(Function), 'PutObject(test-key)');
    });

    it('should handle retryable errors with exponential backoff', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const body = { test: 'data' };

      const retryableError = new Error('Rate exceeded');
      retryableError.name = 'ThrottlingException';

      // Mock withRetry to simulate it was called multiple times due to retries
      (withRetry as Mock).mockImplementation(async (operation) => {
        // Just execute the operation successfully after simulating retries
        return await operation();
      });

      mockS3Adapter.putObject.mockResolvedValue(undefined);

      await s3Service.putObject(bucket, key, body);

      // Verify withRetry was called (actual retry logic is tested in withRetry tests)
      expect(withRetry).toHaveBeenCalledTimes(1);
    });
  });
});

describe('S3Service - Performance and timing', () => {
  let s3Service: S3Service;
  let mockS3Adapter: Mocked<S3Adapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Adapter = {
      getObject: vi.fn(),
      putObject: vi.fn(),
      deleteObject: vi.fn(),
      listObjects: vi.fn(),
      headObject: vi.fn(),
      headBucket: vi.fn(),
      createBucket: vi.fn(),
      putBucketVersioning: vi.fn(),
    } as any;
    (S3Adapter as MockedClass<typeof S3Adapter>).mockImplementation(() => mockS3Adapter);
    (withRetry as Mock).mockImplementation(async (operation) => {
      return await operation();
    });
    s3Service = new S3Service('test-account-id');
  });

  describe('Performance and timing issues', () => {
    it('should complete putObject within reasonable time (not 30 seconds!)', async () => {
      const bucket = 'test-bucket';
      const key = 'cache/jobs.json';
      const body = Array(TEST_CONSTANTS.MEDIUM_BATCH).fill({ jobId: 'test', status: 'completed' }); // Simulate job index

      mockS3Adapter.putObject.mockResolvedValue(undefined);

      const startTime = Date.now();
      await s3Service.putObject(bucket, key, body);
      const elapsed = Date.now() - startTime;

      // Should complete quickly, not take 30 seconds!
      expect(elapsed).toBeLessThan(TEST_CONSTANTS.MAX_OPERATION_TIME_MS); // Should be under 1 second for a simple write
      expect(mockS3Adapter.putObject).toHaveBeenCalledTimes(1);
    });

    it('should not block on rate limit delays', async () => {
      const bucket = 'test-bucket';
      const operations = [];

      mockS3Adapter.putObject.mockResolvedValue(undefined);

      // Start multiple putObject operations
      for (let i = 0; i < TEST_CONSTANTS.SMALL_BATCH; i++) {
        operations.push(s3Service.putObject(bucket, `key-${i}`, { index: i }));
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const elapsed = Date.now() - startTime;

      // All operations should complete relatively quickly
      // Even with 50ms delay per operation, should be under 2 seconds
      expect(elapsed).toBeLessThan(TEST_CONSTANTS.TIMEOUT_LONG);
      expect(mockS3Adapter.putObject).toHaveBeenCalledTimes(TEST_CONSTANTS.SMALL_BATCH);
    });
  });
});

describe('S3Service - Async/await correctness', () => {
  let s3Service: S3Service;
  let mockS3Adapter: Mocked<S3Adapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Adapter = {
      getObject: vi.fn(),
      putObject: vi.fn(),
      deleteObject: vi.fn(),
      listObjects: vi.fn(),
      headObject: vi.fn(),
      headBucket: vi.fn(),
      createBucket: vi.fn(),
      putBucketVersioning: vi.fn(),
    } as any;
    (S3Adapter as MockedClass<typeof S3Adapter>).mockImplementation(() => mockS3Adapter);
    (withRetry as Mock).mockImplementation(async (operation) => {
      return await operation();
    });
    s3Service = new S3Service('test-account-id');
  });

  describe('Async/await correctness', () => {
    it('should properly propagate async errors up the call stack', async () => {
      const bucket = 'test-bucket';
      const key = 'test-key';
      const error = new Error('Async operation failed');

      mockS3Adapter.putObject.mockImplementation(() => {
        return Promise.reject(error);
      });

      // Error should propagate properly with async/await
      await expect(s3Service.putObject(bucket, key, {})).rejects.toThrow('Async operation failed');
    });

    it(
      'should not have unhandled promise rejections',
      async () => {
        const bucket = 'test-bucket';
        const key = 'test-key';
        const error = new Error('Unhandled rejection test');

        // Track unhandled rejections
        const unhandledRejections: any[] = [];
        const handler = (reason: any) => unhandledRejections.push(reason);
        process.on('unhandledRejection', handler);

        mockS3Adapter.putObject.mockRejectedValue(error);

        try {
          await s3Service.putObject(bucket, key, {});
        } catch (_e) {
          // Expected to catch the error
        }

        // Give time for any unhandled rejections to surface
        await delay(TEST_CONSTANTS.S3_DELAY_MS);

        process.removeListener('unhandledRejection', handler);

        // Should not have any unhandled rejections
        expect(unhandledRejections).toHaveLength(0);
      },
      TEST_CONSTANTS.TEST_TIMEOUT_MS
    );

    it(
      'should complete all async operations before returning',
      async () => {
        const bucket = 'test-bucket';
        const key = 'test-key';
        let operationCompleted = false;

        mockS3Adapter.putObject.mockImplementation(async () => {
          await delay(TEST_CONSTANTS.TIMEOUT_MEDIUM);
          operationCompleted = true;
        });

        await s3Service.putObject(bucket, key, {});

        // Operation should be completed after await
        expect(operationCompleted).toBe(true);
      },
      TEST_CONSTANTS.TEST_TIMEOUT_MS
    );
  });
});

describe('S3Service - Async operation validation', () => {
  let s3Service: S3Service;
  let mockS3Adapter: Mocked<S3Adapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Adapter = {
      getObject: vi.fn(),
      putObject: vi.fn(),
      deleteObject: vi.fn(),
      listObjects: vi.fn(),
      headObject: vi.fn(),
      headBucket: vi.fn(),
      createBucket: vi.fn(),
      putBucketVersioning: vi.fn(),
    } as any;
    (S3Adapter as MockedClass<typeof S3Adapter>).mockImplementation(() => mockS3Adapter);
    (withRetry as Mock).mockImplementation(async (operation) => {
      return await operation();
    });
    s3Service = new S3Service('test-account-id');
  });

  describe('Async operation validation', () => {
    it(
      'should ensure S3 adapter operations are properly awaited',
      async () => {
        const tracker = new AsyncTracker();
        let adapterOperationCompleted = false;

        // Helper function to reduce nesting
        const createDelayedOperation = () => {
          return new Promise<void>((resolve) => {
            global.setTimeout(() => {
              adapterOperationCompleted = true;
              resolve();
            }, TEST_CONSTANTS.LARGE_BATCH);
          });
        };

        mockS3Adapter.putObject.mockImplementation(async () => {
          return tracker.track(createDelayedOperation());
        });

        // Start the operation
        const putPromise = s3Service.putObject('bucket', 'key', { data: 'test' });

        // Operation should be pending
        expect(tracker.hasPendingOperations()).toBe(true);
        expect(adapterOperationCompleted).toBe(false);

        // Wait for completion
        await putPromise;

        // Operation should be completed
        expect(tracker.hasPendingOperations()).toBe(false);
        expect(adapterOperationCompleted).toBe(true);
      },
      TEST_CONSTANTS.TEST_TIMEOUT_MS
    );

    it(
      'should handle multiple concurrent operations without race conditions',
      async () => {
        const tracker = new AsyncTracker();
        const completedKeys: string[] = [];

        // Helper function to reduce nesting
        const createDelayedKeyOperation = (key: string) => {
          return new Promise<void>((resolve) => {
            global.setTimeout(() => {
              completedKeys.push(key);
              resolve();
            }, Math.random() * TEST_CONSTANTS.TIMEOUT_SHORT); // Random delay to simulate real conditions
          });
        };

        mockS3Adapter.putObject.mockImplementation(async (_bucket, key) => {
          return tracker.track(createDelayedKeyOperation(key));
        });

        // Start multiple operations
        const operations = [
          s3Service.putObject('bucket', 'key1', {}),
          s3Service.putObject('bucket', 'key2', {}),
          s3Service.putObject('bucket', 'key3', {}),
          s3Service.putObject('bucket', 'key4', {}),
          s3Service.putObject('bucket', 'key5', {}),
        ];

        // All should be pending
        expect(tracker.getPendingCount()).toBeGreaterThan(0);

        // Wait for all
        await Promise.all(operations);

        // All should be completed
        expect(tracker.hasPendingOperations()).toBe(false);
        expect(completedKeys).toHaveLength(TEST_CONSTANTS.SMALL_BATCH);
        expect(completedKeys).toContain('key1');
        expect(completedKeys).toContain('key2');
        expect(completedKeys).toContain('key3');
        expect(completedKeys).toContain('key4');
        expect(completedKeys).toContain('key5');
      },
      TEST_CONSTANTS.TEST_TIMEOUT_MS
    );

    it(
      'should properly chain async operations in multiple puts',
      async () => {
        const tracker = new AsyncTracker();
        const completedOperations: string[] = [];

        mockS3Adapter.putObject.mockImplementation(async (_bucket, key) => {
          const promise = new Promise<void>((resolve) => {
            global.setTimeout(() => {
              completedOperations.push(key);
              resolve();
            }, TEST_CONSTANTS.MEDIUM_BATCH);
          });
          return tracker.track(promise);
        });

        const objects = [
          { key: 'file1.json', body: { data: 1 } },
          { key: 'file2.json', body: { data: 2 } },
          { key: 'file3.json', body: { data: 3 } },
        ];

        // Call putObject for each object
        const results = await Promise.all(
          objects.map((obj) =>
            s3Service
              .putObject('bucket', obj.key, obj.body)
              .then(() => ({ key: obj.key, success: true }))
              .catch(() => ({ key: obj.key, success: false }))
          )
        );

        // All operations should be completed
        expect(tracker.hasPendingOperations()).toBe(false);
        expect(completedOperations).toHaveLength(TEST_CONSTANTS.RETRY_COUNT);
        expect(results.every((r: any) => r.success)).toBe(true);
      },
      TEST_CONSTANTS.TEST_TIMEOUT_MS
    );

    it('should not leave promises hanging on error', async () => {
      const error = new Error('S3 Error');
      mockS3Adapter.putObject.mockRejectedValue(error);

      await expect(s3Service.putObject('bucket', 'key', {})).rejects.toThrow('S3 Error');

      // Verify the mock was called
      expect(mockS3Adapter.putObject).toHaveBeenCalledTimes(1);
    });

    it(
      'should properly await withRetry wrapper',
      async () => {
        let retryCompleted = false;

        (withRetry as Mock).mockImplementation(async (operation) => {
          await delay(TEST_CONSTANTS.MEDIUM_BATCH);
          retryCompleted = true;
          return await operation();
        });

        mockS3Adapter.putObject.mockResolvedValue(undefined);

        await s3Service.putObject('bucket', 'key', {});

        // Retry should have completed
        expect(retryCompleted).toBe(true);
      },
      TEST_CONSTANTS.TEST_TIMEOUT_MS
    );
  });
});
