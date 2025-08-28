/**
 * Two-Phase Export System Types
 * Phase 1: Fast inventory collection (skeleton assets)
 * Phase 2: Smart enrichment in batches with progress
 */

export interface ExportPhase1Options {
  assetTypes?: string[];
  forceRefresh?: boolean;
}

export interface ExportPhase1Response {
  success: true;
  phase: 'inventory';
  data: {
    totalAssets: number;
    assetsByType: Record<string, number>;
    skeletonAssets: Array<{
      id: string;
      type: string;
      name: string;
      arn: string;
      lastModified: string;
      status: 'skeleton' | 'enriched';
    }>;
    timing: {
      duration: number;
      apiCalls: number;
    };
  };
}

export interface ExportPhase2Options {
  assetTypes?: string[];
  batchSize?: number;
  enrichmentTypes?: ('definitions' | 'permissions' | 'tags')[];
  onlyStale?: boolean; // Only enrich assets that need updates
}

export interface BatchEnrichmentProgress {
  batchNumber: number;
  totalBatches: number;
  assetType: string;
  batchSize: number;
  processed: number;
  successful: number;
  failed: number;
  cached: number; // Assets that were already enriched
  timing: {
    batchDuration: number;
    averageAssetTime: number;
  };
  apiCalls: {
    total: number;
    describe: number;
    definition: number;
    permissions: number;
    tags: number;
  };
  errors?: Array<{
    assetId: string;
    assetName: string;
    error: string;
  }>;
}

export interface ExportPhase2Response {
  success: true;
  phase: 'enrichment';
  data: {
    assetType: string;
    batch: BatchEnrichmentProgress;
    overallProgress: {
      totalAssets: number;
      processedAssets: number;
      remainingAssets: number;
      percentComplete: number;
      estimatedTimeRemaining?: number;
    };
    nextBatch?: {
      available: boolean;
      assetType?: string;
      batchNumber?: number;
    };
  };
}

export interface EnrichmentStatus {
  assetId: string;
  assetType: string;
  assetName: string;
  status: 'skeleton' | 'enriched' | 'stale' | 'error';
  lastEnriched?: string;
  needsEnrichment: {
    definitions: boolean;
    permissions: boolean;
    tags: boolean;
  };
}

export interface ExportStatusResponse {
  success: true;
  data: {
    phase1Complete: boolean;
    phase2InProgress: boolean;
    totalAssets: number;
    enrichedAssets: number;
    skeletonAssets: number;
    staleAssets: number;
    assetsByType: Record<
      string,
      {
        total: number;
        enriched: number;
        skeleton: number;
        stale: number;
      }
    >;
    lastInventoryUpdate: string;
    estimatedEnrichmentTime?: number;
  };
}

export interface StartEnrichmentRequest {
  assetType: string;
  batchSize?: number;
  enrichmentTypes?: ('definitions' | 'permissions' | 'tags')[];
  onlyStale?: boolean;
}

export interface StartEnrichmentResponse {
  success: true;
  data: {
    batchId: string;
    assetType: string;
    totalBatches: number;
    assetsToProcess: number;
    estimatedDuration: number;
    nextBatchEndpoint: string;
  };
}
