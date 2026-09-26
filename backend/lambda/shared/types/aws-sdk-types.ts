// QuickSight types
import type {
  Analysis,
  AnalysisDefinition,
  AnalysisSourceEntity,
  // Common shapes
  AnalysisSummary,
  ColumnGroup,
  ColumnLevelPermissionRule,
  // Full entities
  Dashboard,
  DashboardPublishOptions,
  DashboardSourceEntity,
  DashboardSummary,
  // Definitions
  DashboardVersionDefinition,
  DataSet,
  DataSetImportMode,
  DataSetSummary,
  DataSetUsageConfiguration,
  DataSource,
  DataSourceCredentials,
  // Parameters and configurations
  DataSourceParameters,
  DataSourceSummary,
  DatasetParameter,
  FieldFolder,
  Folder,
  FolderMember,
  FolderSummary,
  FolderType,
  Group,
  GroupMember,
  IdentityType,
  LogicalTable,
  MemberType,
  PhysicalTable,
  ResourcePermission,
  RowLevelPermissionDataSet,
  RowLevelPermissionTagConfiguration,
  SslProperties,
  Tag,
  User,
  UserRole,
  VpcConnectionProperties,
} from '@aws-sdk/client-quicksight';

// Re-export everything
export type {
  Analysis,
  AnalysisDefinition,
  AnalysisSourceEntity,
  // Common shapes
  AnalysisSummary,
  // CloudTrail types

  ColumnGroup,
  ColumnLevelPermissionRule,
  // Full entities
  Dashboard,
  DashboardPublishOptions,
  DashboardSourceEntity,
  DashboardSummary,
  // Definitions
  DashboardVersionDefinition,
  DataSet,
  DataSetImportMode,
  DataSetSummary,
  DataSetUsageConfiguration,
  DataSource,
  DataSourceCredentials,
  // Parameters and configurations
  DataSourceParameters,
  DataSourceSummary,
  // Enums

  DatasetParameter,
  Folder,
  FolderMember,
  FolderSummary,
  FolderType,
  // S3 types

  Group,
  GroupMember,
  IdentityType,
  // Command outputs

  MemberType,
  ResourcePermission,
  RowLevelPermissionDataSet,
  RowLevelPermissionTagConfiguration,
  SslProperties,
  Tag,
  User,
  UserRole,
  VpcConnectionProperties,
};

// Physical table map type
export type PhysicalTableMap = Record<string, PhysicalTable>;

// Logical table map type
export type LogicalTableMap = Record<string, LogicalTable>;

// Field folders type
export type FieldFolders = Record<string, FieldFolder>;
