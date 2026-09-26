/**
 * Centralized configuration for the export system
 *
 * Performance notes:
 * - All QuickSight API calls are rate limited to 10 req/s globally
 * - CloudTrail API calls are rate limited to 2 req/s
 * - High concurrency is safe since rate limiting handles throttling
 */

export const EXPORT_CONFIG = {
  concurrency: {
    // Max concurrent operations
    operations: parseInt(process.env.EXPORT_CONCURRENCY_OPERATIONS || '20', 10),
    // Max concurrent assets to process per type (reduced to prevent S3 rate limiting)
    perAssetType: parseInt(process.env.EXPORT_CONCURRENCY_PER_TYPE || '10', 10),
    // Max concurrent API calls within each asset processor
    perProcessor: parseInt(process.env.EXPORT_CONCURRENCY_PER_PROCESSOR || '20', 10),
    // Max concurrent operations for auxiliary operations
    auxiliaryOperations: parseInt(process.env.EXPORT_CONCURRENCY_AUX || '20', 10),
    // Max concurrent page fetches during listing
    pageFetch: parseInt(process.env.EXPORT_CONCURRENCY_PAGES || '5', 10),
  },

  // Pagination settings
  pagination: {
    defaultPageSize: 100,
    maxPageSize: 100,
    // Number of pages to fetch concurrently
    concurrentPages: 10,
  },

  // Retry configuration for transient errors (not throttling)
  retry: {
    maxRetries: parseInt(process.env.EXPORT_MAX_RETRIES || '5', 10),
    baseDelay: parseInt(process.env.EXPORT_RETRY_BASE_DELAY || '500', 10),
    maxDelay: parseInt(process.env.EXPORT_RETRY_MAX_DELAY || '10000', 10),
    jitterFactor: 0.3,
  },

  // Batch processing
  batch: {
    // Reduced batch size to prevent overwhelming S3 with concurrent writes
    assetBatchSize: parseInt(process.env.EXPORT_BATCH_ASSETS || '25', 10),
    batchDelay: 0,
  },

  // Caching configuration
  cache: {
    // TTL for in-memory metadata cache (ms)
    metadataTTL: parseInt(process.env.EXPORT_CACHE_METADATA_TTL || '300000', 10), // 5 minutes
    // TTL for permissions cache (ms)
    permissionsTTL: parseInt(process.env.EXPORT_CACHE_PERMISSIONS_TTL || '600000', 10), // 10 minutes
    // TTL for tags cache (ms)
    tagsTTL: parseInt(process.env.EXPORT_CACHE_TAGS_TTL || '600000', 10), // 10 minutes
    // Max cache size per type
    maxSize: parseInt(process.env.EXPORT_CACHE_MAX_SIZE || '5000', 10),
  },

  // Cache rebuild configuration
  cacheRebuild: {
    // Max concurrent S3 read operations during cache rebuild
    maxConcurrentReads: parseInt(process.env.CACHE_REBUILD_CONCURRENT_READS || '20', 10),
    // Max concurrent S3 write operations when saving cache files
    maxConcurrentWrites: parseInt(process.env.CACHE_REBUILD_CONCURRENT_WRITES || '3', 10),
    // Batch size for processing assets (used for progress logging)
    batchSize: parseInt(process.env.CACHE_REBUILD_BATCH_SIZE || '50', 10),
    // Progress logging interval (log every N assets)
    progressLogInterval: parseInt(process.env.CACHE_REBUILD_PROGRESS_INTERVAL || '50', 10),
  },

  // S3 operations configuration
  s3Operations: {
    // Max concurrent S3 operations for bulk operations (reduced to prevent rate limiting)
    maxConcurrentBulkOps: parseInt(process.env.S3_MAX_CONCURRENT_BULK_OPS || '10', 10),
    // Max concurrent S3 delete operations
    maxConcurrentDeletes: parseInt(process.env.S3_MAX_CONCURRENT_DELETES || '10', 10),
    // Max concurrent S3 operations for archive operations (lower to prevent timeouts)
    maxConcurrentArchiveOps: parseInt(process.env.S3_MAX_CONCURRENT_ARCHIVE_OPS || '3', 10),
  },
} as const;
