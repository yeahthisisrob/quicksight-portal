import pLimit from 'p-limit';

import { exportCacheManager } from './ExportCache';
import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import { MATH_CONSTANTS } from '../../../shared/constants';
import { withRetry } from '../../../shared/utils/awsRetry';
import { logger } from '../../../shared/utils/logger';

interface BulkFetchOptions<T> {
  // Asset IDs to fetch data for
  assetIds: string[];
  // Function to fetch data for a single asset
  fetchSingle: (assetId: string) => Promise<T>;
  // Cache key prefix (e.g., 'permissions', 'tags')
  cachePrefix: string;
  // Asset type for logging
  assetType: string;
  // Operation name for logging
  operationName: string;
  // Max concurrent fetches
  maxConcurrency?: number;
  // Batch size for processing
  batchSize?: number;
}

interface BulkFetchResult<T> {
  data: Map<string, T>;
  cached: number;
  fetched: number;
  errors: number;
  duration: number;
}

/**
 * Utility for bulk fetching auxiliary data (permissions, tags) with caching
 */
export class BulkOperations {
  /**
   * Bulk fetch data for multiple assets with caching and concurrency control
   */
  public static async bulkFetch<T>(options: BulkFetchOptions<T>): Promise<BulkFetchResult<T>> {
    const {
      assetIds,
      fetchSingle,
      cachePrefix,
      assetType,
      operationName,
      maxConcurrency = EXPORT_CONFIG.concurrency.auxiliaryOperations,
      batchSize = EXPORT_CONFIG.batch.assetBatchSize,
    } = options;

    const startTime = Date.now();
    const result: BulkFetchResult<T> = {
      data: new Map(),
      cached: 0,
      fetched: 0,
      errors: 0,
      duration: 0,
    };

    if (assetIds.length === 0) {
      return result;
    }

    // Get the appropriate cache based on type
    const cache =
      cachePrefix === 'permissions'
        ? exportCacheManager.getPermissionsCache()
        : cachePrefix === 'tags'
          ? exportCacheManager.getTagsCache()
          : exportCacheManager.getMetadataCache();

    // First pass: check cache
    const toFetch: string[] = [];
    for (const assetId of assetIds) {
      const cacheKey = `${cachePrefix}:${assetId}`;
      const cached = cache.get(cacheKey);

      if (cached !== undefined) {
        result.data.set(assetId, cached);
        result.cached++;
      } else {
        toFetch.push(assetId);
      }
    }

    // Second pass: fetch missing data in batches
    if (toFetch.length > 0) {
      const limit = pLimit(maxConcurrency);

      // Process in batches to avoid overwhelming the API
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);

        const batchPromises = batch.map((assetId) =>
          limit(async () => {
            try {
              // Fetch with retry
              const data = await withRetry(
                () => fetchSingle(assetId),
                `${operationName}(${assetId})`,
                {
                  maxRetries: EXPORT_CONFIG.retry.maxRetries,
                  baseDelay: EXPORT_CONFIG.retry.baseDelay,
                  maxDelay: EXPORT_CONFIG.retry.maxDelay,
                }
              );

              // Cache the result
              const cacheKey = `${cachePrefix}:${assetId}`;
              cache.set(cacheKey, data);

              // Store in result
              result.data.set(assetId, data);
              result.fetched++;
            } catch (error) {
              logger.error(`Failed to fetch ${operationName} for ${assetId}:`, error);
              result.errors++;

              // Store empty/default value on error
              result.data.set(assetId, (cachePrefix === 'permissions' ? [] : {}) as T);
            }
          })
        );

        await Promise.all(batchPromises);

        // No delay needed - rate limiter handles throttling
      }
    }

    result.duration = Date.now() - startTime;

    logger.info(`Bulk ${operationName} completed for ${assetType}:`, {
      total: assetIds.length,
      cached: result.cached,
      fetched: result.fetched,
      errors: result.errors,
      duration: result.duration,
      cacheHitRate: `${((result.cached / assetIds.length) * MATH_CONSTANTS.PERCENTAGE_MULTIPLIER).toFixed(1)}%`,
    });

    return result;
  }

  /**
   * Bulk fetch permissions for multiple assets
   */
  public static async bulkFetchPermissions(
    assetIds: string[],
    assetType: string,
    fetchPermissions: (assetId: string) => Promise<any[]>
  ): Promise<Map<string, any[]>> {
    const result = await this.bulkFetch({
      assetIds,
      fetchSingle: fetchPermissions,
      cachePrefix: 'permissions',
      assetType,
      operationName: 'permissions',
    });

    return result.data;
  }

  /**
   * Bulk fetch both permissions and tags for multiple assets
   */
  public static async bulkFetchPermissionsAndTags(
    assetIds: string[],
    assetType: string,
    fetchPermissions: (assetId: string) => Promise<any[]>,
    fetchTags: (assetId: string) => Promise<Record<string, string>>
  ): Promise<{
    permissions: Map<string, any[]>;
    tags: Map<string, Record<string, string>>;
  }> {
    // Fetch permissions and tags in parallel
    const [permissions, tags] = await Promise.all([
      this.bulkFetchPermissions(assetIds, assetType, fetchPermissions),
      this.bulkFetchTags(assetIds, assetType, fetchTags),
    ]);

    return { permissions, tags };
  }

  /**
   * Bulk fetch tags for multiple assets
   */
  public static async bulkFetchTags(
    assetIds: string[],
    assetType: string,
    fetchTags: (assetId: string) => Promise<Record<string, string>>
  ): Promise<Map<string, Record<string, string>>> {
    const result = await this.bulkFetch({
      assetIds,
      fetchSingle: fetchTags,
      cachePrefix: 'tags',
      assetType,
      operationName: 'tags',
    });

    return result.data;
  }
}
