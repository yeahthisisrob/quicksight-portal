/**
 * Internal Domain Models for QuickSight Operations
 * These are our internal types - completely independent of AWS SDK
 * The adapter translates between these and AWS SDK types
 */

// ==================== Common Types ====================

export interface Tag {
  key: string;
  value: string;
}

export interface Permission {
  principal: string;
  actions: string[];
}

// Base interface for all asset summaries
interface BaseAssetSummary {
  arn: string;
  createdTime: Date;
  lastUpdatedTime: Date;
}

// ==================== List Operation Results ====================

export interface DashboardSummary extends BaseAssetSummary {
  dashboardId: string;
  name: string;
  publishedVersionNumber?: number;
  lastPublishedTime?: Date;
}

export interface DatasetSummary extends BaseAssetSummary {
  dataSetId: string;
  name: string;
  importMode?: 'SPICE' | 'DIRECT_QUERY';
  rowLevelPermissionDataSet?: any;
  rowLevelPermissionTagConfigurationApplied?: boolean;
  columnLevelPermissionRulesApplied?: boolean;
  consumedSpiceCapacityInBytes?: number;
}

export interface AnalysisSummary extends BaseAssetSummary {
  analysisId: string;
  name: string;
  status?: string;
}

export interface DatasourceSummary extends BaseAssetSummary {
  dataSourceId: string;
  name: string;
  type?: string;
  status?: string;
}

export interface FolderSummary extends BaseAssetSummary {
  folderId: string;
  name: string;
  folderType?: string;
  sharingModel?: string;
}

interface UserSummary extends BaseAssetSummary {
  userName: string;
  email?: string;
  role?: string;
  identityType?: string;
  active?: boolean;
  principalId?: string;
  customPermissionsName?: string;
}

interface GroupSummary extends BaseAssetSummary {
  groupName: string;
  description?: string;
  principalId?: string;
}

// Keep the original User and Group for backward compatibility
export type User = UserSummary;
export type Group = GroupSummary;

// Union type for all asset summaries
export type AssetSummary =
  | DashboardSummary
  | DatasetSummary
  | AnalysisSummary
  | DatasourceSummary
  | FolderSummary
  | UserSummary
  | GroupSummary;

// Type guards for each asset type
function isDashboardSummary(asset: AssetSummary): asset is DashboardSummary {
  return 'dashboardId' in asset;
}

export function isDatasetSummary(asset: AssetSummary): asset is DatasetSummary {
  return 'dataSetId' in asset;
}

function isAnalysisSummary(asset: AssetSummary): asset is AnalysisSummary {
  return 'analysisId' in asset;
}

function isDatasourceSummary(asset: AssetSummary): asset is DatasourceSummary {
  return 'dataSourceId' in asset;
}

function isFolderSummary(asset: AssetSummary): asset is FolderSummary {
  return 'folderId' in asset;
}

function isUserSummary(asset: AssetSummary): asset is UserSummary {
  return 'userName' in asset && 'email' in asset;
}

function isGroupSummary(asset: AssetSummary): asset is GroupSummary {
  return 'groupName' in asset && !('email' in asset);
}

// Helper functions to get ID and name from any asset summary
export function getAssetId(asset: AssetSummary): string {
  if (isDashboardSummary(asset)) {
    return asset.dashboardId;
  }
  if (isAnalysisSummary(asset)) {
    return asset.analysisId;
  }
  if (isDatasetSummary(asset)) {
    return asset.dataSetId;
  }
  if (isDatasourceSummary(asset)) {
    return asset.dataSourceId;
  }
  if (isFolderSummary(asset)) {
    return asset.folderId;
  }
  if (isUserSummary(asset)) {
    return asset.userName;
  }
  if (isGroupSummary(asset)) {
    return asset.groupName;
  }
  throw new Error('Unknown asset type');
}

export function getAssetName(asset: AssetSummary): string {
  if (isUserSummary(asset)) {
    return asset.userName;
  }
  if (isGroupSummary(asset)) {
    return asset.groupName;
  }
  // All other assets have a 'name' property
  return (asset as any).name || '';
}

// ==================== Paginated Results ====================

export interface PaginatedResult<T> {
  items: T[];
  nextToken?: string;
}

// ==================== Describe Results ====================

export interface DashboardDetails {
  dashboardId: string;
  arn: string;
  name: string;
  version?: {
    versionNumber?: number;
    status?: string;
    arn?: string;
    sourceEntityArn?: string;
    dataSetArns?: string[];
    description?: string;
    createdTime?: Date;
  };
  createdTime: Date;
  lastUpdatedTime: Date;
  lastPublishedTime?: Date;
}

export interface AnalysisDetails {
  analysisId: string;
  arn: string;
  name: string;
  status?: string;
  errors?: Array<{
    type: string;
    message: string;
  }>;
  dataSetArns?: string[];
  themeArn?: string;
  createdTime: Date;
  lastUpdatedTime: Date;
}

export interface DatasetDetails {
  dataSetId: string;
  arn: string;
  name: string;
  createdTime: Date;
  lastUpdatedTime: Date;
  physicalTableMap?: Record<string, any>;
  logicalTableMap?: Record<string, any>;
  outputColumns?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  importMode?: 'SPICE' | 'DIRECT_QUERY';
  consumedSpiceCapacityInBytes?: number;
  columnGroups?: any[];
  fieldFolders?: Record<string, any>;
  rowLevelPermissionDataSet?: any;
  rowLevelPermissionTagConfiguration?: any;
  columnLevelPermissionRules?: any[];
  dataSetUsageConfiguration?: any;
}

export interface DatasourceDetails {
  dataSourceId: string;
  arn: string;
  name: string;
  type: string;
  status?: string;
  createdTime: Date;
  lastUpdatedTime: Date;
  dataSourceParameters?: any;
  alternateDataSourceParameters?: any[];
  vpcConnectionProperties?: any;
  sslProperties?: any;
  errorInfo?: {
    type: string;
    message: string;
  };
  secretArn?: string;
}

export interface FolderDetails {
  folderId: string;
  arn: string;
  name: string;
  folderType?: string;
  folderPath?: string[];
  createdTime?: Date;
  lastUpdatedTime?: Date;
  sharingModel?: string;
}

export interface FolderMember {
  memberId: string;
  memberType: 'DASHBOARD' | 'ANALYSIS' | 'DATASET' | 'DATASOURCE';
}
