import { type AssetType } from '../../../shared/types/assetTypes';

export interface ExportRequest {
  assetType: AssetType;
  assetIds: string[];
  format?: 'json' | 'yaml';
  includePermissions?: boolean;
  includeTags?: boolean;
}

export interface ExportProgress {
  sessionId: string;
  totalAssets: number;
  processedAssets: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors?: string[];
}

export interface ExportSession {
  sessionId: string;
  userId: string;
  accountId: string;
  request: ExportRequest;
  progress: ExportProgress;
  createdAt: Date;
  updatedAt: Date;
}

// Re-export AssetType for convenience
export type { AssetType } from '../../../shared/types/assetTypes';

export interface AssetError {
  assetId: string;
  assetName?: string;
  error: string;
  errorType?: string;
  timestamp: string;
}

export interface BatchInfo {
  batchNumber: number;
  itemsInBatch: number;
  startTime: number;
  endTime: number;
  duration: number;
  successful: number;
  failed: number;
}

export interface AssetStats {
  total: number;
  updated: number;
  cached: number;
  errors: number;
  errorDetails?: AssetError[];
  // Enhanced metrics
  listed: number; // Total items found from QuickSight API
  skipped: number; // Items skipped due to cache (when not force refresh)
  toProcess: number; // Items that need processing
  batches: {
    total: number; // Total number of batches
    completed: number; // Batches completed
    batchSize: number; // Items per batch
    details?: BatchInfo[]; // Detailed info per batch
  };
  timing: {
    listingDuration: number; // Time to list all assets
    cacheCheckDuration: number; // Time to check cache
    processingDuration: number; // Time to process all items
    totalDuration: number; // Total time for this asset type
  };
  forceRefresh: boolean;
  apiCalls?: {
    total: number; // Total API calls made
    describe: number; // Describe* API calls
    permissions: number; // Permissions API calls
    tags: number; // Tags API calls
    other: number; // Other API calls
  };
}

export interface AssetExportResult {
  dashboard: AssetStats;
  dataset: AssetStats & { errorDetails?: AssetError[] };
  analysis: AssetStats & { errorDetails?: AssetError[] };
  datasource: AssetStats & { errorDetails?: AssetError[] };
  folder: AssetStats & { errorDetails?: AssetError[] };
  user?: AssetStats & { errorDetails?: AssetError[] };
  group?: AssetStats & { errorDetails?: AssetError[] };
  exportTime: string;
  duration: number;
}

export interface CachedAssetMetadata {
  lastExportTime: string;
  lastModifiedTime?: Date;
  assetType: AssetType;
  assetId: string;
  assetArn: string;
  name: string;
  definition?: any;
  permissions?: any;
  tags?: Record<string, string>;
  fileSize?: number;
}

export type { AssetSummary } from '../../../shared/models/quicksight-domain.model';

export interface RefreshOptions {
  definitions: boolean;
  permissions: boolean;
  tags: boolean;
}

export interface ProcessingContext {
  forceRefresh: boolean;
  refreshOptions?: RefreshOptions;
  sessionId?: string;
  batchSize?: number;
  delayMs?: number;
  bulkPermissions?: any[];
  bulkTags?: Record<string, string>;
}

/**
 * API call tracking for detailed monitoring
 */
export interface ApiCallTracker {
  describe: number;
  definition: number;
  permissions: number;
  tags: number;
  other: number;
  total: number;
}
