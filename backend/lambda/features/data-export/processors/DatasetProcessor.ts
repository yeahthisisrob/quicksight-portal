import { BaseAssetProcessor, type AssetProcessingCapabilities } from './BaseAssetProcessor';
import {
  type DataSetRefreshProperties,
  type RefreshSchedule,
} from '../../../shared/models/asset-export.model';
import { isDatasetSummary } from '../../../shared/models/quicksight-domain.model';
import { ASSET_TYPES, ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { type AssetType, type AssetSummary } from '../types';

/**
 * Dataset processor with consistent patterns and proper abstraction
 */
export class DatasetProcessor extends BaseAssetProcessor {
  public readonly assetType: AssetType = ASSET_TYPES.dataset;
  public readonly capabilities: AssetProcessingCapabilities = {
    hasDefinition: false, // Datasets don't have definition operations - all data comes from describe
    hasPermissions: true,
    hasTags: true,
    hasSpecialOperations: true, // Refresh schedules, SPICE metadata
  };

  public readonly storageType = 'individual' as const;

  constructor(
    quickSightService: any,
    s3Service: any,
    tagService: any,
    assetParserService: any,
    awsAccountId: string,
    maxConcurrency?: number
  ) {
    super(
      quickSightService,
      s3Service,
      tagService,
      assetParserService,
      awsAccountId,
      maxConcurrency
    );
  }

  protected override async executeDescribe(
    assetId: string,
    assetName?: string,
    summary?: any
  ): Promise<any> {
    // Debug log to see what we're getting
    if (summary) {
      // Check import mode for dataset
    }

    // Check if this is a FILE dataset from the summary ImportMode
    if (summary?.ImportMode === 'FILE') {
      // FILE import mode (uploaded file), skipping describe API call

      // Return a response indicating this is an uploaded file dataset
      // The buildExportData method will use the summary data instead
      return {
        dataSet: {
          dataSetId: assetId,
          // All other fields will come from the summary in buildExportData
        },
        _isUploadedFile: true,
        _describeFailedError: 'FILE datasets cannot be described through API',
      };
    }

    try {
      const result = await this.quickSightService.describeDataset(assetId, assetName);

      return result;
    } catch (error: any) {
      // Silently handle FILE dataset errors - no logging to avoid noise in production
      if (!error.message?.includes('not supported through API')) {
        logger.warn(`DescribeDataSet failed for ${assetId}: ${error.message}`);
      }

      // For uploaded file datasets that can't be described via API,
      // we MUST have the name from the list operation
      if (error.message?.includes('not supported through API')) {
        if (!assetName || assetName === `Dataset ${assetId}`) {
          logger.error(
            `Dataset ${assetId} is an uploaded file type but no proper name was provided from listing`,
            {
              assetName,
              errorMessage: error.message,
            }
          );
        } else {
          // Using name from list operation for uploaded file
        }
      }

      // For uploaded file datasets, we can't get the full describe data
      // But we should have ALL the data we need from the ListDataSets operation
      // The summary passed to processAsset has all the fields from the list operation
      // Describe failed, returning data from list operation

      // Return a minimal response - the buildExportData will use the summary data
      return {
        dataSet: {
          dataSetId: assetId,
          // All other fields will come from the summary in buildExportData
        },
        _isUploadedFile: true,
        _describeFailedError: error.message,
      };
    }
  }

  protected override executeGetPermissions(assetId: string): Promise<any> {
    return this.quickSightService.describeDatasetPermissions(assetId);
  }

  protected override executeGetTags(assetId: string): Promise<any[]> {
    return this.tagService.getResourceTags(ASSET_TYPES.dataset, assetId);
  }

  // =============================================================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // =============================================================================

  protected override async executeSpecialOperations(
    assetId: string,
    assetName?: string
  ): Promise<Record<string, any>> {
    // Always try to fetch refresh schedules and properties - these APIs work even for
    // datasets that can't be described (composite, GitHub connectors, etc.)
    return await this.fetchRefreshMetadata(assetId, assetName);
  }

  protected generateCustomMetadata(
    summary: AssetSummary,
    data: any,
    parsedData?: any
  ): Record<string, any> {
    const metadata: Record<string, any> = {};
    const datasetData = data.describe?.dataSet || data.describe || summary;

    // Extract field counts from parsed dataset structure
    if (parsedData) {
      metadata.fieldCount = parsedData.fields?.length || 0;
      metadata.calculatedFieldCount = parsedData.calculatedFields?.length || 0;
      metadata.totalFieldCount = metadata.fieldCount + metadata.calculatedFieldCount;
    }

    // Extract import mode (SPICE vs Direct Query)
    const summaryImportMode = isDatasetSummary(summary) ? summary.importMode : undefined;
    metadata.importMode =
      datasetData.importMode || datasetData.ImportMode || summaryImportMode || 'DIRECT_QUERY';

    // Extract SPICE capacity for SPICE datasets only
    if (metadata.importMode === 'SPICE' && datasetData.ConsumedSpiceCapacityInBytes !== undefined) {
      metadata.consumedSpiceCapacityInBytes = datasetData.ConsumedSpiceCapacityInBytes;
    }

    // Track uploaded file datasets
    const isUploadedFile = (data.describe as any)._isUploadedFile || false;
    if (isUploadedFile) {
      metadata.isUploadedFile = true;
    }

    // Extract dataset usage configuration
    if (datasetData.DataSetUsageConfiguration) {
      metadata.dataSetUsageConfiguration = datasetData.DataSetUsageConfiguration;
    }

    // Extract SPICE refresh scheduling information
    if (data.special?.dataSetRefreshProperties) {
      metadata.hasRefreshProperties = true;
    }
    if (data.special?.refreshSchedules) {
      metadata.refreshScheduleCount = data.special.refreshSchedules.length;
    }

    return metadata;
  }

  protected getAssetId(summary: AssetSummary): string | undefined {
    // Use camelCase property from domain model
    return (summary as any).dataSetId;
  }

  // =============================================================================
  // OPTIONAL METHOD IMPLEMENTATIONS
  // =============================================================================

  protected getAssetName(summary: AssetSummary): string {
    // Use camelCase property from domain model
    const name = (summary as any).name;
    if (!name || name.trim() === '') {
      logger.error(`Dataset ${(summary as any).dataSetId} has no name in summary`, {
        dataSetId: (summary as any).dataSetId,
        summaryKeys: Object.keys(summary),
        importMode: (summary as any).importMode,
        arn: (summary as any).arn,
      });
      return '';
    }

    return name;
  }

  protected getServicePath(): string {
    return ASSET_TYPES_PLURAL.dataset;
  }

  protected override parseAssetData(data: any): any {
    try {
      const isUploadedFile = (data.describe as any)._isUploadedFile || false;

      // Even for uploaded files, we should still try to parse the data
      // The parser should handle the case where some data might be missing
      const parsedData = this.assetParserService.parseDataset(data.describe);

      // If it's an uploaded file and we didn't get datasource info from parsing,
      // ensure we mark it as such
      if (
        isUploadedFile &&
        (!parsedData.datasourceInfo || parsedData.datasourceInfo.type === 'Unknown')
      ) {
        parsedData.datasourceInfo = { type: 'UPLOADED_FILE' };
      }

      return parsedData;
    } catch (error) {
      logger.warn(`Failed to parse dataset data for ${data.describe?.dataSet?.dataSetId}:`, error);
      return { fields: [], calculatedFields: [], datasourceInfo: { type: 'Unknown' } };
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async fetchRefreshMetadata(
    datasetId: string,
    datasetName?: string
  ): Promise<Record<string, any>> {
    const refreshData: Record<string, any> = {};

    // Fetch refresh properties and schedules in parallel
    const [refreshPropsResult, schedulesResult] = await Promise.allSettled([
      this.quickSightService.describeDatasetRefreshProperties(datasetId, datasetName),
      this.quickSightService.listRefreshSchedules(datasetId, datasetName),
    ]);

    // Handle refresh properties result
    if (refreshPropsResult.status === 'fulfilled') {
      const refreshProps = refreshPropsResult.value as DataSetRefreshProperties;
      refreshData.dataSetRefreshProperties = refreshProps;
    } else if (
      !refreshPropsResult.reason?.message?.includes('Dataset refresh properties are not set')
    ) {
      logger.warn(
        `Could not get refresh properties for dataset ${datasetId}:`,
        refreshPropsResult.reason?.message
      );
    }

    // Handle schedules result
    if (schedulesResult.status === 'fulfilled') {
      const schedules = schedulesResult.value as RefreshSchedule[];
      refreshData.refreshSchedules = schedules || [];
    } else {
      logger.warn(
        `Could not get refresh schedules for dataset ${datasetId}:`,
        schedulesResult.reason
      );
    }

    return refreshData;
  }
}
