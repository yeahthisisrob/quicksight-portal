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
  Analysis,
  AnalysisDefinition,
  AnalysisSourceEntity,
  // Common shapes
  AnalysisSummary,
  ColumnGroup,
  ColumnLevelPermissionRule,
  CreateAnalysisCommandOutput,
  CreateDashboardCommandOutput,
  CreateDataSetCommandOutput,
  CreateDataSourceCommandOutput,
  CreateFolderCommandOutput,
  CreateFolderMembershipCommandOutput,
  CreateGroupCommandOutput,
  CreateGroupMembershipCommandOutput,
  CreateRefreshScheduleCommandOutput,
  // Full entities
  Dashboard,
  DashboardPublishOptions,
  DashboardSourceEntity,
  DashboardSummary,
  // Definitions
  DashboardVersionDefinition,
  DataSet,
  DataSetImportMode,
  DataSetRefreshProperties,
  DataSetSummary,
  DataSetUsageConfiguration,
  DataSource,
  DataSourceCredentials,
  // Parameters and configurations
  DataSourceParameters,
  DataSourceSummary,
  // Enums
  DataSourceType,
  DatasetParameter,
  DeleteAnalysisCommandOutput,
  DeleteDashboardCommandOutput,
  DeleteDataSetCommandOutput,
  DeleteDataSourceCommandOutput,
  DeleteFolderCommandOutput,
  DeleteGroupCommandOutput,
  DescribeAnalysisCommandOutput,
  DescribeAnalysisDefinitionCommandOutput,
  DescribeAnalysisPermissionsCommandOutput,
  DescribeDashboardCommandOutput,
  DescribeDashboardDefinitionCommandOutput,
  DescribeDashboardPermissionsCommandOutput,
  DescribeDataSetCommandOutput,
  DescribeDataSetPermissionsCommandOutput,
  DescribeDataSourceCommandOutput,
  DescribeDataSourcePermissionsCommandOutput,
  DescribeFolderCommandOutput,
  DescribeFolderPermissionsCommandOutput,
  DescribeGroupCommandOutput,
  DescribeIngestionCommandOutput,
  DescribeUserCommandOutput,
  FieldFolder,
  Folder,
  FolderMember,
  FolderSummary,
  FolderType,
  Group,
  GroupMember,
  IdentityType,
  Ingestion,
  IngestionRequestType,
  IngestionStatus,
  IngestionType,
  ListAnalysesCommandOutput,
  // Command outputs
  ListDashboardsCommandOutput,
  ListDataSetsCommandOutput,
  ListDataSourcesCommandOutput,
  ListFolderMembersCommandOutput,
  ListFoldersCommandOutput,
  ListGroupMembershipsCommandOutput,
  ListGroupsCommandOutput,
  ListIngestionsCommandOutput,
  ListRefreshSchedulesCommandOutput,
  ListTagsForResourceCommandOutput,
  ListUserGroupsCommandOutput,
  ListUsersCommandOutput,
  LogicalTable,
  MemberType,
  PhysicalTable,
  RefreshSchedule,
  RegisterUserCommandOutput,
  ResourcePermission,
  RowLevelPermissionDataSet,
  RowLevelPermissionTagConfiguration,
  SslProperties,
  Tag,
  TagResourceCommandOutput,
  UntagResourceCommandOutput,
  UpdateAnalysisCommandOutput,
  UpdateDashboardCommandOutput,
  UpdateDataSetCommandOutput,
  UpdateDataSourceCommandOutput,
  UpdateFolderCommandOutput,
  UpdateGroupCommandOutput,
  UpdateUserCommandOutput,
  User,
  UserRole,
  VpcConnectionProperties,
} from '@aws-sdk/client-quicksight';
// S3 types
import type {
  CopyObjectCommandInput,
  CopyObjectCommandOutput,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  HeadObjectCommandInput,
  HeadObjectCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  ObjectStorageClass,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  _Object as S3Object,
} from '@aws-sdk/client-s3';

// Re-export everything
export type {
  Analysis,
  AnalysisDefinition,
  AnalysisSourceEntity,
  // Common shapes
  AnalysisSummary,
  // CloudTrail types
  CloudTrailEvent,
  ColumnGroup,
  ColumnLevelPermissionRule,
  CopyObjectCommandInput,
  CopyObjectCommandOutput,
  CreateAnalysisCommandOutput,
  CreateDashboardCommandOutput,
  CreateDataSetCommandOutput,
  CreateDataSourceCommandOutput,
  CreateFolderCommandOutput,
  CreateFolderMembershipCommandOutput,
  CreateGroupCommandOutput,
  CreateGroupMembershipCommandOutput,
  CreateRefreshScheduleCommandOutput,
  // Full entities
  Dashboard,
  DashboardPublishOptions,
  DashboardSourceEntity,
  DashboardSummary,
  // Definitions
  DashboardVersionDefinition,
  DataSet,
  DataSetImportMode,
  DataSetRefreshProperties,
  DataSetSummary,
  DataSetUsageConfiguration,
  DataSource,
  DataSourceCredentials,
  // Parameters and configurations
  DataSourceParameters,
  DataSourceSummary,
  // Enums
  DataSourceType,
  DatasetParameter,
  DeleteAnalysisCommandOutput,
  DeleteDashboardCommandOutput,
  DeleteDataSetCommandOutput,
  DeleteDataSourceCommandOutput,
  DeleteFolderCommandOutput,
  DeleteGroupCommandOutput,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  DescribeAnalysisCommandOutput,
  DescribeAnalysisDefinitionCommandOutput,
  DescribeAnalysisPermissionsCommandOutput,
  DescribeDashboardCommandOutput,
  DescribeDashboardDefinitionCommandOutput,
  DescribeDashboardPermissionsCommandOutput,
  DescribeDataSetCommandOutput,
  DescribeDataSetPermissionsCommandOutput,
  DescribeDataSourceCommandOutput,
  DescribeDataSourcePermissionsCommandOutput,
  DescribeFolderCommandOutput,
  DescribeFolderPermissionsCommandOutput,
  DescribeGroupCommandOutput,
  DescribeIngestionCommandOutput,
  DescribeUserCommandOutput,
  FieldFolder,
  Folder,
  FolderMember,
  FolderSummary,
  FolderType,
  // S3 types
  GetObjectCommandInput,
  GetObjectCommandOutput,
  Group,
  GroupMember,
  HeadObjectCommandInput,
  HeadObjectCommandOutput,
  IdentityType,
  Ingestion,
  IngestionRequestType,
  IngestionStatus,
  IngestionType,
  ListAnalysesCommandOutput,
  // Command outputs
  ListDashboardsCommandOutput,
  ListDataSetsCommandOutput,
  ListDataSourcesCommandOutput,
  ListFolderMembersCommandOutput,
  ListFoldersCommandOutput,
  ListGroupMembershipsCommandOutput,
  ListGroupsCommandOutput,
  ListIngestionsCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  ListRefreshSchedulesCommandOutput,
  ListTagsForResourceCommandOutput,
  ListUserGroupsCommandOutput,
  ListUsersCommandOutput,
  LogicalTable,
  LookupAttribute,
  LookupEventsCommandInput,
  LookupEventsCommandOutput,
  MemberType,
  ObjectStorageClass,
  PhysicalTable,
  PutObjectCommandInput,
  PutObjectCommandOutput,
  RefreshSchedule,
  RegisterUserCommandOutput,
  ResourcePermission,
  RowLevelPermissionDataSet,
  RowLevelPermissionTagConfiguration,
  S3Object,
  SslProperties,
  Tag,
  TagResourceCommandOutput,
  UntagResourceCommandOutput,
  UpdateAnalysisCommandOutput,
  UpdateDashboardCommandOutput,
  UpdateDataSetCommandOutput,
  UpdateDataSourceCommandOutput,
  UpdateFolderCommandOutput,
  UpdateGroupCommandOutput,
  UpdateUserCommandOutput,
  User,
  UserRole,
  VpcConnectionProperties,
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
