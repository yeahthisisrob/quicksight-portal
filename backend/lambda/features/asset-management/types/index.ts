import { type ActivityData } from '../../../shared/types/activityTypes';
import { type AssetType, type FolderInfo } from '../../../shared/types/assetTypes';
import { type TagFilter } from '../../../shared/types/filterTypes';
import { type LineageData } from '../../../shared/types/lineage.types';

// Re-export shared TagFilter for convenience
export type { TagFilter };

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  arn: string;
  createdTime?: Date;
  lastUpdatedTime?: Date;
  lastModified?: Date;
  tags?: any[];
  permissions?: any[];
  // Dashboard specific fields
  publishedVersionNumber?: number;
  sheetCount?: number;
  visualCount?: number;
  status?: string;
  viewStats?: any;
  relatedAssets?: any[];
  // Dataset specific fields
  importMode?: string;
  sourceType?: string;
  consumedSpiceCapacityInBytes?: number;
  // Analysis specific fields
  // Datasource specific fields
  connectionType?: string;
  // Common metadata
  metadata?: Record<string, any>;
}

export interface FolderFilter {
  id: string;
  name: string;
}

export interface AssetListRequest {
  maxResults?: number;
  nextToken?: string;
  startIndex?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
  search?: string;
  /** Which date field to filter on: lastUpdatedTime, createdTime, or lastActivity */
  dateField?: 'lastUpdatedTime' | 'createdTime' | 'lastActivity';
  /** Date range filter: all, 24h, 7d, 30d, 90d */
  dateRange?: 'all' | '24h' | '7d' | '30d' | '90d';
  /** Tags to include (OR logic) */
  includeTags?: TagFilter[];
  /** Tags to exclude (AND NOT logic) */
  excludeTags?: TagFilter[];
  /** Filter by error status: all, with_errors, without_errors */
  errorFilter?: 'all' | 'with_errors' | 'without_errors';
  /** Filter by activity status: all, with_activity, without_activity */
  activityFilter?: 'all' | 'with_activity' | 'without_activity';
  /** Folders to include (OR logic) - show assets in these folders */
  includeFolders?: FolderFilter[];
  /** Folders to exclude (AND NOT logic) - hide assets in these folders */
  excludeFolders?: FolderFilter[];
}

export interface AssetListResponse {
  items: Asset[];
  nextToken?: string;
  totalCount?: number;
}

export interface ArchivedAssetItem {
  id: string;
  name: string;
  type: AssetType;
  status: 'archived';
  createdTime: string;
  lastUpdatedTime: string;
  lastExportTime: string;
  enrichmentStatus: string;
  enrichmentTimestamps: Record<string, any>;
  tags: any[];
  permissions: any[];
  archivedDate: string;
  archiveReason: string;
  archivedBy: string;
  lastActivity?: string | null;
  canRestore: boolean;
}

export interface ArchivedAssetsResponse {
  items: ArchivedAssetItem[];
  nextToken?: string;
  totalCount?: number;
}

export interface AssetSummary {
  dashboardId?: string;
  dataSetId?: string;
  analysisId?: string;
  dataSourceId?: string;
  name: string;
  arn: string;
  createdTime?: Date;
  lastUpdatedTime?: Date;
}

/**
 * Internal type for mapped assets with all computed properties
 * Used by AssetService to enrich basic Asset with additional data
 */
export interface MappedAsset extends Asset {
  assetType?: AssetType;
  assetsCount?: number;
  folderCount?: number;
  folders?: FolderInfo[];
  activity?: ActivityData;
  viewStats?: ActivityData;
  lineage?: LineageData;
  memberCount?: number;
  groups?: any[];
  definitionErrors?: any[];
  Members?: any[];
  path?: string;
  fullPath?: string;
  sizeInBytes?: number;
}
