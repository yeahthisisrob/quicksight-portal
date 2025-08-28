/**
 * Centralized AWS SDK type exports
 * Single point of control for SDK type imports
 */
// CloudTrail types
import type {
  Event as CloudTrailEvent,
  LookupAttribute,
  LookupEventsCommandInput,
  LookupEventsCommandOutput,
} from '@aws-sdk/client-cloudtrail';
// QuickSight types
import type {
  // Command outputs
  ListDashboardsCommandOutput,
  ListAnalysesCommandOutput,
  ListDataSetsCommandOutput,
  ListDataSourcesCommandOutput,
  ListFoldersCommandOutput,
  ListFolderMembersCommandOutput,
  ListUsersCommandOutput,
  ListGroupsCommandOutput,
  ListGroupMembershipsCommandOutput,
  ListUserGroupsCommandOutput,
  ListIngestionsCommandOutput,
  ListRefreshSchedulesCommandOutput,
  DescribeDashboardCommandOutput,
  DescribeAnalysisCommandOutput,
  DescribeDataSetCommandOutput,
  DescribeDataSourceCommandOutput,
  DescribeFolderCommandOutput,
  DescribeIngestionCommandOutput,
  DescribeUserCommandOutput,
  DescribeGroupCommandOutput,
  DescribeDashboardDefinitionCommandOutput,
  DescribeAnalysisDefinitionCommandOutput,
  DescribeDashboardPermissionsCommandOutput,
  DescribeAnalysisPermissionsCommandOutput,
  DescribeDataSetPermissionsCommandOutput,
  DescribeDataSourcePermissionsCommandOutput,
  DescribeFolderPermissionsCommandOutput,
  CreateDashboardCommandOutput,
  CreateAnalysisCommandOutput,
  CreateDataSetCommandOutput,
  CreateDataSourceCommandOutput,
  CreateFolderCommandOutput,
  CreateGroupCommandOutput,
  CreateGroupMembershipCommandOutput,
  CreateFolderMembershipCommandOutput,
  CreateRefreshScheduleCommandOutput,
  UpdateDashboardCommandOutput,
  UpdateAnalysisCommandOutput,
  UpdateDataSetCommandOutput,
  UpdateDataSourceCommandOutput,
  UpdateFolderCommandOutput,
  UpdateGroupCommandOutput,
  UpdateUserCommandOutput,
  DeleteDashboardCommandOutput,
  DeleteAnalysisCommandOutput,
  DeleteDataSetCommandOutput,
  DeleteDataSourceCommandOutput,
  DeleteFolderCommandOutput,
  DeleteGroupCommandOutput,
  RegisterUserCommandOutput,
  TagResourceCommandOutput,
  UntagResourceCommandOutput,
  ListTagsForResourceCommandOutput,

  // Common shapes
  AnalysisSummary,
  DashboardSummary,
  DataSetSummary,
  DataSourceSummary,
  FolderSummary,
  FolderMember,
  User,
  Group,
  GroupMember,

  // Full entities
  Dashboard,
  Analysis,
  DataSet,
  DataSource,
  Folder,
  Ingestion,
  RefreshSchedule,

  // Definitions
  DashboardVersionDefinition,
  AnalysisDefinition,

  // Parameters and configurations
  DataSourceParameters,
  DataSourceCredentials,
  VpcConnectionProperties,
  SslProperties,
  PhysicalTable,
  LogicalTable,
  ColumnGroup,
  FieldFolder,
  RowLevelPermissionDataSet,
  RowLevelPermissionTagConfiguration,
  ColumnLevelPermissionRule,
  DataSetUsageConfiguration,
  DatasetParameter,
  DashboardPublishOptions,
  AnalysisSourceEntity,
  DashboardSourceEntity,
  ResourcePermission,
  DataSetRefreshProperties,
  Tag,

  // Enums
  DataSourceType,
  DataSetImportMode,
  IngestionStatus,
  IngestionType,
  IngestionRequestType,
  FolderType,
  MemberType,
  UserRole,
  IdentityType,
} from '@aws-sdk/client-quicksight';
// S3 types
import type {
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  HeadObjectCommandInput,
  HeadObjectCommandOutput,
  CopyObjectCommandInput,
  CopyObjectCommandOutput,
  _Object as S3Object,
  ObjectStorageClass,
} from '@aws-sdk/client-s3';

// Re-export everything
export type {
  // CloudTrail types
  CloudTrailEvent,
  LookupAttribute,
  LookupEventsCommandInput,
  LookupEventsCommandOutput,

  // S3 types
  GetObjectCommandInput,
  GetObjectCommandOutput,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  HeadObjectCommandInput,
  HeadObjectCommandOutput,
  CopyObjectCommandInput,
  CopyObjectCommandOutput,
  S3Object,
  ObjectStorageClass,

  // Command outputs
  ListDashboardsCommandOutput,
  ListAnalysesCommandOutput,
  ListDataSetsCommandOutput,
  ListDataSourcesCommandOutput,
  ListFoldersCommandOutput,
  ListFolderMembersCommandOutput,
  ListUsersCommandOutput,
  ListGroupsCommandOutput,
  ListGroupMembershipsCommandOutput,
  ListUserGroupsCommandOutput,
  ListIngestionsCommandOutput,
  ListRefreshSchedulesCommandOutput,
  DescribeDashboardCommandOutput,
  DescribeAnalysisCommandOutput,
  DescribeDataSetCommandOutput,
  DescribeDataSourceCommandOutput,
  DescribeFolderCommandOutput,
  DescribeIngestionCommandOutput,
  DescribeUserCommandOutput,
  DescribeGroupCommandOutput,
  DescribeDashboardDefinitionCommandOutput,
  DescribeAnalysisDefinitionCommandOutput,
  DescribeDashboardPermissionsCommandOutput,
  DescribeAnalysisPermissionsCommandOutput,
  DescribeDataSetPermissionsCommandOutput,
  DescribeDataSourcePermissionsCommandOutput,
  DescribeFolderPermissionsCommandOutput,
  CreateDashboardCommandOutput,
  CreateAnalysisCommandOutput,
  CreateDataSetCommandOutput,
  CreateDataSourceCommandOutput,
  CreateFolderCommandOutput,
  CreateGroupCommandOutput,
  CreateGroupMembershipCommandOutput,
  CreateFolderMembershipCommandOutput,
  CreateRefreshScheduleCommandOutput,
  UpdateDashboardCommandOutput,
  UpdateAnalysisCommandOutput,
  UpdateDataSetCommandOutput,
  UpdateDataSourceCommandOutput,
  UpdateFolderCommandOutput,
  UpdateGroupCommandOutput,
  UpdateUserCommandOutput,
  DeleteDashboardCommandOutput,
  DeleteAnalysisCommandOutput,
  DeleteDataSetCommandOutput,
  DeleteDataSourceCommandOutput,
  DeleteFolderCommandOutput,
  DeleteGroupCommandOutput,
  RegisterUserCommandOutput,
  TagResourceCommandOutput,
  UntagResourceCommandOutput,
  ListTagsForResourceCommandOutput,

  // Common shapes
  AnalysisSummary,
  DashboardSummary,
  DataSetSummary,
  DataSourceSummary,
  FolderSummary,
  FolderMember,
  User,
  Group,
  GroupMember,

  // Full entities
  Dashboard,
  Analysis,
  DataSet,
  DataSource,
  Folder,
  Ingestion,
  RefreshSchedule,

  // Definitions
  DashboardVersionDefinition,
  AnalysisDefinition,

  // Parameters and configurations
  DataSourceParameters,
  DataSourceCredentials,
  VpcConnectionProperties,
  SslProperties,
  PhysicalTable,
  LogicalTable,
  ColumnGroup,
  FieldFolder,
  RowLevelPermissionDataSet,
  RowLevelPermissionTagConfiguration,
  ColumnLevelPermissionRule,
  DataSetUsageConfiguration,
  DatasetParameter,
  DashboardPublishOptions,
  AnalysisSourceEntity,
  DashboardSourceEntity,
  ResourcePermission,
  DataSetRefreshProperties,
  Tag,

  // Enums
  DataSourceType,
  DataSetImportMode,
  IngestionStatus,
  IngestionType,
  IngestionRequestType,
  FolderType,
  MemberType,
  UserRole,
  IdentityType,
};

/**
 * Custom types for things not exported by SDK
 */

// Since IngestionSummary isn't exported, create our own minimal type
export interface IngestionBrief {
  ingestionId: string;
  status: IngestionStatus | string;
  createdTime?: Date;
  ingestionTimeInSeconds?: number;
  ingestionSizeInBytes?: number;
  rowsIngested?: number;
  rowsDropped?: number;
}

// Physical table map type
export type PhysicalTableMap = Record<string, PhysicalTable>;

// Logical table map type
export type LogicalTableMap = Record<string, LogicalTable>;

// Field folders type
export type FieldFolders = Record<string, FieldFolder>;

/**
 * Paginated response types (SDK doesn't export these cleanly)
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
}

export type DashboardsPage = PaginatedResponse<DashboardSummary>;
export type AnalysesPage = PaginatedResponse<AnalysisSummary>;
export type DataSetsPage = PaginatedResponse<DataSetSummary>;
export type DataSourcesPage = PaginatedResponse<DataSourceSummary>;
export type FoldersPage = PaginatedResponse<FolderSummary>;
export type UsersPage = PaginatedResponse<User>;
export type GroupsPage = PaginatedResponse<Group>;
export type IngestionsPage = PaginatedResponse<Ingestion>;
export type RefreshSchedulesPage = PaginatedResponse<RefreshSchedule>;
