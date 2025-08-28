import { BaseAssetProcessor, type AssetProcessingCapabilities } from './BaseAssetProcessor';
import { ASSET_TYPES, ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { type AssetType, type AssetSummary } from '../types';

/**
 * DataSource processor with consistent patterns and proper abstraction
 *
 * Note: This processor handles the AWS SDK v2 exception for ListDataSources
 * due to a known bug, but maintains architectural consistency otherwise
 */
export class DatasourceProcessor extends BaseAssetProcessor {
  public readonly assetType: AssetType = ASSET_TYPES.datasource;
  public readonly capabilities: AssetProcessingCapabilities = {
    hasDefinition: false,
    hasPermissions: true,
    hasTags: true,
    hasSpecialOperations: false,
  };

  public readonly storageType = 'individual' as const;

  protected override async executeDescribe(assetId: string, assetName?: string): Promise<any> {
    try {
      const dataSource = await this.quickSightService.describeDatasource(assetId, assetName);

      // Return the DataSource object directly since adapter already unwrapped it
      return dataSource;
    } catch (describeError: any) {
      logger.warn(
        `DescribeDataSource failed for ${assetId} (${assetName}): ${describeError.message}`
      );
      logger.info(`Treating datasource ${assetId} as uploaded file, using fallback metadata`);

      // Create minimal response for uploaded file datasources (PascalCase to match SDK)
      return {
        DataSourceId: assetId,
        Arn: `arn:aws:quicksight:*:${this.awsAccountId}:datasource/${assetId}`,
        Name: assetName || `DataSource ${assetId}`,
        Type: 'FILE',
        CreatedTime: new Date().toISOString(),
        LastUpdatedTime: new Date().toISOString(),
        _isUploadedFile: true,
      };
    }
  }

  protected override async executeGetPermissions(assetId: string): Promise<any> {
    try {
      return await this.quickSightService.describeDatasourcePermissions(assetId);
    } catch (_err: any) {
      return null;
    }
  }

  protected override async executeGetTags(assetId: string): Promise<any[]> {
    try {
      return await this.tagService.getResourceTags(ASSET_TYPES.datasource, assetId);
    } catch (_err: any) {
      return [];
    }
  }

  // =============================================================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // =============================================================================

  protected getAssetId(summary: AssetSummary): string | undefined {
    // Use camelCase property from domain model
    return (summary as any).dataSourceId;
  }

  protected getAssetName(summary: AssetSummary): string {
    // Use camelCase properties from domain model
    return (summary as any).name || `DataSource ${(summary as any).dataSourceId}`;
  }

  protected getServicePath(): string {
    return ASSET_TYPES_PLURAL.datasource;
  }
}
