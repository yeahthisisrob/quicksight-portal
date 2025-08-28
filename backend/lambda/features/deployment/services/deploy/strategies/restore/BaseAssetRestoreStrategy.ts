import type { AssetExportData } from '../../../../../../shared/models/asset-export.model';
import { type QuickSightService } from '../../../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../../../shared/services/aws/S3Service';
import { ASSET_TYPES_PLURAL, isCollectionType } from '../../../../../../shared/types/assetTypes';
import { logger } from '../../../../../../shared/utils/logger';
import type { AssetType } from '../../../../../data-export/types';
import type { DeploymentConfig, ValidationResult } from '../../types';

/**
 * Base class for asset-specific restore strategies
 * Provides common functionality for all asset types
 */
export abstract class BaseAssetRestoreStrategy {
  protected readonly assetType: AssetType;
  protected readonly awsAccountId: string;
  protected readonly bucketName: string;
  protected readonly quickSightService: QuickSightService;
  protected readonly s3Service: S3Service;

  constructor(
    quickSightService: QuickSightService,
    s3Service: S3Service,
    awsAccountId: string,
    assetType: AssetType,
    bucketName?: string
  ) {
    this.quickSightService = quickSightService;
    this.s3Service = s3Service;
    this.awsAccountId = awsAccountId;
    this.assetType = assetType;
    this.bucketName = bucketName || `quicksight-metadata-bucket-${awsAccountId}`;
  }

  /**
   * Check if an asset exists in S3
   */
  protected async assetExists(assetType: AssetType, assetId: string): Promise<boolean> {
    try {
      const activePath = isCollectionType(assetType)
        ? `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
        : `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`;

      return await this.s3Service.objectExists(this.bucketName, activePath);
    } catch {
      return false;
    }
  }

  /**
   * Convert tags to service format (lowercase key/value)
   * Returns empty array if no tags, which can be used with conditional spreading
   */
  protected convertTags(tags: any[]): Array<{ key: string; value: string }> {
    if (!tags || !Array.isArray(tags)) {
      return [];
    }

    return tags.map((tag) => ({
      key: tag.Key || tag.key,
      value: tag.Value || tag.value,
    }));
  }

  public abstract deleteExisting(assetId: string): Promise<void>;

  protected extractBasicMetadata(assetData: AssetExportData): {
    name: string;
    permissions: any[];
    tags: any[];
  } {
    const apiResponses = assetData.apiResponses || {};

    // Support both the original apiResponses structure and transformed data
    // Transformed data has Tags/Permissions directly on the object
    const tags = apiResponses.tags?.data || (assetData as any).Tags || [];
    const permissions = apiResponses.permissions?.data || (assetData as any).Permissions || [];

    return {
      name: this.extractName(apiResponses),
      permissions,
      tags,
    };
  }

  /**
   * Extract dataset IDs from dashboard/analysis definitions
   */
  protected extractDatasetIds(assetData: AssetExportData): string[] {
    const datasetIds: string[] = [];
    const actualData = assetData.apiResponses?.describe?.data || assetData;

    if (actualData.Definition?.DataSetIdentifierDeclarations) {
      for (const decl of actualData.Definition.DataSetIdentifierDeclarations) {
        if (decl.DataSetArn) {
          const id = decl.DataSetArn.split('/').pop();
          if (id) {
            datasetIds.push(id);
          }
        }
      }
    }

    return [...new Set(datasetIds)];
  }

  /**
   * Extract datasource IDs from dataset definitions
   */
  protected extractDatasourceIds(assetData: AssetExportData): string[] {
    const datasourceIds: string[] = [];
    const actualData = assetData.apiResponses?.describe?.data || assetData;

    if (actualData.PhysicalTableMap) {
      for (const table of Object.values(actualData.PhysicalTableMap)) {
        const tableData = table as any;
        if (tableData.RelationalTable?.DataSourceArn) {
          const id = tableData.RelationalTable.DataSourceArn.split('/').pop();
          if (id) {
            datasourceIds.push(id);
          }
        }
      }
    }

    return [...new Set(datasourceIds)];
  }

  /**
   * Extract name from API responses with fallback
   * Export data is in SDK format, so we handle SDK field names directly
   */
  protected extractName(apiResponses: any): string {
    const data =
      apiResponses.describe?.data || apiResponses.list?.data || apiResponses.definition?.data;

    if (data) {
      // Handle SDK format field names directly
      return (
        data.Name || // Dashboard, Analysis, Dataset, Datasource, Folder
        data.UserName || // User
        data.GroupName || // Group
        `Restored ${this.assetType}`
      );
    }

    return `Restored ${this.assetType}`;
  }

  /**
   * Get tags for QuickSight API calls - only returns tags object if there are actual tags
   * This prevents the "Member must have length greater than or equal to 1" error
   */
  protected getTagsForApi(
    tags: any[]
  ): { tags: Array<{ key: string; value: string }> } | Record<string, never> {
    const convertedTags = this.convertTags(tags);
    return convertedTags.length > 0 ? { tags: convertedTags } : {};
  }

  /**
   * Handle deletion with proper error handling
   */
  protected async handleDeletion(assetId: string, deleteFunc: () => Promise<void>): Promise<void> {
    try {
      await deleteFunc();
      logger.info(`Deleted existing ${this.assetType} ${assetId} before restore`);
    } catch (error: any) {
      // If the asset doesn't exist, that's fine - we'll create it
      if (error.name !== 'ResourceNotFoundException') {
        logger.error(`Failed to delete existing ${this.assetType} ${assetId} before restore`, {
          error: error.message,
        });
        throw error;
      }
    }
  }

  /**
   * Log restore operation details
   */
  protected logRestoreOperation(assetId: string, details: Record<string, any>): void {
    logger.info(`Restoring ${this.assetType}`, {
      assetId,
      assetType: this.assetType,
      ...details,
    });
  }

  /**
   * Main restore method that each asset type must implement
   */
  public abstract restore(
    assetId: string,
    assetData: AssetExportData
  ): Promise<{ arn?: string; [key: string]: any }>;

  /**
   * Validate the asset can be restored
   */
  public async validate(
    assetId: string,
    assetData: AssetExportData,
    config: DeploymentConfig
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validate required fields
    const requiredFieldsResult = this.validateRequiredFields(assetData, config);
    if (requiredFieldsResult) {
      results.push(requiredFieldsResult);
    }

    // Validate dependencies if requested
    if (config.validation?.checkDependencies) {
      const dependencyResults = await this.validateDependencies(assetId, assetData);
      results.push(...dependencyResults);
    }

    return results;
  }

  /**
   * Validate dependencies for the asset
   * Each strategy implements its own dependency validation
   */
  protected abstract validateDependencies(
    assetId: string,
    assetData: AssetExportData
  ): Promise<ValidationResult[]>;

  /**
   * Validate required data for restoration
   */
  protected validateRequiredData(assetId: string, requiredData: any, dataName: string): void {
    if (!requiredData) {
      const message = `No ${dataName} found for ${this.assetType} ${assetId}`;
      logger.error(message);
      throw new Error(message);
    }
  }

  /**
   * Validate required fields for the asset type
   * Can be overridden by specific strategies
   */
  protected validateRequiredFields(
    assetData: AssetExportData,
    config: DeploymentConfig
  ): ValidationResult | null {
    const actualData = assetData.apiResponses?.describe?.data || assetData;
    const name = config.options.name || actualData.Name || actualData.name;

    if (!name) {
      return {
        validator: 'required-fields',
        passed: false,
        message: `Asset name is required for ${this.assetType}`,
        severity: 'error',
      };
    }

    return null;
  }
}
