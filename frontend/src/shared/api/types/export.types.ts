/**
 * Export operation types.
 *
 * Response shapes come from the generated OpenAPI types (@shared/generated) —
 * only request options and the expanded log-entry shape (which the logs
 * endpoint returns and the schema does not model) are declared here.
 */
import type { components } from '@shared/generated';

/**
 * Job status values - from the generated OpenAPI schema
 */
export type JobStatus = components['schemas']['JobStatus'];

/**
 * Log levels for export logs
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Options for refreshing specific asset data
 */
export interface RefreshOptions {
  definitions?: boolean;
  permissions?: boolean;
  tags?: boolean;
}

/**
 * Export job options
 */
export interface ExportJobOptions {
  forceRefresh?: boolean;
  rebuildIndex?: boolean;
  exportOrganizational?: boolean;
  assetTypes?: string[];
  refreshOptions?: RefreshOptions;
}

/**
 * Expanded export log entry as returned by the job-logs endpoint
 */
export interface ExportLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: unknown;
}
