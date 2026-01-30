// Asset entity types
import type {
  AssetType as GeneratedAssetType,
  AssetListItem,
  DashboardListItem,
  DatasetListItem,
  Tag
} from '@shared/generated';

// Extend asset type to include frontend-specific types
export type AssetType = GeneratedAssetType | 'folder' | 'user' | 'group';
export type { Tag };

// Extend the OpenAPI base type with additional frontend-specific fields
export interface BaseAsset extends Omit<AssetListItem, 'type'> {
  type: AssetType;
  arn?: string;
  lastPublishedTime?: string;
  folderId?: string;
  folderPath?: string;
  // Custom metadata stored in S3
  metadata?: AssetMetadata;
  
  // Archive tracking
  assetStatus?: 'active' | 'archived';
  archivedDate?: string;
  archivedBy?: string;
  archiveReason?: string;
  
  // View stats (dashboards and analyses only)
  viewStats?: {
    totalViews: number;
    uniqueViewers: number;
    lastViewedAt?: string;
    statsRefreshedAt: string;
  };
}

export interface AssetMetadata {
  description?: string;
  owner?: string;
  businessGlossary?: string;
  dataClassification?: string;
  notes?: string;
  customFields?: Record<string, any>;
}

export interface Dashboard extends Omit<DashboardListItem, 'type'>, BaseAsset {
  type: 'dashboard';
  version?: {
    versionNumber?: number;
    status?: string;
    createdTime?: string;
  };
  publishedVersionNumber?: number;
  sheets?: any[];
}

export interface Analysis extends Omit<DashboardListItem, 'type'>, BaseAsset {
  type: 'analysis';
  sheets?: any[];
  dataSetArns?: string[];
}

export interface Dataset extends Omit<DatasetListItem, 'type'>, BaseAsset {
  type: 'dataset';
  dataSourceArns?: string[];
  columns?: DatasetColumn[];
}

export interface Datasource extends BaseAsset {
  type: 'datasource';
  dataSourceType?: string;
  connectionMode?: string;
}

export interface DatasetColumn {
  name: string;
  type: string;
  description?: string;
}

// Dashboard-specific types
export interface DashboardMetadata {
  lastUpdated?: string;
  owner?: string;
  category?: string;
  description?: string;
  tags?: string[];
  businessUnit?: string;
  dataSource?: string;
  refreshSchedule?: string;
  [key: string]: any;
}

export interface Permission {
  principal: string;
  principalType: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
  actions: string[];
}

export interface DashboardPermission {
  principal: string;
  principalType: 'USER' | 'GROUP' | 'ROLE';
  permission: 'OWNER' | 'AUTHOR' | 'READER';
  grantedAt?: string;
}

export interface DashboardUsageMetrics {
  viewCountLast30Days: number;
  viewCountLast7Days: number;
  viewCountToday: number;
  lastViewed?: string;
  topViewers?: Array<{
    user: string;
    viewCount: number;
  }>;
}

export interface DashboardInfo {
  dashboardId: string;
  dashboardArn: string;
  name: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  publishedVersionNumber?: number;
  usage: DashboardUsageMetrics;
  permissions: DashboardPermission[];
  metadata: DashboardMetadata;
  tags?: Array<{ key: string; value: string }>;
}

// Related assets types
export interface RelatedAsset {
  id: string;
  name: string;
  type: string;
  relationshipType: string;
  isArchived?: boolean;
  // Activity data for dashboards and analyses
  activity?: {
    totalViews?: number;
    uniqueViewers?: number;
    lastViewed?: string | null;
  };
  // Tags for the asset
  tags?: Array<{ key: string; value: string }>;
}

export interface AssetWithRelations {
  id: string;
  name: string;
  type: string;
  relatedAssets?: RelatedAsset[];
}

// Helper type guards
export const isDashboard = (asset: BaseAsset): asset is Dashboard => asset.type === 'dashboard';
export const isAnalysis = (asset: BaseAsset): asset is Analysis => asset.type === 'analysis';
export const isDataset = (asset: BaseAsset): asset is Dataset => asset.type === 'dataset';
export const isDatasource = (asset: BaseAsset): asset is Datasource => asset.type === 'datasource';