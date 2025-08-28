/**
 * Export API Types
 * Strongly typed interfaces for export operations
 */

/**
 * Job status values
 */
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';

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
  exportIngestions?: boolean;
  exportOrganizational?: boolean;
  assetTypes?: string[];
  refreshOptions?: RefreshOptions;
}

/**
 * Export job result
 */
export interface ExportJobResult {
  jobId: string;
  status: JobStatus;
  message: string;
}

/**
 * Export job statistics
 */
export interface ExportJobStats {
  totalAssets?: number;
  processedAssets?: number;
  failedAssets?: number;
  apiCalls?: number;
}

/**
 * Export job status response
 */
export interface ExportJobStatus {
  jobId: string;
  jobType: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  stats?: ExportJobStats;
  error?: string;
  stopRequested?: boolean;
}

/**
 * Export log entry
 */
export interface ExportLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: unknown;
}

/**
 * Export logs response
 */
export interface ExportLogsResponse {
  jobId: string;
  logs: ExportLogEntry[];
}

/**
 * Asset list pagination
 */
export interface AssetPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Asset list options
 */
export interface AssetListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  useCache?: boolean;
  dateRange?: string;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * Asset list response
 */
export interface AssetListResponse<T = unknown> {
  items: T[];
  pagination: AssetPagination;
  fromCache: boolean;
}

/**
 * Export summary
 */
export interface ExportSummaryResponse {
  totalAssets: number;
  exportedAssets: number;
  lastExportDate: string | null;
  exportInProgress: boolean;
  needsInitialExport?: boolean;
  message?: string;
  assetTypeCounts: {
    dashboards: number;
    datasets: number;
    analyses: number;
    datasources: number;
    folders: number;
    users?: number;
    groups?: number;
  };
  fieldStatistics: {
    totalFields: number;
    totalCalculatedFields: number;
    totalUniqueFields: number;
  } | null;
  totalSize?: number;
  indexVersion?: string;
}

/**
 * Stop job response
 */
export interface StopJobResponse {
  success: boolean;
  message: string;
}

/**
 * Clear cache response
 */
export interface ClearCacheResponse {
  message: string;
}