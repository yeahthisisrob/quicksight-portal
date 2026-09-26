/**
 * Asset Export Structure Models
 * Defines the structure of exported assets in S3
 */

/**
 * QuickSight API response wrapper
 */
export interface ApiResponse<T> {
  timestamp: string;
  data: T;
  error?: string;
}

/**
 * Tag structure from QuickSight
 */
interface QuickSightTag {
  Key: string;
  Value: string;
}

/**
 * Raw permission structure from AWS API
 */
interface QuickSightRawPermission {
  Principal?: string;
  Actions?: string[];
}

/**
 * Permissions response structure with LinkSharingConfiguration
 */
interface QuickSightPermissionsResponse {
  Permissions?: QuickSightRawPermission[];
  LinkSharingConfiguration?: {
    Permissions?: QuickSightRawPermission[];
  };
}

/**
 * Common list response fields
 */
interface ListResponseData {
  Arn: string;
  CreatedTime: string;
  LastUpdatedTime: string;
}

/**
 * Dashboard-specific types
 */
interface DashboardListData extends ListResponseData {
  DashboardId: string;
  Name: string;
  Version?: {
    VersionNumber?: number;
    Status?: string;
  };
}

// Note: The adapter unwraps the response, so this is the Dashboard object directly
interface DashboardDescribeData {
  DashboardId: string;
  Arn: string;
  Name: string;
  Version?: {
    VersionNumber?: number;
    Status?: string;
    SourceEntityArn?: string; // Link to analysis
    DataSetArns?: string[];
    CreatedTime?: string;
  };
  CreatedTime: string;
  LastUpdatedTime: string;
  LastPublishedTime?: string;
}

interface DashboardDefinitionData {
  Definition?: {
    DataSetIdentifierDeclarations?: Array<{
      Identifier: string;
      DataSetArn: string;
    }>;
    Sheets?: any[];
    CalculatedFields?: any[];
    ParameterDeclarations?: any[];
    FilterGroups?: any[];
    AnalysisDefaults?: any;
    Options?: any;
  };
  Errors?: Array<{
    Type: string;
    Message: string;
    ViolatedEntities?: Array<{
      Path: string;
    }>;
  }>;
  ResourceStatus?: string;
}

/**
 * Analysis-specific types
 */
interface AnalysisListData extends ListResponseData {
  AnalysisId: string;
  Name: string;
  Status?: string;
}

// Note: The adapter unwraps the response, so this is the Analysis object directly
interface AnalysisDescribeData {
  AnalysisId: string;
  Arn: string;
  Name: string;
  Status?: string;
  DataSetArns?: string[];
  CreatedTime: string;
  LastUpdatedTime: string;
}

interface AnalysisDefinitionData {
  Definition?: {
    DataSetIdentifierDeclarations?: Array<{
      Identifier: string;
      DataSetArn: string;
    }>;
    Sheets?: any[];
    CalculatedFields?: any[];
    ParameterDeclarations?: any[];
    FilterGroups?: any[];
    AnalysisDefaults?: any;
    Options?: any;
  };
  Errors?: Array<{
    Type: string;
    Message: string;
    ViolatedEntities?: Array<{
      Path: string;
    }>;
  }>;
  ResourceStatus?: string;
}

/**
 * Folder-specific types
 */
interface FolderListData extends ListResponseData {
  FolderId: string;
  Name: string;
  FolderPath?: string[];
  FolderType?: string;
  ParentFolderArn?: string;
}

export interface FolderMemberData {
  MemberId: string;
  MemberType: 'DASHBOARD' | 'ANALYSIS' | 'DATASET' | 'DATASOURCE';
  MemberName?: string;
}

interface UserGroupData {
  GroupName: string;
  GroupDescription?: string;
  PrincipalId?: string;
}

/**
 * Group-specific types
 */
export interface GroupListData extends ListResponseData {
  GroupName: string;
  Description?: string;
  PrincipalId?: string;
}

export interface GroupDescribeData {
  Group?: {
    GroupName: string;
    Description?: string;
    PrincipalId?: string;
    Arn: string;
  };
}

interface GroupMemberData {
  MemberName: string;
}

/**
 * Dataset refresh schedule types
 */
export interface DataSetRefreshProperties {
  RefreshConfiguration?: {
    IncrementalRefresh?: {
      LookbackWindow?: {
        ColumnName: string;
        Size: number;
        SizeUnit: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';
      };
    };
  };
}

export interface RefreshSchedule {
  ScheduleId: string;
  ScheduleFrequency: {
    Interval: 'MINUTE15' | 'MINUTE30' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    RefreshOnDay?: {
      DayOfWeek?:
        | 'SUNDAY'
        | 'MONDAY'
        | 'TUESDAY'
        | 'WEDNESDAY'
        | 'THURSDAY'
        | 'FRIDAY'
        | 'SATURDAY';
      DayOfMonth?: string;
    };
    TimeOfTheDay?: string;
    Timezone?: string;
  };
  StartAfterDateTime?: string;
  RefreshType: 'INCREMENTAL_REFRESH' | 'FULL_REFRESH';
  Arn: string;
}

/**
 * Main export structure for assets
 */
export interface AssetExportData {
  apiResponses: {
    list?: ApiResponse<any>;
    describe?: ApiResponse<any>;
    definition?: ApiResponse<any>;
    permissions?: ApiResponse<QuickSightRawPermission[] | QuickSightPermissionsResponse>;
    tags?: ApiResponse<QuickSightTag[]>;
    views?: ApiResponse<any>;
    activity?: ApiResponse<any>;
    // Special operations - used by folders, users, and groups
    members?: ApiResponse<FolderMemberData[] | GroupMemberData[]>;
    groups?: ApiResponse<UserGroupData[]>;
    // Dataset-specific special operations
    dataSetRefreshProperties?: ApiResponse<DataSetRefreshProperties>;
    refreshSchedules?: ApiResponse<RefreshSchedule[]>;
  };
}

/**
 * Type guards
 */
export function isDashboardExport(data: AssetExportData): data is AssetExportData & {
  apiResponses: {
    list?: ApiResponse<DashboardListData>;
    describe?: ApiResponse<DashboardDescribeData>;
    definition?: ApiResponse<DashboardDefinitionData>;
  };
} {
  return !!data.apiResponses.list?.data && 'DashboardId' in data.apiResponses.list.data;
}

export function isAnalysisExport(data: AssetExportData): data is AssetExportData & {
  apiResponses: {
    list?: ApiResponse<AnalysisListData>;
    describe?: ApiResponse<AnalysisDescribeData>;
    definition?: ApiResponse<AnalysisDefinitionData>;
  };
} {
  return !!data.apiResponses.list?.data && 'AnalysisId' in data.apiResponses.list.data;
}

export function isFolderExport(data: AssetExportData): data is AssetExportData & {
  apiResponses: {
    list?: ApiResponse<FolderListData>;
    members?: ApiResponse<FolderMemberData[]>;
  };
} {
  return !!data.apiResponses.list?.data && 'FolderId' in data.apiResponses.list.data;
}
