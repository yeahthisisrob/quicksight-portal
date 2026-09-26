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

// Date range filter durations (used for asset filtering)
export const DATE_RANGE_DURATIONS = {
  '24h': TIME_UNITS.DAY,
  '7d': TIME_UNITS.WEEK,
  '30d': TIME_UNITS.MONTH_30_DAYS,
  '90d': TIME_UNITS.QUARTER_90_DAYS,
} as const;

// Cache expiration times
export const CACHE_TTL = {
  SHORT: 5 * TIME_UNITS.MINUTE, // 5 minutes
  MEDIUM: 30 * TIME_UNITS.MINUTE, // 30 minutes
  LONG: 24 * TIME_UNITS.HOUR, // 24 hours
} as const;
