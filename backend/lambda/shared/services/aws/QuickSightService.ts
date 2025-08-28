import { QuickSightAdapter, type ListResult } from '../../../adapters/aws/QuickSightAdapter';
import { createQuickSightClient } from '../../config/awsClients';
import * as mappers from '../../mappers/quicksight.mapper';
import { type OperationTracker } from '../../models/operations.model';
import type {
  DashboardSummary,
  DatasetSummary,
  AnalysisSummary,
  DatasourceSummary,
  FolderSummary,
  User,
  Group,
} from '../../models/quicksight-domain.model';
import { type AssetType, ASSET_TYPES } from '../../types/assetTypes';
import type {
  AnalysisDefinition,
  DashboardVersionDefinition,
  ResourcePermission,
  DashboardPublishOptions,
  AnalysisSourceEntity,
  DashboardSourceEntity,
  DataSourceParameters,
  DataSourceCredentials,
  VpcConnectionProperties,
  SslProperties,
  PhysicalTableMap,
  LogicalTableMap,
  FieldFolders,
  DataSetImportMode,
  ColumnGroup,
  RowLevelPermissionDataSet,
  RowLevelPermissionTagConfiguration,
  ColumnLevelPermissionRule,
  DataSetUsageConfiguration,
  DatasetParameter,
  FolderType,
} from '../../types/aws-sdk-types';
import { withRetry } from '../../utils/awsRetry';
import { logger } from '../../utils/logger';

// Service-specific constants
const QS_CONSTANTS = {
  DEFAULT_BATCH_SIZE: 10,
  RETRY_COUNT: 3,
  SMALL_BATCH: 5,
  MAX_RETRIES: 5,
  TIME_CONSTANTS: {
    SECONDS_PER_MINUTE: 60,
    MONTH_DAYS: 30,
  },
  CALCULATION_CONSTANTS: {
    MONTHS_PER_QUARTER: 3,
    HOURS_PER_DAY: 24,
    DAYS_PER_WEEK: 7,
    WEEKS_PER_MONTH: 4,
    BASE_CALCULATION: 36,
    MULTIPLIER: 9,
  },
  DEFAULTS: {
    MAX_ITEMS: 999,
    NEGATIVE_OFFSET: -1000,
    OCTETS: 8,
  },
} as const;

/**
 * QuickSight API operation metadata for tracking and logging
 */
interface ApiOperation {
  operation: string;
  assetType: string;
  assetId?: string;
  assetName?: string;
}

/**
 * Asset permission structure
 */
export interface AssetPermission {
  principal: string;
  principalType: 'USER' | 'GROUP';
  actions: string[];
}

/**
 * Centralized QuickSight service that provides business logic, retry handling, and tracking
 * Uses QuickSightAdapter for all AWS SDK interactions
 */
export class QuickSightService {
  // Progress logging interval for large datasets
  private static readonly LISTING_PROGRESS_INTERVAL = 10;
  // Maximum percentage of invalid items before failing the export
  private static readonly MAX_INVALID_ITEM_RATIO = 0.5;
  private readonly adapter: QuickSightAdapter;

  private operationTracker?: OperationTracker;

  constructor(awsAccountId: string, operationTracker?: OperationTracker) {
    const client = createQuickSightClient();
    this.adapter = new QuickSightAdapter(client, awsAccountId);
    this.operationTracker = operationTracker;
  }

  /**
   * Cancel an ingestion
   */
  public async cancelIngestion(
    dataSetId: string,
    ingestionId: string,
    dataSetName?: string
  ): Promise<void> {
    return await this.executeWithTracking(
      () => this.adapter.cancelIngestion(dataSetId, ingestionId),
      {
        operation: 'CancelIngestion',
        assetType: ASSET_TYPES.dataset,
        assetId: dataSetId,
        assetName: dataSetName,
      },
      'other'
    );
  }

  /**
   * Convert domain model summaries back to SDK format for exports
   * This preserves the original AWS API response format
   */
  public convertToSDKFormat(assetType: string, domainSummary: any): any {
    switch (assetType) {
      case ASSET_TYPES.dashboard:
        return mappers.mapDomainDashboardSummaryToSDK(domainSummary as DashboardSummary);
      case ASSET_TYPES.analysis:
        return mappers.mapDomainAnalysisSummaryToSDK(domainSummary as AnalysisSummary);
      case ASSET_TYPES.dataset:
        return mappers.mapDomainDatasetSummaryToSDK(domainSummary as DatasetSummary);
      case ASSET_TYPES.datasource:
        return mappers.mapDomainDatasourceSummaryToSDK(domainSummary as DatasourceSummary);
      case 'folder':
        return mappers.mapDomainFolderSummaryToSDK(domainSummary as FolderSummary);
      case 'user':
        return mappers.mapDomainUserToSDK(domainSummary as User);
      case 'group':
        return mappers.mapDomainGroupToSDK(domainSummary as Group);
      default:
        logger.warn(`No SDK converter for asset type: ${assetType}`);
        return domainSummary; // Return as-is if no converter
    }
  }

  // =============================================================================
  // LISTING OPERATIONS
  // =============================================================================

  public async createAnalysis(params: {
    analysisId: string;
    name: string;
    definition?: AnalysisDefinition;
    permissions?: ResourcePermission[];
    tags?: Array<{ key: string; value: string }>;
    sourceEntity?: AnalysisSourceEntity;
    themeArn?: string;
  }): Promise<{ arn: string; analysisId: string; creationStatus: string }> {
    return await this.executeWithTracking(
      () =>
        this.adapter.createAnalysis({
          ...params,
          tags: params.tags?.map((t) => ({ Key: t.key, Value: t.value })),
        }),
      { operation: 'CreateAnalysis', assetType: ASSET_TYPES.analysis, assetId: params.analysisId },
      'other'
    );
  }

  public async createDashboard(params: {
    dashboardId: string;
    name: string;
    definition?: DashboardVersionDefinition;
    permissions?: ResourcePermission[];
    tags?: Array<{ key: string; value: string }>;
    sourceEntity?: DashboardSourceEntity;
    themeArn?: string;
    dashboardPublishOptions?: DashboardPublishOptions;
  }): Promise<{ arn: string; dashboardId: string; creationStatus: string; versionArn?: string }> {
    return await this.executeWithTracking(
      () =>
        this.adapter.createDashboard({
          ...params,
          tags: params.tags?.map((t) => ({ Key: t.key, Value: t.value })),
        }),
      {
        operation: 'CreateDashboard',
        assetType: ASSET_TYPES.dashboard,
        assetId: params.dashboardId,
      },
      'other'
    );
  }

  public async createDataSet(params: {
    dataSetId: string;
    name: string;
    physicalTableMap: PhysicalTableMap;
    logicalTableMap?: LogicalTableMap;
    importMode: DataSetImportMode;
    permissions?: ResourcePermission[];
    tags?: Array<{ key: string; value: string }>;
    columnGroups?: ColumnGroup[];
    fieldFolders?: FieldFolders;
    rowLevelPermissionDataSet?: RowLevelPermissionDataSet;
    rowLevelPermissionTagConfiguration?: RowLevelPermissionTagConfiguration;
    columnLevelPermissionRules?: ColumnLevelPermissionRule[];
    dataSetUsageConfiguration?: DataSetUsageConfiguration;
    datasetParameters?: DatasetParameter[];
  }): Promise<{ arn: string; dataSetId: string; ingestionArn?: string }> {
    return await this.executeWithTracking(
      () =>
        this.adapter.createDataSet({
          ...params,
          tags: params.tags?.map((t) => ({ Key: t.key, Value: t.value })),
        }),
      { operation: 'CreateDataSet', assetType: ASSET_TYPES.dataset, assetId: params.dataSetId },
      'other'
    );
  }

  public async createDataSource(params: {
    dataSourceId: string;
    name: string;
    type: string;
    dataSourceParameters?: DataSourceParameters;
    credentials?: DataSourceCredentials;
    permissions?: ResourcePermission[];
    tags?: Array<{ key: string; value: string }>;
    vpcConnectionProperties?: VpcConnectionProperties;
    sslProperties?: SslProperties;
  }): Promise<{ arn: string; dataSourceId: string; creationStatus: string }> {
    return await this.executeWithTracking(
      () =>
        this.adapter.createDataSource({
          ...params,
          tags: params.tags?.map((t) => ({ Key: t.key, Value: t.value })),
        }),
      {
        operation: 'CreateDataSource',
        assetType: ASSET_TYPES.datasource,
        assetId: params.dataSourceId,
      },
      'other'
    );
  }

  public async createFolder(params: {
    folderId: string;
    name: string;
    folderType?: FolderType;
    parentFolderArn?: string;
    permissions?: ResourcePermission[];
    tags?: Array<{ key: string; value: string }>;
  }): Promise<{ arn: string; folderId: string; requestId?: string }> {
    return await this.executeWithTracking(
      () =>
        this.adapter.createFolder({
          ...params,
          tags: params.tags?.map((t) => ({ Key: t.key, Value: t.value })),
        }),
      { operation: 'CreateFolder', assetType: ASSET_TYPES.folder, assetId: params.folderId },
      'other'
    );
  }

  public async createFolderMembership(
    folderId: string,
    memberId: string,
    memberType: string
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.createFolderMembership(folderId, memberId, memberType),
      { operation: 'CreateFolderMembership', assetType: ASSET_TYPES.folder, assetId: folderId },
      'other'
    );
  }

  public async createGroup(params: {
    groupName: string;
    description?: string;
    namespace?: string;
  }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.createGroup(params),
      { operation: 'CreateGroup', assetType: ASSET_TYPES.group, assetId: params.groupName },
      'other'
    );
  }

  public async createGroupMembership(
    groupName: string,
    memberName: string,
    namespace: string = 'default'
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.createGroupMembership(groupName, memberName, namespace),
      { operation: 'CreateGroupMembership', assetType: ASSET_TYPES.group },
      'other'
    );
  }

  public async createRefreshSchedule(dataSetId: string, schedule: any): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.createRefreshSchedule(dataSetId, schedule),
      { operation: 'CreateRefreshSchedule', assetType: ASSET_TYPES.dataset, assetId: dataSetId },
      'other'
    );
  }

  public async deleteAnalysis(analysisId: string): Promise<void> {
    await this.executeWithTracking(
      () => this.adapter.deleteAnalysis(analysisId),
      { operation: 'DeleteAnalysis', assetType: ASSET_TYPES.analysis },
      'other'
    );
  }

  public async deleteDashboard(dashboardId: string): Promise<void> {
    await this.executeWithTracking(
      () => this.adapter.deleteDashboard(dashboardId),
      { operation: 'DeleteDashboard', assetType: ASSET_TYPES.dashboard },
      'other'
    );
  }

  public async deleteDataset(datasetId: string): Promise<void> {
    await this.executeWithTracking(
      () => this.adapter.deleteDataset(datasetId),
      { operation: 'DeleteDataSet', assetType: ASSET_TYPES.dataset },
      'other'
    );
  }

  public async deleteDatasource(datasourceId: string): Promise<void> {
    await this.executeWithTracking(
      () => this.adapter.deleteDatasource(datasourceId),
      { operation: 'DeleteDataSource', assetType: ASSET_TYPES.datasource },
      'other'
    );
  }

  public async deleteFolderMembership(
    folderId: string,
    memberId: string,
    memberType: string
  ): Promise<void> {
    return await this.executeWithTracking(
      () => this.adapter.deleteFolderMembership(folderId, memberId, memberType),
      { operation: 'DeleteFolderMembership', assetType: ASSET_TYPES.folder, assetId: folderId },
      'other'
    );
  }

  public async deleteGroup(groupName: string, namespace: string = 'default'): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.deleteGroup(groupName, namespace),
      { operation: 'DeleteGroup', assetType: ASSET_TYPES.group, assetId: groupName },
      'other'
    );
  }

  public async deleteGroupMembership(
    groupName: string,
    memberName: string,
    namespace: string = 'default'
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.deleteGroupMembership(groupName, memberName, namespace),
      { operation: 'DeleteGroupMembership', assetType: ASSET_TYPES.group },
      'other'
    );
  }

  // =============================================================================
  // DESCRIBE OPERATIONS
  // =============================================================================

  public async describeAnalysis(analysisId: string, analysisName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeAnalysis(analysisId),
      {
        operation: 'DescribeAnalysis',
        assetType: ASSET_TYPES.analysis,
        assetId: analysisId,
        assetName: analysisName,
      },
      'describe'
    );
  }

  public async describeAnalysisDefinition(analysisId: string, analysisName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeAnalysisDefinition(analysisId),
      {
        operation: 'DescribeAnalysisDefinition',
        assetType: ASSET_TYPES.analysis,
        assetId: analysisId,
        assetName: analysisName,
      },
      'definition'
    );
  }

  public async describeAnalysisPermissions(
    analysisId: string,
    analysisName?: string
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeAnalysisPermissions(analysisId),
      {
        operation: 'DescribeAnalysisPermissions',
        assetType: ASSET_TYPES.analysis,
        assetId: analysisId,
        assetName: analysisName,
      },
      'permissions'
    );
  }

  public async describeDashboard(dashboardId: string, dashboardName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeDashboard(dashboardId),
      {
        operation: 'DescribeDashboard',
        assetType: ASSET_TYPES.dashboard,
        assetId: dashboardId,
        assetName: dashboardName,
      },
      'describe'
    );
  }

  public async describeDashboardDefinition(
    dashboardId: string,
    dashboardName?: string,
    versionNumber?: number
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeDashboardDefinition(dashboardId, versionNumber),
      {
        operation: 'DescribeDashboardDefinition',
        assetType: ASSET_TYPES.dashboard,
        assetId: dashboardId,
        assetName: dashboardName,
      },
      'definition'
    );
  }

  public async describeDashboardPermissions(
    dashboardId: string,
    dashboardName?: string
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeDashboardPermissions(dashboardId),
      {
        operation: 'DescribeDashboardPermissions',
        assetType: ASSET_TYPES.dashboard,
        assetId: dashboardId,
        assetName: dashboardName,
      },
      'permissions'
    );
  }

  public async describeDataset(dataSetId: string, dataSetName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeDataset(dataSetId),
      {
        operation: 'DescribeDataSet',
        assetType: ASSET_TYPES.dataset,
        assetId: dataSetId,
        assetName: dataSetName,
      },
      'describe'
    );
  }

  public async describeDatasetPermissions(dataSetId: string, dataSetName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeDatasetPermissions(dataSetId),
      {
        operation: 'DescribeDataSetPermissions',
        assetType: ASSET_TYPES.dataset,
        assetId: dataSetId,
        assetName: dataSetName,
      },
      'permissions'
    );
  }

  public async describeDatasetRefreshProperties(
    dataSetId: string,
    dataSetName?: string
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeDatasetRefreshProperties(dataSetId),
      {
        operation: 'DescribeDataSetRefreshProperties',
        assetType: ASSET_TYPES.dataset,
        assetId: dataSetId,
        assetName: dataSetName,
      },
      'describe'
    );
  }

  public async describeDatasource(dataSourceId: string, dataSourceName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeDatasource(dataSourceId),
      {
        operation: 'DescribeDataSource',
        assetType: ASSET_TYPES.datasource,
        assetId: dataSourceId,
        assetName: dataSourceName,
      },
      'describe'
    );
  }

  // =============================================================================
  // PERMISSIONS OPERATIONS
  // =============================================================================

  public async describeDatasourcePermissions(
    dataSourceId: string,
    dataSourceName?: string
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeDatasourcePermissions(dataSourceId),
      {
        operation: 'DescribeDataSourcePermissions',
        assetType: ASSET_TYPES.datasource,
        assetId: dataSourceId,
        assetName: dataSourceName,
      },
      'permissions'
    );
  }

  public async describeFolder(folderId: string, folderName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeFolder(folderId),
      {
        operation: 'DescribeFolder',
        assetType: ASSET_TYPES.folder,
        assetId: folderId,
        assetName: folderName,
      },
      'describe'
    );
  }

  public async describeFolderPermissions(folderId: string, folderName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeFolderPermissions(folderId),
      {
        operation: 'DescribeFolderPermissions',
        assetType: ASSET_TYPES.folder,
        assetId: folderId,
        assetName: folderName,
      },
      'permissions'
    );
  }

  public async describeGroup(groupName: string, namespace: string = 'default'): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeGroup(groupName, namespace),
      { operation: 'DescribeGroup', assetType: ASSET_TYPES.group, assetId: groupName },
      'describe'
    );
  }

  public async describeGroupMembership(
    groupName: string,
    memberName: string,
    namespace: string = 'default'
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeGroupMembership(groupName, memberName, namespace),
      { operation: 'DescribeGroupMembership', assetType: ASSET_TYPES.group },
      'describe'
    );
  }

  /**
   * Describe a specific ingestion
   */
  public async describeIngestion(
    dataSetId: string,
    ingestionId: string,
    dataSetName?: string
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeIngestion(dataSetId, ingestionId),
      {
        operation: 'DescribeIngestion',
        assetType: ASSET_TYPES.dataset,
        assetId: dataSetId,
        assetName: dataSetName,
      },
      'describe'
    );
  }

  public async describeUser(userName: string, namespace: string = 'default'): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.describeUser(userName, namespace),
      { operation: 'DescribeUser', assetType: ASSET_TYPES.user, assetId: userName },
      'describe'
    );
  }

  /**
   * Get all items from a paginated list operation with automatic pagination
   */
  public async getAllDashboards(): Promise<any[]> {
    const allItems: any[] = [];
    let nextToken: string | undefined;

    do {
      const result = await this.executeWithTracking(
        () => this.adapter.listDashboards({ nextToken, maxResults: 100 }),
        { operation: 'ListDashboards', assetType: ASSET_TYPES.dashboard },
        'list'
      );
      allItems.push(...result.items);
      nextToken = result.nextToken;
    } while (nextToken);

    return allItems;
  }

  public async getAllDatasets(): Promise<any[]> {
    const allItems: any[] = [];
    let nextToken: string | undefined;

    do {
      const result = await this.executeWithTracking(
        () => this.adapter.listDatasets({ nextToken, maxResults: 100 }),
        { operation: 'ListDataSets', assetType: ASSET_TYPES.dataset },
        'list'
      );
      allItems.push(...result.items);
      nextToken = result.nextToken;
    } while (nextToken);

    return allItems;
  }

  public async getAllFolderMembers(folderId: string): Promise<any[]> {
    const allItems: any[] = [];
    let nextToken: string | undefined;

    do {
      const result = await this.executeWithTracking(
        () => this.adapter.listFolderMembers(folderId, { nextToken, maxResults: 100 }),
        { operation: 'ListFolderMembers', assetType: ASSET_TYPES.folder, assetId: folderId },
        'list'
      );
      allItems.push(...result.items);
      nextToken = result.nextToken;
    } while (nextToken);

    return allItems;
  }

  public async getAllFolders(): Promise<any[]> {
    const allItems: any[] = [];
    let nextToken: string | undefined;

    do {
      const result = await this.executeWithTracking(
        () => this.adapter.listFolders({ nextToken, maxResults: 100 }),
        { operation: 'ListFolders', assetType: ASSET_TYPES.folder },
        'list'
      );
      allItems.push(...result.items);
      nextToken = result.nextToken;
    } while (nextToken);

    return allItems;
  }

  // =============================================================================
  // USER AND GROUP OPERATIONS
  // =============================================================================

  public async getAllGroupMembers(
    groupName: string,
    namespace: string = 'default'
  ): Promise<any[]> {
    const allMembers: any[] = [];
    let nextToken: string | undefined;

    do {
      const result = await this.executeWithTracking(
        () =>
          this.adapter.listGroupMemberships(groupName, namespace, { nextToken, maxResults: 100 }),
        { operation: 'ListGroupMemberships', assetType: ASSET_TYPES.group },
        'list'
      );
      allMembers.push(...result.items);
      nextToken = result.nextToken;
    } while (nextToken);

    return allMembers;
  }

  public async getAnalysisPermissions(analysisId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.describeAnalysisPermissions(analysisId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching analysis permissions for ${analysisId}:`, error);
      return [];
    }
  }

  // Formatted permission methods that return transformed data
  public async getDashboardPermissions(dashboardId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.describeDashboardPermissions(dashboardId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching dashboard permissions for ${dashboardId}:`, error);
      return [];
    }
  }

  public async getDataSetPermissions(dataSetId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.describeDatasetPermissions(dataSetId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching dataset permissions for ${dataSetId}:`, error);
      return [];
    }
  }

  public async getDataSourcePermissions(dataSourceId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.describeDatasourcePermissions(dataSourceId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching datasource permissions for ${dataSourceId}:`, error);
      return [];
    }
  }

  public async getFolderPermissions(folderId: string): Promise<AssetPermission[]> {
    try {
      const response = await this.describeFolderPermissions(folderId);
      return this.transformPermissions(response.Permissions || []);
    } catch (error) {
      logger.error(`Error fetching folder permissions for ${folderId}:`, error);
      return [];
    }
  }

  // =============================================================================
  // DELETE OPERATIONS
  // =============================================================================

  public async getResourceTags(
    resourceType: AssetType,
    resourceId: string,
    awsRegion: string = 'us-east-1'
  ): Promise<Array<{ key: string; value: string }>> {
    const resourceArn = this.buildResourceArn(
      resourceType,
      resourceId,
      this.adapter.getAwsAccountId(),
      awsRegion
    );

    return await this.executeWithTracking(
      () => this.adapter.listTagsForResource(resourceArn),
      { operation: 'ListTagsForResource', assetType: resourceType, assetId: resourceId },
      'tags'
    );
  }

  /**
   * List all assets of a specific type with automatic pagination
   * This consolidates the logic from AssetListingService
   * Simplified version - no concurrency for listing, let processing handle that
   */
  public async listAllAssetsOfType(
    assetType: string
  ): Promise<{ assets: any[]; apiCalls: number }> {
    const pageSize = 100; // Max page size for QuickSight

    logger.debug(`Starting to list all ${assetType}`);

    try {
      const allAssets: any[] = [];
      let pageCount = 0;
      let nextToken: string | undefined;

      // Get the appropriate list method for this asset type
      const listMethod = this.getListMethodForAssetType(assetType);
      if (!listMethod) {
        throw new Error(`Unsupported asset type for listing: ${assetType}`);
      }

      // Simple sequential pagination - no need for concurrency here
      // The actual asset processing will handle concurrency
      do {
        const page = await listMethod.call(this, nextToken, pageSize);
        allAssets.push(...page.items);
        nextToken = page.nextToken;
        pageCount++;

        // Log progress for large datasets
        if (pageCount % QuickSightService.LISTING_PROGRESS_INTERVAL === 0) {
          logger.info(
            `Still listing ${assetType}... ${allAssets.length} items so far (${pageCount} pages)`
          );
        }
      } while (nextToken);

      logger.debug(
        `Successfully listed ${allAssets.length} ${assetType} across ${pageCount} pages`
      );

      return { assets: allAssets, apiCalls: pageCount };
    } catch (error) {
      logger.error(`Failed to list ${assetType}`, { error });
      throw error;
    }
  }

  public async listAnalyses(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<AnalysisSummary[]> {
    const result = await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listAnalyses({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKAnalysisSummaryToDomain,
          (item) => item?.AnalysisId,
          'analysis'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListAnalyses', assetType: ASSET_TYPES.analysis },
      'list'
    );
    return result.items;
  }

  public async listAnalysesPaginated(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<ListResult<AnalysisSummary>> {
    return await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listAnalyses({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKAnalysisSummaryToDomain,
          (item) => item?.AnalysisId,
          'analysis'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListAnalyses', assetType: ASSET_TYPES.analysis },
      'list'
    );
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  public async listDashboards(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<DashboardSummary[]> {
    const result = await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listDashboards({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKDashboardSummaryToDomain,
          (item) => item?.DashboardId,
          'dashboard'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListDashboards', assetType: ASSET_TYPES.dashboard },
      'list'
    );
    // Return just the items for backward compatibility
    return result.items;
  }

  public async listDashboardsPaginated(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<ListResult<DashboardSummary>> {
    return await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listDashboards({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKDashboardSummaryToDomain,
          (item) => item?.DashboardId,
          'dashboard'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListDashboards', assetType: ASSET_TYPES.dashboard },
      'list'
    );
  }

  public async listDatasets(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<DatasetSummary[]> {
    const result = await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listDatasets({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKDataSetSummaryToDomain,
          (item) => item?.DataSetId,
          'dataset'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListDataSets', assetType: ASSET_TYPES.dataset },
      'list'
    );
    return result.items;
  }

  public async listDatasetsPaginated(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<ListResult<DatasetSummary>> {
    return await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listDatasets({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKDataSetSummaryToDomain,
          (item) => item?.DataSetId,
          'dataset'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListDataSets', assetType: ASSET_TYPES.dataset },
      'list'
    );
  }

  public async listDatasources(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<DatasourceSummary[]> {
    const result = await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listDatasources({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKDataSourceSummaryToDomain,
          (item) => item?.DataSourceId,
          'datasource'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListDataSources', assetType: ASSET_TYPES.datasource },
      'list'
    );
    return result.items;
  }

  public async listDatasourcesPaginated(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<ListResult<DatasourceSummary>> {
    return await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listDatasources({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKDataSourceSummaryToDomain,
          (item) => item?.DataSourceId,
          'datasource'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListDataSources', assetType: ASSET_TYPES.datasource },
      'list'
    );
  }

  public async listFolderMembers(
    folderId: string,
    nextToken?: string,
    maxResults: number = 100
  ): Promise<any> {
    const result = await this.executeWithTracking(
      () => this.adapter.listFolderMembers(folderId, { nextToken, maxResults }),
      { operation: 'ListFolderMembers', assetType: ASSET_TYPES.folder },
      'list'
    );
    return result.items;
  }

  // =============================================================================
  // TAGGING OPERATIONS
  // =============================================================================

  public async listFolders(nextToken?: string, maxResults: number = 100): Promise<FolderSummary[]> {
    const result = await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listFolders({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKFolderSummaryToDomain,
          (item) => item?.FolderId,
          'folder'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListFolders', assetType: ASSET_TYPES.folder },
      'list'
    );
    return result.items;
  }

  public async listFoldersPaginated(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<ListResult<FolderSummary>> {
    return await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listFolders({ nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKFolderSummaryToDomain,
          (item) => item?.FolderId,
          'folder'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListFolders', assetType: ASSET_TYPES.folder },
      'list'
    );
  }

  public async listGroupMemberships(
    groupName: string,
    namespace: string = 'default'
  ): Promise<any[]> {
    const result = await this.executeWithTracking(
      () => this.adapter.listGroupMemberships(groupName, namespace),
      { operation: 'ListGroupMemberships', assetType: ASSET_TYPES.group },
      'list'
    );
    return result.items;
  }

  public async listGroups(
    namespace: string = 'default',
    nextToken?: string,
    maxResults: number = 100
  ): Promise<Group[]> {
    const result = await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listGroups(namespace, { nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKGroupToDomain,
          (item) => item?.GroupName,
          'group'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListGroups', assetType: ASSET_TYPES.group },
      'list'
    );
    return result.items;
  }

  public async listGroupsPaginated(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<ListResult<Group>> {
    return await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listGroups('default', { nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKGroupToDomain,
          (item) => item?.GroupName,
          'group'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListGroups', assetType: ASSET_TYPES.group },
      'list'
    );
  }

  /**
   * List ingestions for a dataset
   */
  public async listIngestions(
    dataSetId: string,
    dataSetName?: string,
    maxResults: number = 100
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.listIngestions(dataSetId, maxResults),
      {
        operation: 'ListIngestions',
        assetType: ASSET_TYPES.dataset,
        assetId: dataSetId,
        assetName: dataSetName,
      },
      'list'
    );
  }

  public async listRefreshSchedules(dataSetId: string, dataSetName?: string): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.listRefreshSchedules(dataSetId),
      {
        operation: 'ListRefreshSchedules',
        assetType: ASSET_TYPES.dataset,
        assetId: dataSetId,
        assetName: dataSetName,
      },
      'other'
    );
  }

  // =============================================================================
  // CREATE OPERATIONS
  // =============================================================================

  public async listUserGroups(userName: string, namespace: string = 'default'): Promise<any[]> {
    const result = await this.executeWithTracking(
      () => this.adapter.listUserGroups(userName, namespace),
      { operation: 'ListUserGroups', assetType: ASSET_TYPES.user },
      'list'
    );
    return result.items;
  }

  public async listUsers(
    namespace: string = 'default',
    nextToken?: string,
    maxResults: number = 100
  ): Promise<User[]> {
    const result = await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listUsers(namespace, { nextToken, maxResults });
        return mappers.mapSDKUserListToDomain(sdkResult.items, sdkResult.nextToken);
      },
      { operation: 'ListUsers', assetType: ASSET_TYPES.user },
      'list'
    );
    return result.items;
  }

  public async listUsersPaginated(
    nextToken?: string,
    maxResults: number = 100
  ): Promise<ListResult<User>> {
    return await this.executeWithTracking(
      async () => {
        const sdkResult = await this.adapter.listUsers('default', { nextToken, maxResults });
        const validItems = this.validateAndMapItems(
          sdkResult.items,
          mappers.mapSDKUserToDomain,
          (item) => item?.UserName,
          'user'
        );
        return { items: validItems, nextToken: sdkResult.nextToken };
      },
      { operation: 'ListUsers', assetType: ASSET_TYPES.user },
      'list'
    );
  }

  public async putDataSetRefreshProperties(
    dataSetId: string,
    refreshProperties: any
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.putDataSetRefreshProperties(dataSetId, refreshProperties),
      {
        operation: 'PutDataSetRefreshProperties',
        assetType: ASSET_TYPES.dataset,
        assetId: dataSetId,
      },
      'other'
    );
  }

  public async registerUser(params: {
    userName: string;
    email: string;
    identityType?: any;
    userRole?: any;
    iamArn?: string;
    sessionName?: string;
    namespace?: string;
    customPermissionsName?: string;
    externalLoginFederationProviderType?: string;
    externalLoginId?: string;
  }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.registerUser(params),
      { operation: 'RegisterUser', assetType: ASSET_TYPES.user, assetId: params.userName },
      'other'
    );
  }

  /**
   * Set or update the operation tracker
   */
  public setOperationTracker(tracker: OperationTracker): void {
    this.operationTracker = tracker;
  }

  // =============================================================================
  // UPDATE OPERATIONS
  // =============================================================================

  public async tagResource(
    resourceType: AssetType,
    resourceId: string,
    tags: Array<{ key: string; value: string }>,
    awsRegion: string = 'us-east-1'
  ): Promise<void> {
    const resourceArn = this.buildResourceArn(
      resourceType,
      resourceId,
      this.adapter.getAwsAccountId(),
      awsRegion
    );

    return await this.executeWithTracking(
      () => this.adapter.tagResource(resourceArn, tags),
      { operation: 'TagResource', assetType: resourceType, assetId: resourceId },
      'tags'
    );
  }

  public async untagResource(
    resourceType: AssetType,
    resourceId: string,
    tagKeys: string[],
    awsRegion: string = 'us-east-1'
  ): Promise<void> {
    const resourceArn = this.buildResourceArn(
      resourceType,
      resourceId,
      this.adapter.getAwsAccountId(),
      awsRegion
    );

    return await this.executeWithTracking(
      () => this.adapter.untagResource(resourceArn, tagKeys),
      { operation: 'UntagResource', assetType: resourceType, assetId: resourceId },
      'tags'
    );
  }

  public async updateAnalysis(params: {
    analysisId: string;
    name: string;
    definition?: any;
    sourceEntity?: any;
    themeArn?: string;
  }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateAnalysis(params),
      { operation: 'UpdateAnalysis', assetType: ASSET_TYPES.analysis, assetId: params.analysisId },
      'other'
    );
  }

  public async updateAnalysisPermissions(
    analysisId: string,
    permissions: any[],
    revokations: any[] = []
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateAnalysisPermissions(analysisId, permissions, revokations),
      {
        operation: 'UpdateAnalysisPermissions',
        assetType: ASSET_TYPES.analysis,
        assetId: analysisId,
      },
      'other'
    );
  }

  public async updateDashboard(params: {
    dashboardId: string;
    name: string;
    definition?: any;
    sourceEntity?: any;
    themeArn?: string;
    dashboardPublishOptions?: any;
  }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateDashboard(params),
      {
        operation: 'UpdateDashboard',
        assetType: ASSET_TYPES.dashboard,
        assetId: params.dashboardId,
      },
      'other'
    );
  }

  public async updateDashboardPermissions(
    dashboardId: string,
    permissions: any[],
    revokations: any[] = []
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateDashboardPermissions(dashboardId, permissions, revokations),
      {
        operation: 'UpdateDashboardPermissions',
        assetType: ASSET_TYPES.dashboard,
        assetId: dashboardId,
      },
      'other'
    );
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
  }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateDataSet(params),
      { operation: 'UpdateDataSet', assetType: ASSET_TYPES.dataset, assetId: params.dataSetId },
      'other'
    );
  }

  public async updateDataSetPermissions(
    dataSetId: string,
    permissions: any[],
    revokations: any[] = []
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateDataSetPermissions(dataSetId, permissions, revokations),
      { operation: 'UpdateDataSetPermissions', assetType: ASSET_TYPES.dataset, assetId: dataSetId },
      'other'
    );
  }

  // =============================================================================
  // PERMISSION UPDATE OPERATIONS
  // =============================================================================

  public async updateDataSource(params: {
    dataSourceId: string;
    name: string;
    dataSourceParameters?: any;
    credentials?: any;
    vpcConnectionProperties?: any;
    sslProperties?: any;
  }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateDataSource(params),
      {
        operation: 'UpdateDataSource',
        assetType: ASSET_TYPES.datasource,
        assetId: params.dataSourceId,
      },
      'other'
    );
  }

  public async updateDataSourcePermissions(
    dataSourceId: string,
    permissions: any[],
    revokations: any[] = []
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateDataSourcePermissions(dataSourceId, permissions, revokations),
      {
        operation: 'UpdateDataSourcePermissions',
        assetType: ASSET_TYPES.datasource,
        assetId: dataSourceId,
      },
      'other'
    );
  }

  public async updateFolder(params: { folderId: string; name: string }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateFolder(params),
      { operation: 'UpdateFolder', assetType: ASSET_TYPES.folder, assetId: params.folderId },
      'other'
    );
  }

  public async updateFolderPermissions(
    folderId: string,
    permissions: any[],
    revokations: any[] = []
  ): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateFolderPermissions(folderId, permissions, revokations),
      { operation: 'UpdateFolderPermissions', assetType: ASSET_TYPES.folder, assetId: folderId },
      'other'
    );
  }

  public async updateGroup(params: {
    groupName: string;
    description?: string;
    namespace?: string;
  }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateGroup(params),
      { operation: 'UpdateGroup', assetType: ASSET_TYPES.group, assetId: params.groupName },
      'other'
    );
  }

  // =============================================================================
  // DATASET REFRESH OPERATIONS
  // =============================================================================

  public async updateUser(params: {
    userName: string;
    email: string;
    role?: any;
    customPermissionsName?: string;
    unapplyCustomPermissions?: boolean;
    namespace?: string;
    externalLoginFederationProviderType?: string;
    externalLoginId?: string;
  }): Promise<any> {
    return await this.executeWithTracking(
      () => this.adapter.updateUser(params),
      { operation: 'UpdateUser', assetType: ASSET_TYPES.user, assetId: params.userName },
      'other'
    );
  }

  /**
   * Build resource ARN for tagging operations
   */
  private buildResourceArn(
    resourceType: string,
    resourceId: string,
    awsAccountId: string,
    awsRegion: string = 'us-east-1'
  ): string {
    return `arn:aws:quicksight:${awsRegion}:${awsAccountId}:${resourceType}/${resourceId}`;
  }

  // =============================================================================
  // FOLDER MEMBERSHIP OPERATIONS
  // =============================================================================

  /**
   * Determine if a principal is a user or group
   */
  private determinePrincipalType(principal: string): 'USER' | 'GROUP' {
    // QuickSight principals have the format:
    // Users: arn:aws:quicksight:region:account-id:user/namespace/username
    // Groups: arn:aws:quicksight:region:account-id:group/namespace/groupname
    if (principal.includes(':group/')) {
      return 'GROUP';
    }
    return 'USER';
  }

  // =============================================================================
  // GENERIC ASSET LISTING
  // =============================================================================

  /**
   * Execute an operation with retry logic, error handling, and tracking
   */
  private async executeWithTracking<T>(
    operation: () => Promise<T>,
    metadata: ApiOperation,
    action: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      // Use more aggressive retry for tags and permissions due to throttling
      const retryOptions =
        action === 'tags' || action === 'permissions'
          ? {
              maxRetries: 5,
              baseDelay: 2000,
              maxDelay: 30000,
            }
          : {
              maxRetries: QS_CONSTANTS.RETRY_COUNT,
              baseDelay: 1000,
              maxDelay: 10000,
            };

      // Use retry wrapper for resilience
      const result = await withRetry(operation, metadata.operation, retryOptions);

      // Track successful API call using OperationTracker
      if (this.operationTracker) {
        await this.operationTracker.trackOperation({
          namespace: 'api',
          resource: metadata.assetType,
          action: action,
          count: 1,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Special handling for FILE dataset errors - these are expected
      if (
        metadata.operation === 'DescribeDataSet' &&
        errorMessage.includes('not supported through API')
      ) {
        // Silently handle FILE dataset errors - no logging at all
        // These are expected for uploaded CSV/Excel files
      } else {
        logger.error(`QuickSight API call failed: ${metadata.operation}`, {
          error: errorMessage,
          duration,
          assetType: metadata.assetType,
          assetId: metadata.assetId,
          assetName: metadata.assetName,
        });
      }
      throw error;
    }
  }

  private getIdFromMappedItem(item: any, assetType: string): string | undefined {
    const idFieldMap: Record<string, string> = {
      dashboard: 'dashboardId',
      dataset: 'dataSetId',
      analysis: 'analysisId',
      datasource: 'dataSourceId',
      folder: 'folderId',
      user: 'userName',
      group: 'groupName',
    };

    const idField = idFieldMap[assetType];
    return idField ? item[idField] : undefined;
  }

  /**
   * Get the appropriate list method for an asset type
   */
  private getListMethodForAssetType(
    assetType: string
  ): ((nextToken?: string, maxResults?: number) => Promise<ListResult<any>>) | null {
    const methodMap: Record<
      string,
      (nextToken?: string, maxResults?: number) => Promise<ListResult<any>>
    > = {
      dashboard: this.listDashboardsPaginated.bind(this),
      dataset: this.listDatasetsPaginated.bind(this),
      analysis: this.listAnalysesPaginated.bind(this),
      datasource: this.listDatasourcesPaginated.bind(this),
      folder: this.listFoldersPaginated.bind(this),
      user: this.listUsersPaginated.bind(this),
      group: this.listGroupsPaginated.bind(this),
    };

    return methodMap[assetType] || null;
  }

  /**
   * Transform QuickSight permissions to our format
   */
  private transformPermissions(permissions: any[]): AssetPermission[] {
    return permissions.map((permission) => ({
      principal: permission.Principal,
      principalType: this.determinePrincipalType(permission.Principal),
      actions: permission.Actions || [],
    }));
  }

  private validateAndMapItems<T, U>(
    items: T[],
    mapFn: (item: T) => U,
    getIdFn: (item: T) => string | undefined,
    assetType: string
  ): U[] {
    const validItems: U[] = [];
    let invalidCount = 0;

    for (const item of items) {
      try {
        // Skip completely empty items or items without ID
        if (!item || !getIdFn(item)) {
          logger.error(`AWS returned ${assetType} item with missing ID`, { item });
          invalidCount++;
          continue;
        }
        const mapped = mapFn(item);

        // Double-check the mapped item has an ID
        // The mapped item should have camelCase properties
        const mappedId = this.getIdFromMappedItem(mapped, assetType);
        if (!mappedId) {
          logger.error(`Mapped ${assetType} item has undefined ID after mapping`, {
            originalItem: item,
            mappedItem: mapped,
          });
          invalidCount++;
          continue;
        }

        validItems.push(mapped);
      } catch (error) {
        logger.error(`Failed to map ${assetType} item`, { item, error });
        invalidCount++;
      }
    }

    // Fail if too many items are invalid (more than 50%)
    if (
      items.length > 0 &&
      invalidCount / items.length > QuickSightService.MAX_INVALID_ITEM_RATIO
    ) {
      throw new Error(
        `Too many invalid ${assetType} items from AWS: ${invalidCount}/${items.length}. Export aborted to prevent data loss.`
      );
    }

    if (invalidCount > 0) {
      logger.warn(`Skipped ${invalidCount} invalid ${assetType} items out of ${items.length}`);
    }

    return validItems;
  }
}
