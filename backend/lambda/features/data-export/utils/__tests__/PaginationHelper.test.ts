import { vi, type Mock } from 'vitest';

import { withRetry } from '../../../../shared/utils/awsRetry';
import { logger } from '../../../../shared/utils/logger';
import { PaginationHelper } from '../PaginationHelper';

// Test constants
const TEST_ITEMS_COUNT = 3;
const TEST_BATCH_SIZE = 2;

// Mock dependencies
vi.mock('../../../../shared/utils/awsRetry');
vi.mock('../../../../shared/utils/logger');
vi.mock('../../../../shared/config/exportConfig', () => ({
  EXPORT_CONFIG: {
    pagination: {
      concurrentPages: 3,
    },
    batch: {
      assetBatchSize: 10,
    },
    concurrency: {
      perProcessor: 5,
    },
    retry: {
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 5000,
    },
  },
}));

describe('PaginationHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Configure withRetry to just call the function
    (withRetry as Mock).mockImplementation(async (fn) => fn());

    // Configure logger mocks
    (logger.info as Mock) = vi.fn();
    (logger.error as Mock) = vi.fn();
  });

  describe('fetchAllPages', () => {
    test('should fetch single page with no pagination', async () => {
      const mockItems = Array.from({ length: TEST_ITEMS_COUNT }, (_, i) => ({ id: i + 1 }));
      const mockFetchPage = vi.fn().mockResolvedValue({
        items: mockItems,
        nextToken: undefined,
      });

      const result = await PaginationHelper.fetchAllPages({
        fetchPage: mockFetchPage,
        operationName: 'TestOperation',
      });

      expect(mockFetchPage).toHaveBeenCalledTimes(1);
      expect(mockFetchPage).toHaveBeenCalledWith(undefined);
      expect(result.items).toEqual(mockItems);
      expect(result.totalPages).toBe(1);
      expect(result.totalItems).toBe(TEST_ITEMS_COUNT);
    });

    test('should fetch multiple pages', async () => {
      const page1Items = [{ id: 1 }];
      const page2Items = [{ id: 2 }];

      const mockFetchPage = vi
        .fn()
        .mockResolvedValueOnce({ items: page1Items, nextToken: 'token1' })
        .mockResolvedValueOnce({ items: page2Items, nextToken: undefined });

      const result = await PaginationHelper.fetchAllPages({
        fetchPage: mockFetchPage,
        operationName: 'TestOperation',
      });

      expect(mockFetchPage).toHaveBeenCalledTimes(2);
      expect(result.items).toEqual([...page1Items, ...page2Items]);
      expect(result.totalPages).toBe(2);
      expect(result.totalItems).toBe(2);
    });

    test('should handle errors', async () => {
      const error = new Error('Fetch failed');
      const mockFetchPage = vi.fn().mockRejectedValue(error);

      await expect(
        PaginationHelper.fetchAllPages({
          fetchPage: mockFetchPage,
          operationName: 'TestOperation',
        })
      ).rejects.toThrow('Fetch failed');
    });
  });

  describe('processItemsInBatches', () => {
    test('should process items in batches', async () => {
      const items = Array.from({ length: TEST_ITEMS_COUNT }, (_, i) => ({ id: i + 1 }));
      const mockProcessor = vi.fn().mockResolvedValue(undefined);

      await PaginationHelper.processItemsInBatches(items, mockProcessor, {
        batchSize: TEST_BATCH_SIZE,
        operationName: 'TestOperation',
      });

      expect(mockProcessor).toHaveBeenCalledTimes(TEST_ITEMS_COUNT);
      items.forEach((item, index) => {
        expect(mockProcessor).toHaveBeenCalledWith(item, index);
      });
    });

    test('should handle empty array', async () => {
      const mockProcessor = vi.fn();

      await PaginationHelper.processItemsInBatches([], mockProcessor, {
        operationName: 'TestOperation',
      });

      expect(mockProcessor).not.toHaveBeenCalled();
    });
  });

  describe('streamPages', () => {
    test('should stream and process items', async () => {
      const mockItems = [{ id: 1 }, { id: 2 }];
      const mockFetchPage = vi.fn().mockResolvedValue({
        items: mockItems,
        nextToken: undefined,
      });

      const processedItems: any[] = [];
      const mockProcessItem = vi.fn().mockImplementation(async (item) => {
        processedItems.push(item);
      });

      const result = await PaginationHelper.streamPages({
        fetchPage: mockFetchPage,
        processItem: mockProcessItem,
        operationName: 'TestOperation',
      });

      expect(mockFetchPage).toHaveBeenCalledTimes(1);
      expect(mockProcessItem).toHaveBeenCalledTimes(2);
      expect(processedItems).toEqual(mockItems);
      expect(result.totalItems).toBe(2);
    });
  });
});
