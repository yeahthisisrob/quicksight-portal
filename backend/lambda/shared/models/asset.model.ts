/**
 * Lightweight cache model for fast frontend queries
 * Cache = fast lookups, Export files = complete data
 */

export type AssetType =
  | 'dashboard'
  | 'analysis'
  | 'dataset'
  | 'datasource'
  | 'folder'
  | 'user'
  | 'group';

/**
 * Asset status enum for consistent status management
 */
export enum AssetStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export type EnrichmentStatus = 'skeleton' | 'enriched' | 'partial' | 'metadata-update';

/**
 * Lightweight cache entry for fast queries
 * Contains only what's needed for filtering, search, and basic display
 */
export interface CacheEntry {
  // Identity
  assetId: string;
  assetType: AssetType;
  assetName: string;
  arn: string;

  // Status tracking
  status: `${AssetStatus}`;
  enrichmentStatus: EnrichmentStatus;

  // QuickSight timestamps (the real ones)
  createdTime: Date;
  lastUpdatedTime: Date;

  // Portal metadata
  exportedAt: Date;
  enrichedAt?: Date;

  // Enrichment tracking - when each enrichment step was completed
  enrichmentTimestamps?: {
    definition?: Date;
    permissions?: Date;
    tags?: Date;
    lineage?: Date;
    views?: Date;
  };

  // File references - where to find the full data
  exportFilePath: string; // e.g., "assets/dashboards/abc123.json"
  storageType: 'individual' | 'collection';

  // Fast query fields (computed during export)
  tags: Array<{ key: string; value: string }>;
  permissions: Array<{
    principal: string;
    principalType: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
    actions: string[];
  }>;

  // Type-specific quick access fields
  metadata: {
    // Folder specific
    fullPath?: string;
    parentId?: string;
    memberCount?: number;
    folderPath?: string[]; // Array of parent folder ARNs

    // Dashboard/Analysis specific
    visualCount?: number;
    sheetCount?: number;
    datasetCount?: number;
    status?: string; // CREATION_SUCCESSFUL, etc.
    themeArn?: string; // Custom theme ARN for dashboards and analyses
    dashboardPublishOptions?: any; // Dashboard publish options (ad-hoc filtering, export to CSV, etc.)
    definitionErrors?: Array<{
      type: string;
      message: string;
      violatedEntities?: Array<{
        path: string;
      }>;
    }>;
    sheets?: Array<{
      sheetId: string;
      name?: string;
      visualCount: number;
      visuals?: Array<{
        visualId: string;
        type: string;
        title?: string;
        hasTitle?: boolean;
      }>;
    }>;

    // View stats
    viewStats?: {
      totalViews: number;
      uniqueViewers: number;
      lastViewedAt?: string;
      statsRefreshedAt?: string;
    };

    // Dataset specific
    fieldCount?: number;
    importMode?: 'SPICE' | 'DIRECT_QUERY';
    consumedSpiceCapacityInBytes?: number;
    sizeInBytes?: number;
    datasourceArns?: string[];
    hasRefreshProperties?: boolean;
    refreshScheduleCount?: number;
    refreshSchedules?: Array<{
      scheduleId: string;
      scheduleFrequency: {
        interval: 'MINUTE15' | 'MINUTE30' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
        refreshOnDay?: {
          dayOfWeek?:
            | 'SUNDAY'
            | 'MONDAY'
            | 'TUESDAY'
            | 'WEDNESDAY'
            | 'THURSDAY'
            | 'FRIDAY'
            | 'SATURDAY';
          dayOfMonth?: string;
        };
        timeOfTheDay?: string;
        timezone?: string;
      };
      startAfterDateTime?: string;
      refreshType: 'INCREMENTAL_REFRESH' | 'FULL_REFRESH';
      arn: string;
    }>;
    dataSetRefreshProperties?: any;

    // Fields - for datasets, analyses, and dashboards
    // All three asset types can have both regular and calculated fields
    fields?: Array<{
      fieldId: string;
      fieldName: string;
      displayName?: string;
      dataType: string;
      description?: string;
      columnName?: string;
      // For analyses/dashboards: which dataset this field comes from
      sourceDatasetId?: string;
      sourceDatasetName?: string;
    }>;
    calculatedFields?: Array<{
      fieldId: string;
      fieldName: string;
      displayName?: string;
      dataType: string;
      expression: string;
      dependencies?: string[];
      // For analyses/dashboards: which dataset this field comes from
      sourceDatasetId?: string;
      sourceDatasetName?: string;
    }>;

    // Source type (for both datasets and datasources)
    sourceType?: string; // FILE, S3, ATHENA, REDSHIFT, etc.

    // Datasource specific
    connectionMode?: string;
    datasourceType?: string;
    bucket?: string; // S3 bucket name for demo asset identification

    // User specific
    email?: string;
    role?: string;
    active?: boolean;
    groupCount?: number;
    groups?: string[];
    principalId?: string;
    activity?: any;

    // Group specific
    members?:
      | Array<{
          memberName: string;
          memberArn: string;
          email?: string;
        }>
      | Array<{
          memberId: string;
          memberType: string;
          memberArn: string;
        }>;

    // Lineage data (to avoid reading S3 files during lineage rebuild)
    lineageData?: {
      // For dashboards: source analysis ARN
      sourceAnalysisArn?: string;
      // For dashboards/analyses: dataset IDs (from definition)
      datasetIds?: string[];
      // For datasets: datasource IDs from PhysicalTableMap
      datasourceIds?: string[];
      // Enriched with names for searchability (populated during cache rebuild)
      datasets?: Array<{ id: string; name: string }>;
      datasources?: Array<{ id: string; name: string }>;
    };

    // Common
    description?: string;
    owner?: string;
    enrichmentStatus?: string;
    lastEnrichmentTime?: string;
    exportTime?: string;
    exportVersion?: string;
    publishedVersionNumber?: number;
    folderType?: string;
  };
}

/**
 * Master cache - lightweight index of all assets
 */
export interface MasterCache {
  version: string;
  lastUpdated: Date;

  // Quick counts
  assetCounts: Record<AssetType, number>;

  // Lightweight entries for fast queries
  entries: Record<AssetType, CacheEntry[]>;
}

/**
 * API response models - what frontend receives
 * Note: We re-export the OpenAPI generated types to ensure consistency
 */
export interface AssetListItem {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;

  // QuickSight timestamps (strings for API compatibility)
  createdTime: string;
  lastModifiedTime: string;

  // Portal info
  lastExported: string;
  enrichmentStatus: EnrichmentStatus;

  // Quick access
  tags: Array<{ key: string; value: string }>;

  // Type-specific fields from metadata
  [key: string]: any;
}

export interface FolderListItem extends AssetListItem {
  path: string;
  memberCount: number;
  parentId?: string;
}

export interface DashboardListItem extends AssetListItem {
  dashboardStatus: string; // QuickSight specific status like CREATION_SUCCESSFUL
  visualCount: number;
  sheetCount: number;
  datasetCount: number;
  definitionErrors?: Array<{
    type: string;
    message: string;
    violatedEntities?: Array<{
      path: string;
    }>;
  }>;
}

export interface DatasetListItem extends AssetListItem {
  importMode: 'SPICE' | 'DIRECT_QUERY';
  fieldCount: number;
  sourceType?: string; // FILE, S3, ATHENA, database types, etc.
}

export interface UserListItem extends AssetListItem {
  email: string;
  role: string;
  active: boolean;
  groupCount: number;
}
