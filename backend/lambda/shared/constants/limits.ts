/**
 * Application limits and sizes
 * Centralizes numeric constants for pagination, retries, timeouts, etc.
 */

// Pagination and batch sizes
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 10,
  LARGE_BATCH_SIZE: 1000,
  SMALL_BATCH_SIZE: 30,
} as const;

// Retry and concurrency limits
export const RETRY_LIMITS = {
  MAX_RETRIES: 3,
  MAX_CONCURRENT_OPERATIONS: 5,
  MAX_CONCURRENT_PROCESSORS: 10,
} as const;

// AWS retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 100,
  MAX_DELAY_MS: 5000,
  BACKOFF_MULTIPLIER: 2,
  JITTER_FACTOR: 0.3,
  // Extended retry for special cases
  EXTENDED_MAX_RETRIES: 5,
  EXTENDED_BASE_DELAY_MS: 1000,
  EXTENDED_MAX_DELAY_MS: 30000,
} as const;

// Memory and storage limits
export const STORAGE_LIMITS = {
  MAX_FILE_SIZE_MB: 1024, // 1GB
  CHUNK_SIZE_KB: 1024, // 1MB
  CACHE_ENTRY_LIMIT: 10000,
  MAX_LOG_ENTRIES: 50000,
} as const;

// Time limits in milliseconds
export const TIMEOUT_LIMITS = {
  FAST_OPERATION: 5000, // 5 seconds
  NORMAL_OPERATION: 30000, // 30 seconds
  SLOW_OPERATION: 120000, // 2 minutes
} as const;

// Activity and history limits
export const ACTIVITY_LIMITS = {
  MAX_ACTIVITY_DAYS: 90,
  MAX_HISTORY_ENTRIES: 500,
  ACTIVITY_BATCH_SIZE: 50,
} as const;

// Rate limiter configuration
export const RATE_LIMITS = {
  JITTER_MS: 10,
  QUICKSIGHT_BURST: 10,
  QUICKSIGHT_PER_SECOND: 10,
  QUICKSIGHT_PERMISSIONS_BURST: 2,
  QUICKSIGHT_PERMISSIONS_PER_SECOND: 2,
  CLOUDTRAIL_BURST: 2,
  CLOUDTRAIL_PER_SECOND: 2,
  S3_BURST: 50,
  S3_PER_SECOND: 30,
} as const;

// Worker configuration
export const WORKER_CONFIG = {
  HEARTBEAT_INTERVAL_MS: 5000,
  CLEANUP_DELAY_MS: 500,
  STUCK_JOB_TIMEOUT_MINUTES: 5,
} as const;

// Field metadata configuration
export const FIELD_LIMITS = {
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  FIELD_ID_PARTS: 3,
} as const;

// Job management configuration
export const JOB_LIMITS = {
  MAX_LOG_ENTRIES: 1000,
} as const;

// Logging configuration
export const LOGGING_CONFIG = {
  PROGRESS_LOG_INTERVAL: 5,
} as const;

// Job management configuration
export const JOB_CONFIG = {
  DEFAULT_RETENTION_DAYS: 30,
  STUCK_JOB_TIMEOUT_MINUTES: 30,
  MAX_JOBS_IN_INDEX: 200,
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  MEMORY_TTL_MS: 600000, // 10 minutes
  DEFAULT_LAMBDA_MEMORY_MB: 512,
  LARGE_LAMBDA_MEMORY_MB: 3008,
  MEDIUM_LAMBDA_MEMORY_MB: 1024,
  LARGE_LAMBDA_CACHE_SIZE: 100000,
  MEDIUM_LAMBDA_CACHE_SIZE: 50000,
  SMALL_LAMBDA_CACHE_SIZE: 10000,
} as const;

// Debug and logging configuration
export const DEBUG_CONFIG = {
  MAX_KEYS_TO_LOG: 5,
  SAMPLE_ENTRIES_TO_LOG: 3,
} as const;

// S3 service limits
export const S3_LIMITS = {
  MAX_KEYS_PER_REQUEST: 1000,
} as const;

// QuickSight API limits
export const QUICKSIGHT_LIMITS = {
  DEFAULT_MAX_RESULTS: 100,
  MAX_LIST_RESULTS: 1000,
} as const;

// Storage conversion constants
export const STORAGE_CONVERSION = {
  BYTES_PER_KB: 1024,
  BYTES_PER_MB: 1024 * 1024,
  BYTES_PER_GB: 1024 * 1024 * 1024,
} as const;

// Math constants
export const MATH_CONSTANTS = {
  PERCENTAGE_MULTIPLIER: 100,
} as const;
