import { type ActivityData } from '../../../shared/types/activityTypes';
import { type AssetType, type FolderInfo } from '../../../shared/types/assetTypes';
import { type LineageData } from '../../../shared/types/lineage.types';

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

export interface AssetListRequest {
  maxResults?: number;
  nextToken?: string;
  startIndex?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
  search?: string;
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
