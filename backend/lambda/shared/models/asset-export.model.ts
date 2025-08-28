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
export interface QuickSightTag {
  Key: string;
  Value: string;
}

/**
 * Raw permission structure from AWS API
 */
export interface QuickSightRawPermission {
  Principal?: string;
  Actions?: string[];
}

/**
 * Permissions response structure with LinkSharingConfiguration
 */
export interface QuickSightPermissionsResponse {
  Permissions?: QuickSightRawPermission[];
  LinkSharingConfiguration?: {
    Permissions?: QuickSightRawPermission[];
  };
}

/**
 * Transformed permission structure for cache
 */
export interface QuickSightPermission {
  principal: string;
  principalType: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
  actions: string[];
}

/**
 * Common list response fields
 */
export interface ListResponseData {
  Arn: string;
  CreatedTime: string;
  LastUpdatedTime: string;
}

/**
 * Dashboard-specific types
 */
export interface DashboardListData extends ListResponseData {
  DashboardId: string;
  Name: string;
  Version?: {
    VersionNumber?: number;
    Status?: string;
  };
}

// Note: The adapter unwraps the response, so this is the Dashboard object directly
export interface DashboardDescribeData {
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

export interface DashboardDefinitionData {
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
export interface AnalysisListData extends ListResponseData {
  AnalysisId: string;
  Name: string;
  Status?: string;
}

// Note: The adapter unwraps the response, so this is the Analysis object directly
export interface AnalysisDescribeData {
  AnalysisId: string;
  Arn: string;
  Name: string;
  Status?: string;
  DataSetArns?: string[];
  CreatedTime: string;
  LastUpdatedTime: string;
}

export interface AnalysisDefinitionData {
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
 * Dataset-specific types
 */
export interface DatasetListData extends ListResponseData {
  DataSetId: string;
  Name: string;
  ImportMode?: 'SPICE' | 'DIRECT_QUERY';
  ConsumedSpiceCapacityInBytes?: number;
  RowLevelPermissionDataSet?: any;
  RowLevelPermissionTagConfigurationApplied?: boolean;
  ColumnLevelPermissionRulesApplied?: boolean;
}

export interface OutputColumn {
  Name: string;
  Type?: string;
  Description?: string;
  SubType?: string;
}

export interface CreateColumnsOperation {
  Columns: Array<{
    ColumnId?: string;
    ColumnName: string;
    Expression: string;
  }>;
}

export interface DataTransform {
  CreateColumnsOperation?: CreateColumnsOperation;
  TagColumnOperation?: {
    ColumnName: string;
    Tags: Array<{
      ColumnDescription?: {
        Text: string;
      };
      ColumnGeographicRole?: string;
    }>;
  };
  RenameColumnOperation?: any;
  CastColumnTypeOperation?: any;
  ProjectOperation?: any;
  FilterOperation?: any;
}

export interface LogicalTable {
  Alias?: string;
  DataTransforms?: DataTransform[];
  Source?: {
    JoinInstruction?: any;
    PhysicalTableId?: string;
    DataSetArn?: string;
  };
}

export interface PhysicalTable {
  RelationalTable?: {
    DataSourceArn: string;
    Catalog?: string;
    Schema?: string;
    Name: string;
    InputColumns?: any[];
  };
  CustomSql?: {
    DataSourceArn: string;
    Name: string;
    SqlQuery: string;
    Columns?: any[];
  };
  S3Source?: {
    DataSourceArn: string;
    UploadSettings?: any;
    InputColumns?: any[];
  };
}

// Note: The adapter unwraps the response, so this is the DataSet object directly
export interface DatasetDescribeData {
  DataSetId: string;
  Arn: string;
  Name: string;
  CreatedTime: string;
  LastUpdatedTime: string;
  ImportMode?: 'SPICE' | 'DIRECT_QUERY';
  ConsumedSpiceCapacityInBytes?: number;
  OutputColumns?: OutputColumn[];
  LogicalTableMap?: Record<string, LogicalTable>;
  PhysicalTableMap?: Record<string, PhysicalTable>;
  DataSetUsageConfiguration?: any;
  FieldFolders?: Record<
    string,
    {
      columns: string[];
      description?: string;
    }
  >;
}

/**
 * Datasource-specific types
 */
export interface DatasourceListData extends ListResponseData {
  DataSourceId: string;
  Name: string;
  Type?: string;
  Status?: string;
  SslProperties?: any;
}

// Note: The adapter unwraps the response, so this is the DataSource object directly
export interface DatasourceDescribeData {
  DataSourceId: string;
  Arn: string;
  Name: string;
  Type: string;
  Status?: string;
  CreatedTime: string;
  LastUpdatedTime: string;
  DataSourceParameters?: any;
  VpcConnectionProperties?: any;
  SslProperties?: any;
  ErrorInfo?: any;
}

/**
 * Folder-specific types
 */
export interface FolderListData extends ListResponseData {
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

/**
 * User-specific types
 */
export interface UserListData extends ListResponseData {
  UserName: string;
  Email?: string;
  Role?: string;
  IdentityType?: string;
  Active?: boolean;
  PrincipalId?: string;
}

export interface UserDescribeData {
  User?: {
    UserName: string;
    Email?: string;
    Role?: string;
    IdentityType?: string;
    Active?: boolean;
    PrincipalId?: string;
    Arn: string;
  };
}

export interface UserGroupData {
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

export interface GroupMemberData {
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

export function isDatasetExport(data: AssetExportData): data is AssetExportData & {
  apiResponses: {
    list?: ApiResponse<DatasetListData>;
    describe?: ApiResponse<DatasetDescribeData>;
  };
} {
  return !!data.apiResponses.list?.data && 'DataSetId' in data.apiResponses.list.data;
}

export function isDatasourceExport(data: AssetExportData): data is AssetExportData & {
  apiResponses: {
    list?: ApiResponse<DatasourceListData>;
    describe?: ApiResponse<DatasourceDescribeData>;
  };
} {
  return !!data.apiResponses.list?.data && 'DataSourceId' in data.apiResponses.list.data;
}

export function isFolderExport(data: AssetExportData): data is AssetExportData & {
  apiResponses: {
    list?: ApiResponse<FolderListData>;
    members?: ApiResponse<FolderMemberData[]>;
  };
} {
  return !!data.apiResponses.list?.data && 'FolderId' in data.apiResponses.list.data;
}

export function isUserExport(data: AssetExportData): data is AssetExportData & {
  apiResponses: {
    list?: ApiResponse<UserListData>;
    describe?: ApiResponse<UserDescribeData>;
    groups?: ApiResponse<UserGroupData[]>;
  };
} {
  return !!data.apiResponses.list?.data && 'UserName' in data.apiResponses.list.data;
}

export function isGroupExport(data: AssetExportData): data is AssetExportData & {
  apiResponses: {
    list?: ApiResponse<GroupListData>;
    describe?: ApiResponse<GroupDescribeData>;
    members?: ApiResponse<GroupMemberData[]>;
  };
} {
  return !!data.apiResponses.list?.data && 'GroupName' in data.apiResponses.list.data;
}
