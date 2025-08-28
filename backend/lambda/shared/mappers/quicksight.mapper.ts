/**
 * Mappers for transforming between AWS SDK QuickSight types and Domain types
 * SDK types use PascalCase (from AWS), Domain types use camelCase (our internal)
 */

import type {
  DashboardSummary,
  DatasetSummary,
  AnalysisSummary,
  DatasourceSummary,
  FolderSummary,
  User,
  Group,
  Permission,
  Tag,
  DashboardDetails,
  AnalysisDetails,
  DatasetDetails,
  DatasourceDetails,
  FolderDetails,
  FolderMember,
  PaginatedResult,
} from '../models/quicksight-domain.model';
import type {
  DashboardSummary as SDKDashboardSummary,
  DataSet as SDKDataSet,
  DataSetSummary as SDKDataSetSummary,
  Analysis as SDKAnalysis,
  AnalysisSummary as SDKAnalysisSummary,
  DataSource as SDKDataSource,
  DataSourceSummary as SDKDataSourceSummary,
  Folder as SDKFolder,
  FolderSummary as SDKFolderSummary,
  FolderMember as SDKFolderMember,
  User as SDKUser,
  Group as SDKGroup,
  Dashboard as SDKDashboard,
  ResourcePermission as SDKResourcePermission,
  Tag as SDKTag,
} from '../types/aws-sdk-types';

// ==================== Dashboard Mappers ====================

export function mapSDKDashboardSummaryToDomain(sdk: SDKDashboardSummary): DashboardSummary {
  if (!sdk.DashboardId || !sdk.Name || !sdk.Arn || !sdk.CreatedTime || !sdk.LastUpdatedTime) {
    throw new Error('Missing required fields in DashboardSummary');
  }

  return {
    dashboardId: sdk.DashboardId,
    name: sdk.Name,
    arn: sdk.Arn,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
    publishedVersionNumber: sdk.PublishedVersionNumber,
    lastPublishedTime: sdk.LastPublishedTime,
  };
}

export function mapSDKDashboardToDomain(sdk: SDKDashboard): DashboardDetails {
  if (!sdk.DashboardId || !sdk.Arn || !sdk.Name || !sdk.CreatedTime || !sdk.LastUpdatedTime) {
    throw new Error('Missing required fields in Dashboard');
  }

  return {
    dashboardId: sdk.DashboardId,
    arn: sdk.Arn,
    name: sdk.Name,
    version: sdk.Version
      ? {
          versionNumber: sdk.Version.VersionNumber,
          status: sdk.Version.Status,
          arn: sdk.Version.Arn,
          sourceEntityArn: sdk.Version.SourceEntityArn,
          dataSetArns: sdk.Version.DataSetArns,
          description: sdk.Version.Description,
          createdTime: sdk.Version.CreatedTime,
        }
      : undefined,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
    lastPublishedTime: sdk.LastPublishedTime,
  };
}

// ==================== Analysis Mappers ====================

export function mapSDKAnalysisSummaryToDomain(sdk: SDKAnalysisSummary): AnalysisSummary {
  if (!sdk.AnalysisId || !sdk.Name || !sdk.Arn || !sdk.CreatedTime || !sdk.LastUpdatedTime) {
    throw new Error('Missing required fields in AnalysisSummary');
  }

  return {
    analysisId: sdk.AnalysisId,
    name: sdk.Name,
    arn: sdk.Arn,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
    status: sdk.Status,
  };
}

export function mapSDKAnalysisToDomain(sdk: SDKAnalysis): AnalysisDetails {
  if (!sdk.AnalysisId || !sdk.Arn || !sdk.Name || !sdk.CreatedTime || !sdk.LastUpdatedTime) {
    throw new Error('Missing required fields in Analysis');
  }

  return {
    analysisId: sdk.AnalysisId,
    arn: sdk.Arn,
    name: sdk.Name,
    status: sdk.Status,
    errors: sdk.Errors?.map((e) => {
      if (!e.Type || !e.Message) {
        throw new Error('Missing required fields in AnalysisError');
      }
      return {
        type: e.Type,
        message: e.Message,
      };
    }),
    dataSetArns: sdk.DataSetArns,
    themeArn: sdk.ThemeArn,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
  };
}

// ==================== Dataset Mappers ====================

export function mapSDKDataSetSummaryToDomain(sdk: SDKDataSetSummary): DatasetSummary {
  if (!sdk.DataSetId || !sdk.Name || !sdk.Arn || !sdk.CreatedTime || !sdk.LastUpdatedTime) {
    throw new Error('Missing required fields in DataSetSummary');
  }

  return {
    dataSetId: sdk.DataSetId,
    name: sdk.Name,
    arn: sdk.Arn,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
    importMode: sdk.ImportMode as 'SPICE' | 'DIRECT_QUERY' | undefined,
    rowLevelPermissionDataSet: sdk.RowLevelPermissionDataSet,
    rowLevelPermissionTagConfigurationApplied: sdk.RowLevelPermissionTagConfigurationApplied,
    columnLevelPermissionRulesApplied: sdk.ColumnLevelPermissionRulesApplied,
  };
}

export function mapSDKDataSetToDomain(sdk: SDKDataSet): DatasetDetails {
  if (!sdk.DataSetId || !sdk.Arn || !sdk.Name || !sdk.CreatedTime || !sdk.LastUpdatedTime) {
    throw new Error('Missing required fields in DataSet');
  }

  return {
    dataSetId: sdk.DataSetId,
    arn: sdk.Arn,
    name: sdk.Name,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
    physicalTableMap: sdk.PhysicalTableMap,
    logicalTableMap: sdk.LogicalTableMap,
    outputColumns: sdk.OutputColumns?.map((col) => {
      if (!col.Name || !col.Type) {
        throw new Error('Missing required fields in OutputColumn');
      }
      return {
        name: col.Name,
        type: col.Type,
        description: col.Description,
      };
    }),
    importMode: sdk.ImportMode as 'SPICE' | 'DIRECT_QUERY' | undefined,
    consumedSpiceCapacityInBytes: sdk.ConsumedSpiceCapacityInBytes,
    columnGroups: sdk.ColumnGroups,
    fieldFolders: sdk.FieldFolders,
    rowLevelPermissionDataSet: sdk.RowLevelPermissionDataSet,
    rowLevelPermissionTagConfiguration: sdk.RowLevelPermissionTagConfiguration,
    columnLevelPermissionRules: sdk.ColumnLevelPermissionRules,
    dataSetUsageConfiguration: sdk.DataSetUsageConfiguration,
  };
}

// ==================== Datasource Mappers ====================

export function mapSDKDataSourceSummaryToDomain(sdk: SDKDataSourceSummary): DatasourceSummary {
  if (!sdk.DataSourceId || !sdk.Name || !sdk.Arn || !sdk.CreatedTime || !sdk.LastUpdatedTime) {
    throw new Error('Missing required fields in DataSourceSummary');
  }

  return {
    dataSourceId: sdk.DataSourceId,
    name: sdk.Name,
    arn: sdk.Arn,
    type: sdk.Type,
    status: (sdk as any).Status, // AWS SDK type missing Status, but API returns it
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
  };
}

export function mapSDKDataSourceToDomain(sdk: SDKDataSource): DatasourceDetails {
  if (
    !sdk.DataSourceId ||
    !sdk.Arn ||
    !sdk.Name ||
    !sdk.Type ||
    !sdk.CreatedTime ||
    !sdk.LastUpdatedTime
  ) {
    throw new Error('Missing required fields in DataSource');
  }

  return {
    dataSourceId: sdk.DataSourceId,
    arn: sdk.Arn,
    name: sdk.Name,
    type: sdk.Type,
    status: sdk.Status,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
    dataSourceParameters: sdk.DataSourceParameters,
    alternateDataSourceParameters: sdk.AlternateDataSourceParameters,
    vpcConnectionProperties: sdk.VpcConnectionProperties,
    sslProperties: sdk.SslProperties,
    errorInfo: sdk.ErrorInfo
      ? {
          type: sdk.ErrorInfo.Type || '',
          message: sdk.ErrorInfo.Message || '',
        }
      : undefined,
    secretArn: sdk.SecretArn,
  };
}

// ==================== Folder Mappers ====================

export function mapSDKFolderSummaryToDomain(sdk: SDKFolderSummary): FolderSummary {
  if (!sdk.FolderId || !sdk.Name || !sdk.Arn || !sdk.CreatedTime || !sdk.LastUpdatedTime) {
    throw new Error('Missing required fields in FolderSummary');
  }

  return {
    folderId: sdk.FolderId,
    name: sdk.Name,
    arn: sdk.Arn,
    folderType: sdk.FolderType,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
    sharingModel: sdk.SharingModel,
  };
}

export function mapSDKFolderToDomain(sdk: SDKFolder): FolderDetails {
  if (!sdk.FolderId || !sdk.Arn || !sdk.Name) {
    throw new Error('Missing required fields in Folder');
  }

  return {
    folderId: sdk.FolderId,
    arn: sdk.Arn,
    name: sdk.Name,
    folderType: sdk.FolderType,
    folderPath: sdk.FolderPath,
    createdTime: sdk.CreatedTime,
    lastUpdatedTime: sdk.LastUpdatedTime,
    sharingModel: sdk.SharingModel,
  };
}

export function mapSDKFolderMemberToDomain(sdk: SDKFolderMember): FolderMember {
  if (!sdk.MemberId || !sdk.MemberType) {
    throw new Error('Missing required fields in FolderMember');
  }

  return {
    memberId: sdk.MemberId,
    memberType: sdk.MemberType as 'DASHBOARD' | 'ANALYSIS' | 'DATASET' | 'DATASOURCE',
  };
}

// ==================== User/Group Mappers ====================

export function mapSDKUserToDomain(sdk: SDKUser): User {
  if (!sdk.UserName || !sdk.Arn) {
    throw new Error('Missing required fields in User');
  }

  const now = new Date();
  return {
    userName: sdk.UserName,
    email: sdk.Email,
    role: sdk.Role,
    identityType: sdk.IdentityType,
    active: sdk.Active,
    arn: sdk.Arn,
    principalId: sdk.PrincipalId,
    customPermissionsName: sdk.CustomPermissionsName,
    createdTime: now,
    lastUpdatedTime: now,
  };
}

export function mapSDKGroupToDomain(sdk: SDKGroup): Group {
  if (!sdk.GroupName || !sdk.Arn) {
    throw new Error('Missing required fields in Group');
  }

  const now = new Date();
  return {
    groupName: sdk.GroupName,
    description: sdk.Description,
    arn: sdk.Arn,
    principalId: sdk.PrincipalId,
    createdTime: now,
    lastUpdatedTime: now,
  };
}

// ==================== Common Mappers ====================

export function mapSDKResourcePermissionToDomain(sdk: SDKResourcePermission): Permission {
  if (!sdk.Principal || !sdk.Actions) {
    throw new Error('Missing required fields in ResourcePermission');
  }

  return {
    principal: sdk.Principal,
    actions: sdk.Actions,
  };
}

export function mapSDKTagToDomain(sdk: SDKTag): Tag {
  if (!sdk.Key || !sdk.Value) {
    throw new Error('Missing required fields in Tag');
  }

  return {
    key: sdk.Key,
    value: sdk.Value,
  };
}

// ==================== List Result Mappers ====================

export function mapSDKDashboardListToDomain(
  items: SDKDashboardSummary[],
  nextToken?: string
): PaginatedResult<DashboardSummary> {
  return {
    items: items.map(mapSDKDashboardSummaryToDomain),
    nextToken,
  };
}

export function mapSDKAnalysisListToDomain(
  items: SDKAnalysisSummary[],
  nextToken?: string
): PaginatedResult<AnalysisSummary> {
  return {
    items: items.map(mapSDKAnalysisSummaryToDomain),
    nextToken,
  };
}

export function mapSDKDataSetListToDomain(
  items: SDKDataSetSummary[],
  nextToken?: string
): PaginatedResult<DatasetSummary> {
  return {
    items: items.map(mapSDKDataSetSummaryToDomain),
    nextToken,
  };
}

export function mapSDKDataSourceListToDomain(
  items: SDKDataSourceSummary[],
  nextToken?: string
): PaginatedResult<DatasourceSummary> {
  return {
    items: items.map(mapSDKDataSourceSummaryToDomain),
    nextToken,
  };
}

export function mapSDKFolderListToDomain(
  items: SDKFolderSummary[],
  nextToken?: string
): PaginatedResult<FolderSummary> {
  return {
    items: items.map(mapSDKFolderSummaryToDomain),
    nextToken,
  };
}

export function mapSDKUserListToDomain(
  items: SDKUser[],
  nextToken?: string
): PaginatedResult<User> {
  return {
    items: items.map(mapSDKUserToDomain),
    nextToken,
  };
}

export function mapSDKGroupListToDomain(
  items: SDKGroup[],
  nextToken?: string
): PaginatedResult<Group> {
  return {
    items: items.map(mapSDKGroupToDomain),
    nextToken,
  };
}

// ==================== Reverse Mappers: Domain → SDK ====================
// These are used for exports to preserve original AWS API format

export function mapDomainDashboardSummaryToSDK(domain: DashboardSummary): SDKDashboardSummary {
  return {
    DashboardId: domain.dashboardId,
    Name: domain.name,
    Arn: domain.arn,
    CreatedTime: domain.createdTime,
    LastUpdatedTime: domain.lastUpdatedTime,
    PublishedVersionNumber: domain.publishedVersionNumber,
    LastPublishedTime: domain.lastPublishedTime,
  };
}

export function mapDomainAnalysisSummaryToSDK(domain: AnalysisSummary): SDKAnalysisSummary {
  return {
    AnalysisId: domain.analysisId,
    Name: domain.name,
    Arn: domain.arn,
    CreatedTime: domain.createdTime,
    LastUpdatedTime: domain.lastUpdatedTime,
    Status: domain.status as any, // SDK accepts string, domain has specific type
  };
}

export function mapDomainDatasetSummaryToSDK(domain: DatasetSummary): SDKDataSetSummary {
  return {
    DataSetId: domain.dataSetId,
    Name: domain.name,
    Arn: domain.arn,
    CreatedTime: domain.createdTime,
    LastUpdatedTime: domain.lastUpdatedTime,
    ImportMode: domain.importMode,
    RowLevelPermissionDataSet: domain.rowLevelPermissionDataSet,
    RowLevelPermissionTagConfigurationApplied: domain.rowLevelPermissionTagConfigurationApplied,
    ColumnLevelPermissionRulesApplied: domain.columnLevelPermissionRulesApplied,
  };
}

export function mapDomainDatasourceSummaryToSDK(domain: DatasourceSummary): SDKDataSourceSummary {
  const result: any = {
    DataSourceId: domain.dataSourceId,
    Name: domain.name,
    Arn: domain.arn,
    Type: domain.type,
    CreatedTime: domain.createdTime,
    LastUpdatedTime: domain.lastUpdatedTime,
  };

  // Add Status if present (AWS SDK type missing it, but API expects it)
  if (domain.status !== undefined) {
    result.Status = domain.status;
  }

  return result as SDKDataSourceSummary;
}

export function mapDomainFolderSummaryToSDK(domain: FolderSummary): SDKFolderSummary {
  return {
    FolderId: domain.folderId,
    Name: domain.name,
    Arn: domain.arn,
    FolderType: domain.folderType as any, // SDK accepts string, domain has specific type
    CreatedTime: domain.createdTime,
    LastUpdatedTime: domain.lastUpdatedTime,
    SharingModel: domain.sharingModel as any, // SDK accepts string, domain has specific type
  };
}

export function mapSDKUserSummaryToDomain(sdk: SDKUser): User {
  const now = new Date();
  return {
    userName: sdk.UserName || '',
    email: sdk.Email || '',
    role: sdk.Role || 'READER',
    identityType: sdk.IdentityType || 'IAM',
    active: sdk.Active !== false,
    arn: sdk.Arn || '',
    principalId: sdk.PrincipalId || '',
    customPermissionsName: sdk.CustomPermissionsName,
    createdTime: now,
    lastUpdatedTime: now,
  };
}

export function mapSDKGroupSummaryToDomain(sdk: SDKGroup): Group {
  const now = new Date();
  return {
    groupName: sdk.GroupName || '',
    description: sdk.Description,
    arn: sdk.Arn || '',
    principalId: sdk.PrincipalId || '',
    createdTime: now,
    lastUpdatedTime: now,
  };
}

export function mapDomainUserToSDK(domain: User): SDKUser {
  return {
    UserName: domain.userName,
    Email: domain.email,
    Role: domain.role as any, // SDK accepts string, domain has specific type
    IdentityType: domain.identityType as any, // SDK accepts string, domain has specific type
    Active: domain.active,
    Arn: domain.arn,
    PrincipalId: domain.principalId,
    CustomPermissionsName: domain.customPermissionsName,
  };
}

export function mapDomainGroupToSDK(domain: Group): SDKGroup {
  return {
    GroupName: domain.groupName,
    Description: domain.description,
    Arn: domain.arn,
    PrincipalId: domain.principalId,
  };
}

export function mapDomainPermissionToSDK(domain: Permission): SDKResourcePermission {
  return {
    Principal: domain.principal,
    Actions: domain.actions,
  };
}

export function mapDomainTagToSDK(domain: Tag): SDKTag {
  return {
    Key: domain.key,
    Value: domain.value,
  };
}
