/**
 * QuickSight Adapter - AWS SDK interaction layer
 */
import {
  type QuickSightClient,
  ListDashboardsCommand,
  ListDataSetsCommand,
  ListAnalysesCommand,
  ListDataSourcesCommand,
  ListFoldersCommand,
  ListFolderMembersCommand,
  ListUsersCommand,
  ListGroupsCommand,
  ListGroupMembershipsCommand,
  ListUserGroupsCommand,
  DescribeDashboardCommand,
  DescribeDashboardDefinitionCommand,
  DescribeAnalysisCommand,
  DescribeAnalysisDefinitionCommand,
  DescribeDataSetCommand,
  DescribeDataSetRefreshPropertiesCommand,
  DescribeDataSourceCommand,
  DescribeFolderCommand,
  DescribeDashboardPermissionsCommand,
  DescribeAnalysisPermissionsCommand,
  DescribeDataSetPermissionsCommand,
  DescribeDataSourcePermissionsCommand,
  DescribeFolderPermissionsCommand,
  UpdateFolderPermissionsCommand,
  UpdateDashboardPermissionsCommand,
  UpdateAnalysisPermissionsCommand,
  UpdateDataSetPermissionsCommand,
  UpdateDataSourcePermissionsCommand,
  DeleteAnalysisCommand,
  DeleteDashboardCommand,
  DeleteDataSetCommand,
  DeleteDataSourceCommand,
  CreateRefreshScheduleCommand,
  PutDataSetRefreshPropertiesCommand,
  ListRefreshSchedulesCommand,
  DescribeUserCommand,
  DescribeGroupCommand,
  DescribeGroupMembershipCommand,
  CreateGroupMembershipCommand,
  DeleteGroupMembershipCommand,
  CreateFolderMembershipCommand,
  DeleteFolderMembershipCommand,
  TagResourceCommand,
  UntagResourceCommand,
  ListTagsForResourceCommand,
  ListIngestionsCommand,
  DescribeIngestionCommand,
  CancelIngestionCommand,
  CreateDashboardCommand,
  CreateAnalysisCommand,
  CreateDataSetCommand,
  CreateDataSourceCommand,
  CreateFolderCommand,
  CreateGroupCommand,
  DeleteGroupCommand,
  RegisterUserCommand,
  UpdateDashboardCommand,
  UpdateAnalysisCommand,
  UpdateDataSetCommand,
  UpdateDataSourceCommand,
  UpdateFolderCommand,
  UpdateGroupCommand,
  UpdateUserCommand,
} from '@aws-sdk/client-quicksight';
// AWS SDK v2 imports (for bug workaround)
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import * as aws from 'aws-sdk';

import { STATUS_CODES, QUICKSIGHT_LIMITS, RETRY_CONFIG } from '../../shared/constants';
import type {
  DashboardSummary,
  DataSetSummary,
  AnalysisSummary,
  DataSourceSummary,
  DataSource,
  FolderSummary,
  User,
  Group,
  GroupMember,
  Analysis,
  DashboardVersionDefinition,
  AnalysisDefinition,
  DataSourceParameters,
  DataSourceCredentials,
  ResourcePermission,
  Tag,
  FolderType,
  MemberType,
  UserRole,
  IdentityType,
} from '../../shared/types/aws-sdk-types';
import { withRetry } from '../../shared/utils/awsRetry';
import { logger } from '../../shared/utils/logger';
import {
  quickSightRateLimiter,
  quickSightPermissionsRateLimiter,
} from '../../shared/utils/rateLimiter';

/**
 * Adapter-specific types (not SDK types)
 */
export interface ListOptions {
  maxResults?: number;
  nextToken?: string;
}

export interface ListResult<T> {
  items: T[];
  nextToken?: string;
}

/**
 * QuickSight Adapter - converts AWS SDK responses to plain objects
 */
export class QuickSightAdapter {
  private v2CredentialsInitialized?: Promise<void>;
  private v2DataSourceLister?: aws.QuickSight;

  constructor(
    private readonly client: QuickSightClient,
    private readonly awsAccountId: string
  ) {
    // Initialize v2 client for datasource listing (bug workaround) - skip in tests
    if (process.env.NODE_ENV !== 'test') {
      this.initializeV2Client();
    }
  }

  /**
   * Cancel an ingestion
   */
  public async cancelIngestion(dataSetId: string, ingestionId: string): Promise<void> {
    const command = new CancelIngestionCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
      IngestionId: ingestionId,
    });

    await this.sendWithRateLimit(command);
  }

  public async createAnalysis(params: {
    analysisId: string;
    name: string;
    definition?: AnalysisDefinition;
    permissions?: ResourcePermission[];
    tags?: Tag[];
    sourceEntity?: any;
    themeArn?: string;
  }): Promise<{ arn: string; analysisId: string; creationStatus: string }> {
    const command = new CreateAnalysisCommand({
      AwsAccountId: this.awsAccountId,
      AnalysisId: params.analysisId,
      Name: params.name,
      Definition: params.definition,
      Permissions: params.permissions,
      Tags: params.tags,
      SourceEntity: params.sourceEntity,
      ThemeArn: params.themeArn,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.AnalysisId || !response.CreationStatus) {
      throw new Error('Invalid response from CreateAnalysis');
    }
    return {
      arn: response.Arn,
      analysisId: response.AnalysisId,
      creationStatus: response.CreationStatus,
    };
  }

  public async createDashboard(params: {
    dashboardId: string;
    name: string;
    definition?: DashboardVersionDefinition;
    permissions?: ResourcePermission[];
    tags?: Tag[];
    sourceEntity?: any;
    themeArn?: string;
    dashboardPublishOptions?: any;
  }): Promise<{ arn: string; dashboardId: string; creationStatus: string; versionArn?: string }> {
    const command = new CreateDashboardCommand({
      AwsAccountId: this.awsAccountId,
      DashboardId: params.dashboardId,
      Name: params.name,
      Definition: params.definition,
      Permissions: params.permissions,
      Tags: params.tags,
      SourceEntity: params.sourceEntity,
      ThemeArn: params.themeArn,
      DashboardPublishOptions: params.dashboardPublishOptions,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.DashboardId || !response.CreationStatus) {
      throw new Error('Invalid response from CreateDashboard');
    }
    return {
      arn: response.Arn,
      dashboardId: response.DashboardId,
      creationStatus: response.CreationStatus,
      versionArn: response.VersionArn,
    };
  }

  public async createDataSet(params: {
    dataSetId: string;
    name: string;
    physicalTableMap: any;
    logicalTableMap?: any;
    importMode: 'SPICE' | 'DIRECT_QUERY';
    permissions?: ResourcePermission[];
    tags?: Tag[];
    columnGroups?: any[];
    fieldFolders?: Record<string, any>;
    rowLevelPermissionDataSet?: any;
    rowLevelPermissionTagConfiguration?: any;
    columnLevelPermissionRules?: any[];
    dataSetUsageConfiguration?: any;
  }): Promise<{ arn: string; dataSetId: string; ingestionArn?: string }> {
    const command = new CreateDataSetCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: params.dataSetId,
      Name: params.name,
      PhysicalTableMap: params.physicalTableMap,
      LogicalTableMap: params.logicalTableMap,
      ImportMode: params.importMode,
      Permissions: params.permissions,
      Tags: params.tags,
      ColumnGroups: params.columnGroups,
      FieldFolders: params.fieldFolders,
      RowLevelPermissionDataSet: params.rowLevelPermissionDataSet,
      RowLevelPermissionTagConfiguration: params.rowLevelPermissionTagConfiguration,
      ColumnLevelPermissionRules: params.columnLevelPermissionRules,
      DataSetUsageConfiguration: params.dataSetUsageConfiguration,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.DataSetId) {
      throw new Error('Invalid response from CreateDataSet');
    }
    return {
      arn: response.Arn,
      dataSetId: response.DataSetId,
      ingestionArn: response.IngestionArn,
    };
  }

  public async createDataSource(params: {
    dataSourceId: string;
    name: string;
    type: string;
    dataSourceParameters?: DataSourceParameters;
    credentials?: DataSourceCredentials;
    permissions?: ResourcePermission[];
    tags?: Tag[];
    vpcConnectionProperties?: any;
    sslProperties?: any;
  }): Promise<{ arn: string; dataSourceId: string; creationStatus: string }> {
    const command = new CreateDataSourceCommand({
      AwsAccountId: this.awsAccountId,
      DataSourceId: params.dataSourceId,
      Name: params.name,
      Type: params.type as any,
      DataSourceParameters: params.dataSourceParameters,
      Credentials: params.credentials,
      Permissions: params.permissions,
      Tags: params.tags,
      VpcConnectionProperties: params.vpcConnectionProperties,
      SslProperties: params.sslProperties,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.DataSourceId || !response.CreationStatus) {
      throw new Error('Invalid response from CreateDataSource');
    }
    return {
      arn: response.Arn,
      dataSourceId: response.DataSourceId,
      creationStatus: response.CreationStatus,
    };
  }

  public async createFolder(params: {
    folderId: string;
    name: string;
    folderType?: FolderType;
    parentFolderArn?: string;
    permissions?: ResourcePermission[];
    tags?: Tag[];
  }): Promise<{ arn: string; folderId: string }> {
    const command = new CreateFolderCommand({
      AwsAccountId: this.awsAccountId,
      FolderId: params.folderId,
      Name: params.name,
      FolderType: params.folderType,
      ParentFolderArn: params.parentFolderArn,
      Permissions: params.permissions,
      Tags: params.tags,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.FolderId) {
      throw new Error('CreateFolder response missing required fields');
    }
    return {
      arn: response.Arn,
      folderId: response.FolderId,
    };
  }

  public async createFolderMembership(
    folderId: string,
    memberId: string,
    memberType: string
  ): Promise<any> {
    const command = new CreateFolderMembershipCommand({
      AwsAccountId: this.awsAccountId,
      FolderId: folderId,
      MemberId: memberId,
      MemberType: memberType as MemberType,
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Status: response.Status,
      FolderMember: response.FolderMember,
      RequestId: response.RequestId,
    };
  }

  public async createGroup(params: {
    groupName: string;
    description?: string;
    namespace?: string;
  }): Promise<{ arn: string; groupName: string; principalId: string }> {
    const command = new CreateGroupCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: params.namespace || 'default',
      GroupName: params.groupName,
      Description: params.description,
    });

    const response = await this.client.send(command);
    if (!response.Group || !response.Group.Arn || !response.Group.GroupName) {
      throw new Error('Invalid response from CreateGroup');
    }
    return {
      arn: response.Group.Arn,
      groupName: response.Group.GroupName,
      principalId: response.Group.PrincipalId || '',
    };
  }

  /**
   * Create group membership
   */
  public async createGroupMembership(
    groupName: string,
    memberName: string,
    namespace: string = 'default'
  ): Promise<void> {
    const command = new CreateGroupMembershipCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: namespace,
      GroupName: groupName,
      MemberName: memberName,
    });

    await this.sendWithRateLimit(command);
  }

  public async createRefreshSchedule(dataSetId: string, schedule: any): Promise<any> {
    const command = new CreateRefreshScheduleCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
      Schedule: schedule,
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Status: response.Status,
      ScheduleId: response.ScheduleId,
      Arn: response.Arn,
      RequestId: response.RequestId,
    };
  }

  public async deleteAnalysis(analysisId: string): Promise<void> {
    const command = new DeleteAnalysisCommand({
      AwsAccountId: this.awsAccountId,
      AnalysisId: analysisId,
    });
    await this.sendWithRateLimit(command);
  }

  public async deleteDashboard(dashboardId: string): Promise<void> {
    const command = new DeleteDashboardCommand({
      AwsAccountId: this.awsAccountId,
      DashboardId: dashboardId,
    });
    await this.sendWithRateLimit(command);
  }

  public async deleteDataset(datasetId: string): Promise<void> {
    const command = new DeleteDataSetCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: datasetId,
    });
    await this.sendWithRateLimit(command);
  }

  public async deleteDatasource(datasourceId: string): Promise<void> {
    const command = new DeleteDataSourceCommand({
      AwsAccountId: this.awsAccountId,
      DataSourceId: datasourceId,
    });
    await this.sendWithRateLimit(command);
  }

  public async deleteFolderMembership(
    folderId: string,
    memberId: string,
    memberType: string
  ): Promise<void> {
    const command = new DeleteFolderMembershipCommand({
      AwsAccountId: this.awsAccountId,
      FolderId: folderId,
      MemberId: memberId,
      MemberType: memberType.toUpperCase() as MemberType,
    });

    await this.sendWithRateLimit(command);
  }

  public async deleteGroup(
    groupName: string,
    namespace: string = 'default'
  ): Promise<{ requestId: string; status: number }> {
    const command = new DeleteGroupCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: namespace,
      GroupName: groupName,
    });

    const response = await this.client.send(command);
    if (!response.RequestId || !response.Status) {
      throw new Error('DeleteGroup response missing required fields');
    }
    return {
      requestId: response.RequestId,
      status: response.Status,
    };
  }

  /**
   * Delete group membership
   */
  public async deleteGroupMembership(
    groupName: string,
    memberName: string,
    namespace: string = 'default'
  ): Promise<void> {
    const command = new DeleteGroupMembershipCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: namespace,
      GroupName: groupName,
      MemberName: memberName,
    });

    await this.sendWithRateLimit(command);
  }

  /**
   * Describe analysis
   */
  public async describeAnalysis(analysisId: string): Promise<Analysis | undefined> {
    const command = new DescribeAnalysisCommand({
      AwsAccountId: this.awsAccountId,
      AnalysisId: analysisId,
    });

    const response = await this.sendWithRateLimit(command);
    return response.Analysis;
  }

  /**
   * Describe analysis definition
   */
  public async describeAnalysisDefinition(analysisId: string): Promise<any> {
    const command = new DescribeAnalysisDefinitionCommand({
      AwsAccountId: this.awsAccountId,
      AnalysisId: analysisId,
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Definition: response.Definition,
      Name: response.Name,
      AnalysisId: response.AnalysisId,
      Errors: response.Errors,
      ResourceStatus: response.ResourceStatus,
      ThemeArn: response.ThemeArn,
    };
  }

  /**
   * Describe analysis permissions
   */
  public async describeAnalysisPermissions(analysisId: string): Promise<any> {
    const command = new DescribeAnalysisPermissionsCommand({
      AwsAccountId: this.awsAccountId,
      AnalysisId: analysisId,
    });

    const response = await this.sendWithPermissionsRateLimit<any>(command);
    return response.Permissions || [];
  }

  /**
   * Describe dashboard (get full details) - Returns raw SDK response
   */
  public async describeDashboard(dashboardId: string, versionNumber?: number): Promise<any> {
    const command = new DescribeDashboardCommand({
      AwsAccountId: this.awsAccountId,
      DashboardId: dashboardId,
      VersionNumber: versionNumber,
    });

    const response = await this.sendWithRateLimit(command);
    return response.Dashboard;
  }

  /**
   * Describe dashboard definition
   */
  public async describeDashboardDefinition(
    dashboardId: string,
    versionNumber?: number
  ): Promise<any> {
    const command = new DescribeDashboardDefinitionCommand({
      AwsAccountId: this.awsAccountId,
      DashboardId: dashboardId,
      VersionNumber: versionNumber,
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Definition: response.Definition,
      Name: response.Name,
      DashboardId: response.DashboardId,
      Errors: response.Errors,
      ResourceStatus: response.ResourceStatus,
      ThemeArn: response.ThemeArn,
      DashboardPublishOptions: response.DashboardPublishOptions,
    };
  }

  /**
   * Describe dashboard permissions
   */
  public async describeDashboardPermissions(dashboardId: string): Promise<any> {
    const command = new DescribeDashboardPermissionsCommand({
      AwsAccountId: this.awsAccountId,
      DashboardId: dashboardId,
    });

    const response = await this.sendWithPermissionsRateLimit<any>(command);
    // Return the full response to include LinkSharingConfiguration
    return response;
  }

  /**
   * Describe dataset
   */
  public async describeDataset(dataSetId: string): Promise<any> {
    const command = new DescribeDataSetCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
    });

    const response = await this.sendWithRateLimit(command);
    return response.DataSet;
  }

  /**
   * Describe dataset permissions
   */
  public async describeDatasetPermissions(dataSetId: string): Promise<any> {
    const command = new DescribeDataSetPermissionsCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
    });

    const response = await this.sendWithPermissionsRateLimit<any>(command);
    return response.Permissions || [];
  }

  /**
   * Describe dataset refresh properties
   */
  public async describeDatasetRefreshProperties(dataSetId: string): Promise<any> {
    const command = new DescribeDataSetRefreshPropertiesCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
    });

    const response = await this.sendWithRateLimit(command);
    return response.DataSetRefreshProperties;
  }

  /**
   * Describe data source - Returns raw SDK response
   */
  public async describeDatasource(dataSourceId: string): Promise<any> {
    const command = new DescribeDataSourceCommand({
      AwsAccountId: this.awsAccountId,
      DataSourceId: dataSourceId,
    });

    const response = await this.sendWithRateLimit(command);
    return response.DataSource;
  }

  /**
   * Describe datasource permissions
   */
  public async describeDatasourcePermissions(dataSourceId: string): Promise<any> {
    const command = new DescribeDataSourcePermissionsCommand({
      AwsAccountId: this.awsAccountId,
      DataSourceId: dataSourceId,
    });

    const response = await this.sendWithPermissionsRateLimit<any>(command);
    return response.Permissions || [];
  }

  /**
   * Describe folder
   */
  public async describeFolder(folderId: string): Promise<any> {
    const command = new DescribeFolderCommand({
      AwsAccountId: this.awsAccountId,
      FolderId: folderId,
    });

    const response = await this.sendWithRateLimit(command);
    return response.Folder;
  }

  /**
   * Describe folder permissions
   */
  public async describeFolderPermissions(folderId: string): Promise<any> {
    const command = new DescribeFolderPermissionsCommand({
      AwsAccountId: this.awsAccountId,
      FolderId: folderId,
    });

    const response = await this.sendWithPermissionsRateLimit<any>(command);
    return response.Permissions || [];
  }

  /**
   * Describe group
   */
  public async describeGroup(groupName: string, namespace: string = 'default'): Promise<any> {
    const command = new DescribeGroupCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: namespace,
      GroupName: groupName,
    });

    const response = await this.sendWithRateLimit(command);
    return response.Group || null;
  }

  /**
   * Describe group membership
   */
  public async describeGroupMembership(
    groupName: string,
    memberName: string,
    namespace: string = 'default'
  ): Promise<any> {
    try {
      const command = new DescribeGroupMembershipCommand({
        AwsAccountId: this.awsAccountId,
        Namespace: namespace,
        GroupName: groupName,
        MemberName: memberName,
      });

      const response = await this.sendWithRateLimit(command);
      return response.GroupMember;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Describe a specific ingestion
   */
  public async describeIngestion(dataSetId: string, ingestionId: string): Promise<any> {
    const command = new DescribeIngestionCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
      IngestionId: ingestionId,
    });

    const response = await this.sendWithRateLimit(command);
    return response.Ingestion;
  }

  /**
   * Describe user
   */
  public async describeUser(userName: string, namespace: string = 'default'): Promise<any> {
    const command = new DescribeUserCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: namespace,
      UserName: userName,
    });

    const response = await this.sendWithRateLimit(command);
    return response.User || null;
  }

  /**
   * Get the AWS account ID
   */
  public getAwsAccountId(): string {
    return this.awsAccountId;
  }

  /**
   * List all analyses
   */
  public async listAnalyses(options?: ListOptions): Promise<ListResult<AnalysisSummary>> {
    const command = new ListAnalysesCommand({
      AwsAccountId: this.awsAccountId,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.AnalysisSummaryList || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * List all dashboards
   */
  public async listDashboards(options?: ListOptions): Promise<ListResult<DashboardSummary>> {
    const command = new ListDashboardsCommand({
      AwsAccountId: this.awsAccountId,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.DashboardSummaryList || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * List all datasets
   */
  public async listDatasets(options?: ListOptions): Promise<ListResult<DataSetSummary>> {
    const command = new ListDataSetsCommand({
      AwsAccountId: this.awsAccountId,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.DataSetSummaries || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * List all data sources
   * NOTE: This method uses AWS SDK v2 to work around a critical bug in v3
   * where empty DataSourceParameters cause deserialization errors.
   * See: https://github.com/aws/aws-sdk-js-v3/issues/3029
   */
  public async listDatasources(
    options?: ListOptions
  ): Promise<ListResult<DataSourceSummary | DataSource>> {
    // Use v2 implementation if available (for bug workaround)
    if (this.v2DataSourceLister) {
      return this.listDatasourcesV2(options);
    }

    // Fallback to v3 (will fail for some datasources)
    const command = new ListDataSourcesCommand({
      AwsAccountId: this.awsAccountId,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.DataSources || [],
      nextToken: response.NextToken,
    };
  }

  // =================== MAPPERS ===================
  // Convert AWS SDK types to plain objects

  /**
   * List folder members
   */
  public async listFolderMembers(
    folderId: string,
    options?: ListOptions
  ): Promise<ListResult<any>> {
    const command = new ListFolderMembersCommand({
      AwsAccountId: this.awsAccountId,
      FolderId: folderId,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.FolderMemberList || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * List all folders
   */
  public async listFolders(options?: ListOptions): Promise<ListResult<FolderSummary>> {
    const command = new ListFoldersCommand({
      AwsAccountId: this.awsAccountId,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.FolderSummaryList || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * List group memberships
   */
  public async listGroupMemberships(
    groupName: string,
    namespace: string = 'default',
    options?: ListOptions
  ): Promise<ListResult<GroupMember>> {
    const command = new ListGroupMembershipsCommand({
      AwsAccountId: this.awsAccountId,
      GroupName: groupName,
      Namespace: namespace,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.GroupMemberList || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * List all groups
   */
  public async listGroups(
    namespace: string = 'default',
    options?: ListOptions
  ): Promise<ListResult<Group>> {
    const command = new ListGroupsCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: namespace,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.GroupList || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * List ingestions for a dataset
   */
  public async listIngestions(
    dataSetId: string,
    maxResults: number = QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS
  ): Promise<any> {
    const command = new ListIngestionsCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
      MaxResults: maxResults,
    });

    const response = await this.sendWithRateLimit(command);
    return {
      ingestions: response.Ingestions || [],
      nextToken: response.NextToken,
    };
  }

  /**
   * List refresh schedules for a dataset
   */
  public async listRefreshSchedules(dataSetId: string): Promise<any[]> {
    const command = new ListRefreshSchedulesCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
    });

    const response = await this.sendWithRateLimit(command);
    return response.RefreshSchedules || [];
  }

  public async listTagsForResource(
    resourceArn: string
  ): Promise<Array<{ key: string; value: string }>> {
    const command = new ListTagsForResourceCommand({
      ResourceArn: resourceArn,
    });

    // Use main QuickSight rate limiter for tag operations
    const response = await withRetry(
      async () => {
        await quickSightRateLimiter.waitForToken();
        return await this.client.send(command);
      },
      'QuickSight.ListTagsForResource',
      {
        maxRetries: RETRY_CONFIG.EXTENDED_MAX_RETRIES,
        baseDelay: RETRY_CONFIG.EXTENDED_BASE_DELAY_MS,
        maxDelay: RETRY_CONFIG.EXTENDED_MAX_DELAY_MS,
      }
    );

    // Transform to our format
    return (response.Tags || []).map((tag: any) => {
      if (!tag.Key || !tag.Value) {
        throw new Error('Invalid tag structure');
      }
      return {
        key: tag.Key,
        value: tag.Value,
      };
    });
  }

  /**
   * List user groups
   */
  public async listUserGroups(
    userName: string,
    namespace: string = 'default',
    options?: ListOptions
  ): Promise<ListResult<Group>> {
    const command = new ListUserGroupsCommand({
      AwsAccountId: this.awsAccountId,
      UserName: userName,
      Namespace: namespace,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.GroupList || [],
      nextToken: response.NextToken,
    };
  }

  // =============================================================================
  // TAGGING OPERATIONS
  // =============================================================================

  /**
   * List all users
   */
  public async listUsers(
    namespace: string = 'default',
    options?: ListOptions
  ): Promise<ListResult<User>> {
    const command = new ListUsersCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: namespace,
      MaxResults: options?.maxResults,
      NextToken: options?.nextToken,
    });

    const response = await this.sendWithRateLimit(command);

    return {
      items: response.UserList || [],
      nextToken: response.NextToken,
    };
  }

  public async putDataSetRefreshProperties(
    dataSetId: string,
    refreshProperties: any
  ): Promise<any> {
    const command = new PutDataSetRefreshPropertiesCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
      DataSetRefreshProperties: refreshProperties,
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Status: response.Status,
      RequestId: response.RequestId,
    };
  }

  public async registerUser(params: {
    userName: string;
    email: string;
    identityType?: IdentityType;
    userRole?: UserRole;
    iamArn?: string;
    sessionName?: string;
    namespace?: string;
    customPermissionsName?: string;
    externalLoginFederationProviderType?: string;
    externalLoginId?: string;
  }): Promise<{ arn: string; userName: string; principalId: string; role: string }> {
    const command = new RegisterUserCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: params.namespace || 'default',
      UserName: params.userName,
      Email: params.email,
      IdentityType: params.identityType || 'QUICKSIGHT',
      UserRole: params.userRole || 'READER',
      IamArn: params.iamArn,
      SessionName: params.sessionName,
      CustomPermissionsName: params.customPermissionsName,
      ExternalLoginFederationProviderType: params.externalLoginFederationProviderType,
      ExternalLoginId: params.externalLoginId,
    });

    const response = await this.client.send(command);
    if (!response.User || !response.User.Arn || !response.User.UserName || !response.User.Role) {
      throw new Error('Invalid response from RegisterUser');
    }
    return {
      arn: response.User.Arn,
      userName: response.User.UserName,
      principalId: response.User.PrincipalId || '',
      role: response.User.Role,
    };
  }

  // =============================================================================
  // DELETE OPERATIONS
  // =============================================================================

  public async tagResource(
    resourceArn: string,
    tags: Array<{ key: string; value: string }>
  ): Promise<void> {
    const quickSightTags: Tag[] = tags.map((tag) => ({
      Key: tag.key,
      Value: tag.value,
    }));

    const command = new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: quickSightTags,
    });

    await this.sendWithRateLimit(command);
  }

  public async untagResource(resourceArn: string, tagKeys: string[]): Promise<void> {
    const command = new UntagResourceCommand({
      ResourceArn: resourceArn,
      TagKeys: tagKeys,
    });

    await this.sendWithRateLimit(command);
  }

  public async updateAnalysis(params: {
    analysisId: string;
    name: string;
    definition?: AnalysisDefinition;
    sourceEntity?: any;
    themeArn?: string;
  }): Promise<{ arn: string; analysisId: string; status: number }> {
    const command = new UpdateAnalysisCommand({
      AwsAccountId: this.awsAccountId,
      AnalysisId: params.analysisId,
      Name: params.name,
      Definition: params.definition,
      SourceEntity: params.sourceEntity,
      ThemeArn: params.themeArn,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.AnalysisId || !response.Status) {
      throw new Error('UpdateAnalysis response missing required fields');
    }
    return {
      arn: response.Arn,
      analysisId: response.AnalysisId,
      status: response.Status,
    };
  }

  public async updateAnalysisPermissions(
    analysisId: string,
    permissions: any[],
    revokations: any[]
  ): Promise<any> {
    const command = new UpdateAnalysisPermissionsCommand({
      AwsAccountId: this.awsAccountId,
      AnalysisId: analysisId,
      ...(permissions.length > 0 && { GrantPermissions: permissions }),
      ...(revokations.length > 0 && { RevokePermissions: revokations }),
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Status: response.Status,
      AnalysisId: response.AnalysisId,
      Permissions: response.Permissions,
      RequestId: response.RequestId,
    };
  }

  // =============================================================================
  // CREATE OPERATIONS
  // =============================================================================

  public async updateDashboard(params: {
    dashboardId: string;
    name: string;
    definition?: DashboardVersionDefinition;
    sourceEntity?: any;
    themeArn?: string;
    dashboardPublishOptions?: any;
  }): Promise<{ arn: string; dashboardId: string; status: number; versionArn?: string }> {
    const command = new UpdateDashboardCommand({
      AwsAccountId: this.awsAccountId,
      DashboardId: params.dashboardId,
      Name: params.name,
      Definition: params.definition,
      SourceEntity: params.sourceEntity,
      ThemeArn: params.themeArn,
      DashboardPublishOptions: params.dashboardPublishOptions,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.DashboardId || !response.Status) {
      throw new Error('UpdateDashboard response missing required fields');
    }
    return {
      arn: response.Arn,
      dashboardId: response.DashboardId,
      status: response.Status,
      versionArn: response.VersionArn,
    };
  }

  public async updateDashboardPermissions(
    dashboardId: string,
    permissions: ResourcePermission[],
    revokations: ResourcePermission[]
  ): Promise<unknown> {
    const command = new UpdateDashboardPermissionsCommand({
      AwsAccountId: this.awsAccountId,
      DashboardId: dashboardId,
      ...(permissions.length > 0 && { GrantPermissions: permissions }),
      ...(revokations.length > 0 && { RevokePermissions: revokations }),
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Status: response.Status,
      DashboardId: response.DashboardId,
      Permissions: response.Permissions,
      RequestId: response.RequestId,
    };
  }

  public async updateDataSet(params: {
    dataSetId: string;
    name: string;
    physicalTableMap: any;
    logicalTableMap?: any;
    importMode: 'SPICE' | 'DIRECT_QUERY';
    columnGroups?: any[];
    fieldFolders?: Record<string, any>;
    rowLevelPermissionDataSet?: any;
    rowLevelPermissionTagConfiguration?: any;
    columnLevelPermissionRules?: any[];
    dataSetUsageConfiguration?: any;
  }): Promise<{ arn: string; dataSetId: string; ingestionArn?: string }> {
    const command = new UpdateDataSetCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: params.dataSetId,
      Name: params.name,
      PhysicalTableMap: params.physicalTableMap,
      LogicalTableMap: params.logicalTableMap,
      ImportMode: params.importMode,
      ColumnGroups: params.columnGroups,
      FieldFolders: params.fieldFolders,
      RowLevelPermissionDataSet: params.rowLevelPermissionDataSet,
      RowLevelPermissionTagConfiguration: params.rowLevelPermissionTagConfiguration,
      ColumnLevelPermissionRules: params.columnLevelPermissionRules,
      DataSetUsageConfiguration: params.dataSetUsageConfiguration,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.DataSetId) {
      throw new Error('UpdateDataSet response missing required fields');
    }
    return {
      arn: response.Arn,
      dataSetId: response.DataSetId,
      ingestionArn: response.IngestionArn,
    };
  }

  public async updateDataSetPermissions(
    dataSetId: string,
    permissions: any[],
    revokations: any[]
  ): Promise<any> {
    const command = new UpdateDataSetPermissionsCommand({
      AwsAccountId: this.awsAccountId,
      DataSetId: dataSetId,
      ...(permissions.length > 0 && { GrantPermissions: permissions }),
      ...(revokations.length > 0 && { RevokePermissions: revokations }),
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Status: response.Status,
      DataSetId: response.DataSetId,
      Permissions: response.Permissions,
      RequestId: response.RequestId,
    };
  }

  public async updateDataSource(params: {
    dataSourceId: string;
    name: string;
    dataSourceParameters?: DataSourceParameters;
    credentials?: DataSourceCredentials;
    vpcConnectionProperties?: any;
    sslProperties?: any;
  }): Promise<{ arn: string; dataSourceId: string; updateStatus: string }> {
    const command = new UpdateDataSourceCommand({
      AwsAccountId: this.awsAccountId,
      DataSourceId: params.dataSourceId,
      Name: params.name,
      DataSourceParameters: params.dataSourceParameters,
      Credentials: params.credentials,
      VpcConnectionProperties: params.vpcConnectionProperties,
      SslProperties: params.sslProperties,
    });

    const response = await this.client.send(command);
    if (!response.Arn || !response.DataSourceId || !response.UpdateStatus) {
      throw new Error('UpdateDataSource response missing required fields');
    }
    return {
      arn: response.Arn,
      dataSourceId: response.DataSourceId,
      updateStatus: response.UpdateStatus,
    };
  }

  public async updateDataSourcePermissions(
    dataSourceId: string,
    permissions: any[],
    revokations: any[]
  ): Promise<any> {
    const command = new UpdateDataSourcePermissionsCommand({
      AwsAccountId: this.awsAccountId,
      DataSourceId: dataSourceId,
      ...(permissions.length > 0 && { GrantPermissions: permissions }),
      ...(revokations.length > 0 && { RevokePermissions: revokations }),
    });

    const response = await this.sendWithRateLimit(command);
    return {
      Status: response.Status,
      DataSourceId: response.DataSourceId,
      Permissions: response.Permissions,
      RequestId: response.RequestId,
    };
  }

  public async updateFolder(params: {
    folderId: string;
    name: string;
  }): Promise<{ arn: string; folderId: string; status: number }> {
    const command = new UpdateFolderCommand({
      AwsAccountId: this.awsAccountId,
      FolderId: params.folderId,
      Name: params.name,
    });

    const response = await this.client.send(command);
    return {
      arn: response.Arn || '',
      folderId: response.FolderId || '',
      status: response.Status || STATUS_CODES.INTERNAL_SERVER_ERROR,
    };
  }

  /**
   * Update folder permissions
   */
  public async updateFolderPermissions(
    folderId: string,
    grantPermissions: Array<{ Principal: string; Actions: string[] }>,
    revokePermissions: Array<{ Principal: string; Actions: string[] }>
  ): Promise<any> {
    const command = new UpdateFolderPermissionsCommand({
      AwsAccountId: this.awsAccountId,
      FolderId: folderId,
      ...(grantPermissions.length > 0 && { GrantPermissions: grantPermissions }),
      ...(revokePermissions.length > 0 && { RevokePermissions: revokePermissions }),
    });

    const response = await this.sendWithRateLimit(command);
    // Return only the relevant data
    return {
      Status: response.Status,
      FolderId: response.FolderId,
      Arn: response.Arn,
      Permissions: response.Permissions,
      RequestId: response.RequestId,
    };
  }

  // =============================================================================
  // UPDATE OPERATIONS
  // =============================================================================

  public async updateGroup(params: {
    groupName: string;
    description?: string;
    namespace?: string;
  }): Promise<{ arn: string; groupName: string; principalId: string }> {
    const command = new UpdateGroupCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: params.namespace || 'default',
      GroupName: params.groupName,
      Description: params.description,
    });

    const response = await this.client.send(command);
    if (!response.Group || !response.Group.Arn || !response.Group.GroupName) {
      throw new Error('Invalid response from UpdateGroup');
    }
    return {
      arn: response.Group.Arn,
      groupName: response.Group.GroupName,
      principalId: response.Group.PrincipalId || '',
    };
  }

  public async updateUser(params: {
    userName: string;
    email: string;
    role?: UserRole;
    customPermissionsName?: string;
    unapplyCustomPermissions?: boolean;
    namespace?: string;
    externalLoginFederationProviderType?: string;
    externalLoginId?: string;
  }): Promise<{ arn: string; userName: string; principalId: string; role: string }> {
    const command = new UpdateUserCommand({
      AwsAccountId: this.awsAccountId,
      Namespace: params.namespace || 'default',
      UserName: params.userName,
      Email: params.email,
      Role: params.role,
      CustomPermissionsName: params.customPermissionsName,
      UnapplyCustomPermissions: params.unapplyCustomPermissions,
      ExternalLoginFederationProviderType: params.externalLoginFederationProviderType,
      ExternalLoginId: params.externalLoginId,
    });

    const response = await this.client.send(command);
    if (!response.User || !response.User.Arn || !response.User.UserName || !response.User.Role) {
      throw new Error('Invalid response from UpdateUser');
    }
    return {
      arn: response.User.Arn,
      userName: response.User.UserName,
      principalId: response.User.PrincipalId || '',
      role: response.User.Role,
    };
  }

  /**
   * Bridge AWS SDK v3 credentials to v2 client
   */
  private async bridgeV3CredentialsToV2(): Promise<void> {
    try {
      const v3Provider = fromNodeProviderChain();
      const v3Creds = await v3Provider();

      const v2Credentials = new aws.Credentials({
        accessKeyId: v3Creds.accessKeyId,
        secretAccessKey: v3Creds.secretAccessKey,
        sessionToken: v3Creds.sessionToken,
      });

      if (v3Creds.expiration) {
        v2Credentials.expireTime = v3Creds.expiration;
      }

      if (!this.v2DataSourceLister) {
        throw new Error('v2DataSourceLister is not initialized');
      }
      this.v2DataSourceLister.config.update({ credentials: v2Credentials });
    } catch (error) {
      logger.error('Failed to bridge v3 credentials to v2', error);
      // Don't throw - we'll fall back to v3 SDK
    }
  }

  /**
   * Initialize AWS SDK v2 client for datasource listing
   * This is a workaround for SDK v3 bug with empty unions
   */
  private initializeV2Client(): void {
    const region = this.client.config.region || process.env.AWS_REGION || 'us-east-1';
    this.v2DataSourceLister = new aws.QuickSight({
      region: typeof region === 'function' ? 'us-east-1' : region,
    });

    // Initialize v3 credentials for v2 client
    this.v2CredentialsInitialized = this.bridgeV3CredentialsToV2();
  }

  /**
   * List datasources using AWS SDK v2 (workaround for v3 bug)
   */
  private async listDatasourcesV2(options?: ListOptions): Promise<ListResult<DataSource>> {
    if (!this.v2DataSourceLister || !this.v2CredentialsInitialized) {
      throw new Error('V2 client not initialized for datasource listing');
    }

    // Ensure credentials are ready
    await this.v2CredentialsInitialized;

    const nextToken = options?.nextToken;
    const maxResults = options?.maxResults || QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS;

    try {
      const params: aws.QuickSight.ListDataSourcesRequest = {
        AwsAccountId: this.awsAccountId,
        MaxResults: maxResults,
        ...(nextToken && { NextToken: nextToken }),
      };

      const response = await this.v2DataSourceLister.listDataSources(params).promise();

      // Convert v2 response to v3 format (both use PascalCase)
      // Note: v2 SDK returns Type as string, v3 expects DataSourceType enum
      return {
        items: (response.DataSources || []) as DataSource[],
        nextToken: response.NextToken,
      };
    } catch (error) {
      logger.error('SDK v2: Failed to list data sources', error);
      throw error;
    }
  }

  private async sendWithPermissionsRateLimit<T = any>(command: any): Promise<T> {
    return await withRetry<T>(
      async () => {
        await quickSightPermissionsRateLimiter.waitForToken();
        return (await this.client.send(command)) as T;
      },
      `QuickSight.${command.constructor.name}`,
      {
        maxRetries: RETRY_CONFIG.EXTENDED_MAX_RETRIES,
        baseDelay: RETRY_CONFIG.EXTENDED_BASE_DELAY_MS,
        maxDelay: RETRY_CONFIG.EXTENDED_MAX_DELAY_MS,
      }
    );
  }

  // =============================================================================
  // FOLDER MEMBERSHIP OPERATIONS
  // =============================================================================

  /**
   * Rate-limited send method for all QuickSight API calls
   */
  private async sendWithRateLimit<T = any>(command: any): Promise<T> {
    return await withRetry<T>(
      async () => {
        await quickSightRateLimiter.waitForToken();
        return (await this.client.send(command)) as T;
      },
      `QuickSight.${command.constructor.name}`,
      {
        maxRetries: RETRY_CONFIG.EXTENDED_MAX_RETRIES,
        baseDelay: RETRY_CONFIG.EXTENDED_BASE_DELAY_MS,
        maxDelay: RETRY_CONFIG.EXTENDED_MAX_DELAY_MS,
      }
    );
  }
}
