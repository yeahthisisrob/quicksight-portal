export type AssetType = 'dashboards' | 'datasets' | 'analyses' | 'datasources' | 'folders' | 'users' | 'groups' | 'themes';

export type ExportMode = 'smart' | 'force' | 'permissions' | 'tags' | 'rebuild';

// Two-phase export system types
export interface TwoPhaseExportState {
  phase: 'idle' | 'inventory' | 'enrichment' | 'completed' | 'error';
  currentStep: number;
  totalAssets: number;
  processedAssets: number;
  assetTypes: Record<string, AssetTypeProgressState>;
  timing: {
    startTime?: number;
    endTime?: number;
    inventoryDuration?: number;
    totalDuration?: number;
  };
  apiCalls: {
    total: number;
    byType: Record<string, number>;
  };
  exportMode: ExportMode;
}

export interface AssetTypeProgressState {
  total: number;
  listed: number;
  needsEnrichment: number;
  enriched?: number;
  failed?: number;
  currentBatch?: number;
  totalBatches?: number;
  phase: 'idle' | 'listing' | 'enriching' | 'completed' | 'error';
  error?: string;
}

export interface InventoryPhaseResult {
  success: true;
  phase: 'inventory';
  data: {
    totalAssets: number;
    assetsByType: Record<string, {
      total: number;
      listed: number;
      needsEnrichment: number;
      error?: string;
    }>;
    enrichment: {
      assetsNeedingEnrichment: number;
      estimatedBatches: number;
      batchSize: number;
      estimatedDurationSeconds: number;
      enrichmentTypes: string[];
    };
    timing: {
      duration: number;
      apiCalls: number;
    };
  };
}

export interface EnrichmentBatchResult {
  success: true;
  phase: 'enrichment';
  data: {
    assetType: string;
    enrichmentType: string;
    batch: {
      number: number;
      size: number;
      processed: number;
      successful: number;
      failed: number;
      cached: number;
      timing: {
        duration: number;
        averageAssetTime: number;
      };
      apiCalls: {
        total: number;
        describe: number;
        definition: number;
        permissions: number;
        tags: number;
      };
      errors: Array<{
        assetId: string;
        assetName: string;
        error: string;
      }>;
    };
    progress: {
      totalAssets: number;
      processedAssets: number;
      remainingAssets: number;
      percentComplete: number;
      estimatedTimeRemaining: number;
    };
    nextBatch: {
      available: boolean;
      batchNumber: number;
    };
  };
}

export interface ExportStatusResult {
  success: true;
  data: {
    inventoryComplete: boolean;
    enrichmentInProgress: boolean;
    totalAssets: number;
    enrichedAssets: number;
    skeletonAssets: number;
    percentEnriched: number;
    assetsByType: Record<string, any>;
    lastUpdated: string;
    nextSteps: {
      phase: string;
      action: string;
      description: string;
    };
  };
}

export interface ExportSession {
  id: string;
  status: 'initializing' | 'listing' | 'processing' | 'completed' | 'failed' | 'running';
  assetTypes: AssetType[];
  currentAssetType?: AssetType;
  startTime: number;
  error?: string;
}

export interface AssetTypeProgress {
  status: 'pending' | 'listing' | 'comparing' | 'processing' | 'completed' | 'failed';
  stage: 'pending' | 'listing' | 'comparing' | 'processing' | 'completed' | 'failed';
  listing?: {
    totalFound: number;
    currentPage: number;
    pages: number;
    assets: any[];
  };
  comparing?: {
    totalAssets: number;
    cachedAssets: number;
    newAssets: number;
  };
  processing?: {
    processed: number;
    successful: number;
    failed: number;
    errors: any[];
    batchProgress?: string;
  };
  totalTime?: number;
  metadata?: {
    physical?: number;
    semantic?: number;
    calculated?: number;
    visualFields?: number;
    mappings?: number;
  };
}

export interface ExportSummary {
  account: string;
  region: string;
  lastExportTime: string;
  lastIndexTime: string;
  assetTypes: {
    type: string;
    indexed: number;
    cached: number;
    lastSync: string;
  }[];
  metadata?: {
    physicalFields: number;
    semanticTerms: number;
    calculatedFields: number;
    visualFields: number;
    fieldMappings: number;
  };
}

export interface CatalogStats {
  physicalFields: number;
  semanticTerms: number;
  calculatedFields: number;
  mappedFields: number;
  unmappedFields: number;
}

export interface VisualFieldStats {
  totalVisualFields: number;
  distinctDatasetFields: number;
  unmappedVisualFields: number;
  percentageMapped: number;
}

export const assetTypeConfigs = {
  dashboards: {
    icon: 'Dashboard',
    color: '#10B981',
    bgColor: '#D1FAE5',
    label: 'Dashboards',
    description: 'Visualizations and reports',
  },
  datasets: {
    icon: 'Dataset',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    label: 'Datasets',
    description: 'Data models and sources',
  },
  analyses: {
    icon: 'Analytics',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    label: 'Analyses',
    description: 'Analysis workspaces',
  },
  datasources: {
    icon: 'Source',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    label: 'Data Sources',
    description: 'Database connections',
  },
  folders: {
    icon: 'Folder',
    color: '#6366F1',
    bgColor: '#E0E7FF',
    label: 'Folders',
    description: 'Asset organization',
  },
  users: {
    icon: 'Person',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    label: 'Users',
    description: 'User accounts',
  },
  groups: {
    icon: 'Group',
    color: '#14B8A6',
    bgColor: '#CCFBF1',
    label: 'Groups',
    description: 'User groups',
  },
} as const;