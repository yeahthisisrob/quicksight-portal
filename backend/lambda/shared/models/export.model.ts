/**
 * Export-specific models
 * These types are used for tracking export state, progress, and logs
 */

import type { AssetType } from './asset.model';

export interface ExportLogEntry {
  ts: number; // timestamp in milliseconds
  msg: string; // log message
  level?: 'info' | 'warn' | 'error'; // log level
  assetType?: string; // optional asset type context
  assetId?: string; // optional asset ID context
  apiCalls?: number; // running count of API calls made
}

export interface ExportProgress {
  totalAssets: number;
  enrichedAssets: number;
  skeletonAssets: number;
  failedAssets: number;
  startedAt: number;
  completedAt?: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentStage?: string; // e.g., "Listing dashboards", "Enriching datasets"
  error?: string; // error message if status is 'error'
}

export interface ExportState {
  version: string;
  progress: ExportProgress;
  logs: ExportLogEntry[]; // rolling window of log entries
  lastUpdated: number;
  // lastHeartbeat removed - not needed with worker lambda architecture

  // Asset-specific progress (optional, for detailed tracking)
  assetProgress?: Record<
    string,
    {
      listed: number;
      enriched: number;
      failed: number;
    }
  >;

  // Stop signal for cooperative termination
  // TODO: With Step Functions, this would be replaced by StopExecution API
  stopRequested?: boolean;
  stopRequestedAt?: number;
  stopRequestedBy?: string;
}

/**
 * Export execution options with detailed refresh control
 */
export interface ExportOptions {
  forceRefresh?: boolean;
  rebuildIndex?: boolean; // Rebuild index from existing S3 files
  exportIngestions?: boolean; // Export dataset ingestion status
  refreshOptions?: {
    definitions?: boolean;
    permissions?: boolean;
    tags?: boolean;
  };
  assetTypes?: AssetType[]; // Asset types to export
  batchSize?: number;
  maxConcurrency?: number;
}

export interface ExportResult {
  success: boolean;
  duration: number;
  totalAssets: number;
  enrichedAssets: number;
  failedAssets: number;
  errors?: Array<{
    assetType: string;
    assetId: string;
    error: string;
  }>;
}

/**
 * Progress callback for real-time export updates
 */
export interface ExportProgressCallback {
  onAssetTypeStart?: (assetType: AssetType, totalAssets: number) => void;
  onAssetStart?: (assetType: AssetType, assetId: string, assetName: string) => void;
  onAssetComplete?: (assetType: AssetType, result: any) => void;
  onBatchComplete?: (
    assetType: AssetType,
    batchNumber: number,
    totalBatches: number,
    results: any[]
  ) => void;
  onAssetTypeComplete?: (assetType: AssetType, summary: AssetTypeSummary) => void;
  onError?: (error: Error, assetType?: AssetType, assetId?: string) => void;
}

/**
 * Summary for a single asset type export
 */
export interface AssetTypeSummary {
  assetType: AssetType;
  totalListed: number;
  totalProcessed: number;
  successful: number;
  cached: number;
  failed: number;
  timing: {
    listingMs: number;
    comparisonMs: number;
    processingMs: number;
    totalMs: number;
  };
  apiCalls: {
    total: number;
  };
  errors: Array<{
    assetId: string;
    assetName: string;
    error: string;
    timestamp: string;
  }>;
}

/**
 * Complete export summary with all asset types
 */
export interface ExportSummary {
  startTime: string;
  endTime: string;
  duration: number;
  assetTypes: AssetTypeSummary[];
  totals: {
    listed: number;
    processed: number;
    successful: number;
    cached: number;
    failed: number;
    apiCalls: number;
  };
  options: ExportOptions;
}
