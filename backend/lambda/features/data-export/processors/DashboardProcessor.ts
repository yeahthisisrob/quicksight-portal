import { BaseAssetProcessor, type AssetProcessingCapabilities } from './BaseAssetProcessor';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../shared/services/parsing/AssetParserService';
import { ASSET_TYPES, ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { type TagService } from '../../organization/services/TagService';
import { type AssetType, type AssetSummary } from '../types';

/**
 * Dashboard processor with consistent patterns and proper abstraction
 */
export class DashboardProcessor extends BaseAssetProcessor {
  public readonly assetType: AssetType = ASSET_TYPES.dashboard;
  public readonly capabilities: AssetProcessingCapabilities = {
    hasDefinition: true,
    hasPermissions: true,
    hasTags: true,
    hasSpecialOperations: false,
  };

  public readonly storageType = 'individual' as const;

  constructor(
    quickSightService: QuickSightService,
    s3Service: S3Service,
    tagService: TagService,
    assetParserService: AssetParserService,
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

  protected override async executeDescribe(assetId: string, assetName?: string): Promise<any> {
    return await this.quickSightService.describeDashboard(assetId, assetName);
  }

  protected override async executeDescribeDefinition(
    assetId: string,
    assetName?: string
  ): Promise<any> {
    return await this.quickSightService.describeDashboardDefinition(assetId, assetName);
  }

  // =============================================================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // =============================================================================

  protected override async executeGetPermissions(assetId: string): Promise<any> {
    const response = await this.quickSightService.describeDashboardPermissions(assetId);

    // Return the full response structure to preserve all permission types
    // This includes:
    // 1. Regular Permissions array (which may include namespace permissions in older dashboards)
    // 2. LinkSharingConfiguration (which contains namespace permissions in newer dashboards)

    // If we have a full response object with Permissions property, return it as-is
    if (response && typeof response === 'object' && 'Permissions' in response) {
      return response;
    }

    // Fallback for backward compatibility if response is just an array
    return response;
  }

  protected async executeGetTags(assetId: string): Promise<any[]> {
    return await this.tagService.getResourceTags(ASSET_TYPES.dashboard, assetId);
  }

  protected generateCustomMetadata(
    _summary: AssetSummary,
    data: any,
    parsedData?: any
  ): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Add sheet and visual counts from parsed data
    if (parsedData) {
      metadata.sheetCount = parsedData.sheets?.length || 0;
      metadata.visualCount =
        parsedData.sheets?.reduce(
          (total: number, sheet: any) => total + (sheet.visualCount || 0),
          0
        ) || 0;
      metadata.visualFieldMappingCount = parsedData.visualFieldMappings?.length || 0;
    }

    // Add dashboard version information
    if (data.describe?.dashboard?.version) {
      metadata.version = data.describe.dashboard.version.versionNumber;
      metadata.status = data.describe.dashboard.version.status;
    }

    // Add theme information if available
    if (data.definition?.themeArn) {
      metadata.hasCustomTheme = true;
      metadata.themeArn = data.definition.themeArn;
    }

    return metadata;
  }

  // =============================================================================
  // OPTIONAL METHOD IMPLEMENTATIONS
  // =============================================================================

  protected getAssetId(summary: AssetSummary): string | undefined {
    // Use camelCase property from domain model
    return (summary as any).dashboardId;
  }

  protected getAssetName(summary: AssetSummary): string {
    // Use camelCase property from domain model
    const name = (summary as any).name;
    if (!name || name.trim() === '') {
      logger.error(`Dashboard ${(summary as any).dashboardId} has no name in summary`, {
        dashboardId: (summary as any).dashboardId,
        summaryKeys: Object.keys(summary),
        arn: (summary as any).arn,
        createdTime: (summary as any).createdTime,
        lastUpdatedTime: (summary as any).lastUpdatedTime,
      });
      return '';
    }

    return name;
  }

  protected getServicePath(): string {
    return ASSET_TYPES_PLURAL.dashboard;
  }

  protected override parseAssetData(data: any): any {
    try {
      if (data.definition) {
        return this.assetParserService.parseDashboard(data.definition);
      }
    } catch (error) {
      logger.warn(
        `Failed to parse dashboard data for ${data.describe?.dashboard?.dashboardId}:`,
        error
      );
    }
    return null;
  }
}
