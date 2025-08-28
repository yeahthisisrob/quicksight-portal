import { BaseAssetRestoreStrategy } from './BaseAssetRestoreStrategy';
import type { AssetExportData } from '../../../../../../shared/models/asset-export.model';
import type { ValidationResult } from '../../types';

/**
 * Analysis-specific restore strategy
 */
export class AnalysisRestoreStrategy extends BaseAssetRestoreStrategy {
  /**
   * Delete existing analysis
   */
  public async deleteExisting(assetId: string): Promise<void> {
    await this.handleDeletion(assetId, () => this.quickSightService.deleteAnalysis(assetId));
  }

  /**
   * Restore analysis to QuickSight
   */
  public async restore(
    assetId: string,
    assetData: AssetExportData
  ): Promise<{ arn?: string; [key: string]: any }> {
    const analysisData = this.extractAnalysisData(assetData);

    this.validateRequiredData(assetId, analysisData.definition, 'analysis definition');

    this.logRestoreOperation(assetId, {
      name: analysisData.name,
      hasDefinition: !!analysisData.definition,
      permissionCount: analysisData.permissions.length,
      tagCount: analysisData.tags.length,
    });

    // TODO: Add date cleaning workaround for AWS SDK issue #6176
    // The SDK incorrectly expects Date objects for TimeRangeFilterValue.StaticValue
    // fields even though QuickSight API returns ISO date strings.
    // See: https://github.com/aws/aws-sdk-js-v3/issues/6176
    // For now, analyses with time range filters may fail to restore.

    return await this.quickSightService.createAnalysis({
      analysisId: assetId,
      name: analysisData.name,
      definition: analysisData.definition,
      permissions: analysisData.permissions,
      ...this.getTagsForApi(analysisData.tags),
      sourceEntity: undefined,
      themeArn: analysisData.themeArn,
    });
  }

  /**
   * Validate analysis dependencies (datasets)
   */
  protected async validateDependencies(
    assetId: string,
    assetData: AssetExportData
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const datasetIds = this.extractDatasetIds(assetData);

    for (const datasetId of datasetIds) {
      const exists = await this.assetExists('dataset', datasetId);
      if (!exists) {
        results.push({
          validator: 'dependencies',
          passed: false,
          message: `Required dataset ${datasetId} not found`,
          severity: 'warning',
          details: { assetId, datasetId },
        });
      }
    }

    return results;
  }

  /**
   * Extract analysis-specific data from export
   */
  private extractAnalysisData(assetData: AssetExportData): {
    definition: any;
    name: string;
    permissions: any[];
    tags: any[];
    themeArn?: string;
  } {
    const basic = this.extractBasicMetadata(assetData);
    const apiResponses = assetData.apiResponses || {};

    return {
      ...basic,
      definition: apiResponses.definition?.data?.Definition,
      themeArn: apiResponses.definition?.data?.ThemeArn,
    };
  }
}
