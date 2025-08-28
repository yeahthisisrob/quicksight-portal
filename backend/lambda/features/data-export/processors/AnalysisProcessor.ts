import { BaseAssetProcessor, type AssetProcessingCapabilities } from './BaseAssetProcessor';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../shared/services/parsing/AssetParserService';
import { ASSET_TYPES, ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { type TagService } from '../../organization/services/TagService';
import { type AssetType, type AssetSummary } from '../types';

/**
 * Analysis processor with consistent patterns and proper abstraction
 */
export class AnalysisProcessor extends BaseAssetProcessor {
  public readonly assetType: AssetType = ASSET_TYPES.analysis;
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
    return await this.quickSightService.describeAnalysis(assetId, assetName);
  }

  protected override async executeDescribeDefinition(
    assetId: string,
    assetName?: string
  ): Promise<any> {
    return await this.quickSightService.describeAnalysisDefinition(assetId, assetName);
  }

  // =============================================================================
  // REQUIRED ABSTRACT METHOD IMPLEMENTATIONS
  // =============================================================================

  protected override async executeGetPermissions(assetId: string): Promise<any> {
    return await this.quickSightService.describeAnalysisPermissions(assetId);
  }

  protected async executeGetTags(assetId: string): Promise<any[]> {
    return await this.tagService.getResourceTags(ASSET_TYPES.analysis, assetId);
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

    // Add analysis status information
    if (data.describe?.analysis?.status) {
      metadata.status = data.describe.analysis.status;
    }

    // Add theme information if available
    if (data.definition?.themeArn) {
      metadata.hasCustomTheme = true;
      metadata.themeArn = data.definition.themeArn;
    }

    // Add data set references
    if (data.definition?.dataSetReferencesDeclarations) {
      metadata.datasetCount = data.definition.dataSetReferencesDeclarations.length;
      metadata.datasetArns = data.definition.dataSetReferencesDeclarations.map(
        (ref: any) => ref.dataSetArn
      );
    }

    return metadata;
  }

  // =============================================================================
  // OPTIONAL METHOD IMPLEMENTATIONS
  // =============================================================================

  protected getAssetId(summary: AssetSummary): string | undefined {
    // Use camelCase property from domain model
    return (summary as any).analysisId;
  }

  protected getAssetName(summary: AssetSummary): string {
    // Use camelCase property from domain model
    const name = (summary as any).name;
    if (!name || name.trim() === '') {
      logger.error(`Analysis ${(summary as any).analysisId} has no name in summary`, {
        analysisId: (summary as any).analysisId,
        summaryKeys: Object.keys(summary),
        arn: (summary as any).arn,
        status: (summary as any).status,
        createdTime: (summary as any).createdTime,
        lastUpdatedTime: (summary as any).lastUpdatedTime,
      });
      return '';
    }

    return name;
  }

  protected getServicePath(): string {
    return ASSET_TYPES_PLURAL.analysis;
  }

  protected override async parseAssetData(data: any): Promise<any> {
    try {
      if (data.definition) {
        return await this.assetParserService.parseAnalysis(data.definition);
      }
    } catch (error) {
      logger.warn(
        `Failed to parse analysis data for ${data.describe?.analysis?.analysisId}:`,
        error
      );
    }
    return null;
  }
}
