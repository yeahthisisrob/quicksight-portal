/**
 * Time-related constants in milliseconds
 * Centralizes all time calculations used throughout the application
 */

// Basic time units in milliseconds
export const TIME_UNITS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH_30_DAYS: 30 * 24 * 60 * 60 * 1000,
  QUARTER_90_DAYS: 90 * 24 * 60 * 60 * 1000,
} as const;

// Common durations for data retention/filtering
export const RETENTION_PERIODS = {
  ONE_DAY: TIME_UNITS.DAY,
  ONE_WEEK: TIME_UNITS.WEEK,
  ONE_MONTH: TIME_UNITS.MONTH_30_DAYS,
  THREE_MONTHS: TIME_UNITS.QUARTER_90_DAYS,
} as const;

// Cache expiration times
export const CACHE_TTL = {
  SHORT: 5 * TIME_UNITS.MINUTE, // 5 minutes
  MEDIUM: 30 * TIME_UNITS.MINUTE, // 30 minutes
  LONG: 24 * TIME_UNITS.HOUR, // 24 hours
} as const;

// Retry intervals
export const RETRY_INTERVALS = {
  FAST: TIME_UNITS.SECOND, // 1 second
  MEDIUM: 5 * TIME_UNITS.SECOND, // 5 seconds
  SLOW: 30 * TIME_UNITS.SECOND, // 30 seconds
} as const;
