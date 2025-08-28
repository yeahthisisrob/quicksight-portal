import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import { withRetry } from '../../../shared/utils/awsRetry';
import { logger } from '../../../shared/utils/logger';

export interface PaginationOptions<T> {
  // Function to fetch a single page
  fetchPage: (nextToken?: string) => Promise<{
    items: T[];
    nextToken?: string;
  }>;
  // Optional page processor
  processPage?: (items: T[], pageNumber: number) => Promise<void>;
  // Max concurrent page fetches
  maxConcurrentPages?: number;
  // Page size (if configurable)
  pageSize?: number;
  // Item processor (if processing items individually)
  processItem?: (item: T, index: number) => Promise<void>;
  // Batch size for item processing
  itemBatchSize?: number;
  // Operation name for logging
  operationName: string;
}

export interface PaginationResult<T> {
  items: T[];
  totalPages: number;
  totalItems: number;
  duration: number;
}

/**
 * Generic pagination helper with concurrent page fetching and processing
 */
export class PaginationHelper {
  private static readonly config = EXPORT_CONFIG.pagination;

  /**
   * Fetch all pages with optional concurrent processing
   */
  public static async fetchAllPages<T>(
    options: PaginationOptions<T>
  ): Promise<PaginationResult<T>> {
    const startTime = Date.now();
    const {
      fetchPage,
      processPage,
      maxConcurrentPages = this.config.concurrentPages,
      operationName,
    } = options;

    const allItems: T[] = [];
    let totalPages = 0;
    let nextToken: string | undefined;

    // Create a limiter for concurrent page fetches
    const pageLimit = pLimit(maxConcurrentPages);
    const pagePromises: Promise<void>[] = [];

    do {
      const currentToken = nextToken;
      const pageNumber = totalPages;

      // Fetch page with retry
      const pagePromise = pageLimit(async () => {
        try {
          const result = await withRetry(() => fetchPage(currentToken), 'PaginationFetch', {
            maxRetries: EXPORT_CONFIG.retry.maxRetries,
            baseDelay: EXPORT_CONFIG.retry.baseDelay,
            maxDelay: EXPORT_CONFIG.retry.maxDelay,
          });

          // Store items
          allItems.push(...result.items);

          // Process page if handler provided
          if (processPage) {
            await processPage(result.items, pageNumber);
          }

          // Update next token for sequential pagination
          if (pageNumber === totalPages - 1) {
            nextToken = result.nextToken;
          }
        } catch (error) {
          logger.error(`${operationName}: Failed to fetch page ${pageNumber + 1}`, error);
          throw error;
        }
      });

      pagePromises.push(pagePromise);
      totalPages++;

      // For the first few pages, fetch sequentially to get next tokens
      // Then switch to concurrent fetching
      if (totalPages <= 2) {
        await pagePromise;
      }
    } while (nextToken);

    // Wait for all pages to complete
    await Promise.all(pagePromises);

    const duration = Date.now() - startTime;
    logger.info(`${operationName}: Pagination complete`, {
      totalPages,
      totalItems: allItems.length,
      duration,
    });

    return {
      items: allItems,
      totalPages,
      totalItems: allItems.length,
      duration,
    };
  }

  /**
   * Process items in batches with concurrency control
   */
  public static async processItemsInBatches<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<void>,
    options: {
      batchSize?: number;
      maxConcurrency?: number;
      batchDelay?: number;
      operationName: string;
    }
  ): Promise<void> {
    const {
      batchSize = EXPORT_CONFIG.batch.assetBatchSize,
      maxConcurrency = EXPORT_CONFIG.concurrency.perProcessor,
    } = options;

    const limit = pLimit(maxConcurrency);

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map((item, index) => limit(() => processor(item, i + index)));

      await Promise.all(batchPromises);

      // No delay needed - rate limiter handles throttling
    }
  }

  /**
   * Stream pages and process items as they arrive
   */
  public static async streamPages<T>(
    options: PaginationOptions<T> & {
      processItem: (item: T, index: number) => Promise<void>;
    }
  ): Promise<PaginationResult<T>> {
    const { processItem, itemBatchSize = EXPORT_CONFIG.batch.assetBatchSize } = options;

    let totalItems = 0;
    let totalPages = 0;

    // Process pages as they arrive
    const result = await this.fetchAllPages({
      ...options,
      processPage: async (items, pageNumber) => {
        // Process items in this page
        await this.processItemsInBatches(
          items,
          async (item, index) => {
            await processItem(item, totalItems + index);
          },
          {
            batchSize: itemBatchSize,
            operationName: `Streaming page ${pageNumber + 1}`,
          }
        );

        totalItems += items.length;
        totalPages = pageNumber + 1;
      },
    });

    return {
      ...result,
      totalItems,
      totalPages,
    };
  }
}
