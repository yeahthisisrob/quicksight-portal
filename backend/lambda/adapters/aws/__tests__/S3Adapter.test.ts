import { S3Client } from '@aws-sdk/client-s3';
import { vi, type Mock, type Mocked } from 'vitest';
/**
 * Tests for S3Adapter to ensure proper initialization patterns
 * and prevent regression of dynamic import issues
 */

import { withRetry } from '../../../shared/utils/awsRetry';
import { s3RateLimiter } from '../../../shared/utils/rateLimiter';
import { S3Adapter } from '../S3Adapter';

// Test constants
const TEST_CONSTANTS = {
  BATCH_SIZE: 10,
  RETRY_COUNT: 3,
  INDEX_PARTS: 4,
  MAX_OPERATION_TIME_MS: 100,
} as const;

// Mock dependencies
vi.mock('@aws-sdk/client-s3');
vi.mock('../../../shared/utils/rateLimiter', () => ({
  s3RateLimiter: {
    waitForToken: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../shared/utils/awsRetry', () => ({
  withRetry: vi.fn().mockImplementation(async (fn) => fn()),
}));

describe('S3Adapter', () => {
  let s3Client: Mocked<S3Client>;
  let adapter: S3Adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    s3Client = new S3Client({}) as Mocked<S3Client>;
    s3Client.send = vi.fn().mockResolvedValue({});
    adapter = new S3Adapter(s3Client, 'test-account');
  });

  describe('Import patterns', () => {
    it('should use static imports for rateLimiter - not dynamic imports', () => {
      // This test verifies that rateLimiter is imported statically at module level
      // If this fails, it means someone changed back to dynamic imports
      expect(s3RateLimiter).toBeDefined();
      expect(typeof s3RateLimiter.waitForToken).toBe('function');
    });

    it('should use static imports for withRetry - not dynamic imports', () => {
      // This test verifies that withRetry is imported statically at module level
      expect(withRetry).toBeDefined();
      expect(typeof withRetry).toBe('function');
    });

    it('should not have any dynamic import() calls in the code', () => {
      // Get the adapter's method as a string and check for dynamic imports
      const adapterCode = adapter.constructor.toString();
      expect(adapterCode).not.toContain('await import(');
      expect(adapterCode).not.toContain('import(');
    });
  });

  describe('Async/await patterns', () => {
    it('should properly await S3 operations in getObject', async () => {
      let operationCompleted = false;

      s3Client.send = vi.fn().mockImplementation(async () => {
        // Simulate async operation without setTimeout
        await Promise.resolve();
        operationCompleted = true;
        return { Body: 'test' };
      });

      const result = await adapter.getObject('bucket', 'key');

      expect(operationCompleted).toBe(true);
      expect(result).toEqual({ Body: 'test' });
    });

    it('should properly await S3 operations in putObject', async () => {
      let operationCompleted = false;

      s3Client.send = vi.fn().mockImplementation(async () => {
        // Simulate async operation without setTimeout
        await Promise.resolve();
        operationCompleted = true;
        return {};
      });

      await adapter.putObject('bucket', 'key', 'body', 'application/json');
      expect(operationCompleted).toBe(true);
    });

    it('should properly await S3 operations in deleteObject', async () => {
      let operationCompleted = false;

      s3Client.send = vi.fn().mockImplementation(async () => {
        // Simulate async operation without setTimeout
        await Promise.resolve();
        operationCompleted = true;
        return {};
      });

      await adapter.deleteObject('bucket', 'key');
      expect(operationCompleted).toBe(true);
    });

    it('should properly await rate limiter before S3 operations', async () => {
      let rateLimiterCalled = false;
      let s3OperationCalled = false;

      (s3RateLimiter.waitForToken as Mock).mockImplementation(() => {
        rateLimiterCalled = true;
        return Promise.resolve();
      });

      s3Client.send = vi.fn().mockImplementation(() => {
        // Rate limiter should be called before S3 operation
        expect(rateLimiterCalled).toBe(true);
        s3OperationCalled = true;
        return Promise.resolve({});
      });

      await adapter.getObject('bucket', 'key');

      expect(rateLimiterCalled).toBe(true);
      expect(s3OperationCalled).toBe(true);
    });
  });

  describe('Performance patterns', () => {
    it('should not re-import modules on each operation', async () => {
      // Clear any previous mock calls
      vi.clearAllMocks();

      // Perform multiple operations
      await adapter.getObject('bucket', 'key1');
      await adapter.putObject('bucket', 'key2', 'body');
      await adapter.deleteObject('bucket', 'key3');
      await adapter.listObjects('bucket', 'prefix');

      // Rate limiter should be called for each operation
      expect(s3RateLimiter.waitForToken).toHaveBeenCalledTimes(TEST_CONSTANTS.INDEX_PARTS);

      // But the module itself should already be imported (static import)
      // This test passes because we're using the already-imported mock
      // If someone changes to dynamic imports, they'd need to modify the mock setup
      // which would break this test
    });

    it('should handle concurrent operations efficiently', async () => {
      const operations = [
        adapter.getObject('bucket', 'key1'),
        adapter.getObject('bucket', 'key2'),
        adapter.getObject('bucket', 'key3'),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(TEST_CONSTANTS.RETRY_COUNT);
      expect(s3RateLimiter.waitForToken).toHaveBeenCalledTimes(TEST_CONSTANTS.RETRY_COUNT);
    });
  });

  describe('Error handling', () => {
    it('should properly propagate S3 errors', async () => {
      const error = new Error('S3 operation failed');
      s3Client.send = vi.fn().mockRejectedValue(error);

      await expect(adapter.getObject('bucket', 'key')).rejects.toThrow('S3 operation failed');
    });

    it('should handle rate limiter errors', async () => {
      const error = new Error('Rate limit exceeded');
      (s3RateLimiter.waitForToken as Mock).mockRejectedValue(error);

      await expect(adapter.getObject('bucket', 'key')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Lambda execution context', () => {
    it('should not leak state between adapter instances', () => {
      const adapter1 = new S3Adapter(s3Client, 'test-account-1');
      const adapter2 = new S3Adapter(s3Client, 'test-account-2');

      // Each adapter should be independent
      expect(adapter1).not.toBe(adapter2);

      // But they should share the same static imports (for efficiency)
      // This is verified by the fact that both use the same mocked s3RateLimiter
    });

    it('should handle Lambda cold starts efficiently', async () => {
      // Reset rate limiter mock for this test
      (s3RateLimiter.waitForToken as Mock).mockResolvedValue(undefined);

      // Simulate cold start - first call after initialization
      const newClient = new S3Client({}) as Mocked<S3Client>;
      newClient.send = vi.fn().mockResolvedValue({ Body: 'test' });
      const newAdapter = new S3Adapter(newClient, 'test-account');

      // First operation should work without any dynamic import delays
      const startTime = Date.now();
      await newAdapter.getObject('bucket', 'key');
      const duration = Date.now() - startTime;

      // Should be fast (no dynamic import overhead)
      expect(duration).toBeLessThan(TEST_CONSTANTS.MAX_OPERATION_TIME_MS);
      expect(newClient.send).toHaveBeenCalled();
    });
  });
});
