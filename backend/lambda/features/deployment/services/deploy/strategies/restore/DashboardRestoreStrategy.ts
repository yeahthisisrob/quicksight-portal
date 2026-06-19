import { BaseAssetRestoreStrategy } from './BaseAssetRestoreStrategy';
import type { AssetExportData } from '../../../../../../shared/models/asset-export.model';
import { reviveQuickSightTimestamps } from '../../../../../../shared/utils/quicksightTimestamps';
import type { ValidationResult } from '../../types';

/**
 * Dashboard-specific restore strategy
 */
export class DashboardRestoreStrategy extends BaseAssetRestoreStrategy {
  /**
   * Delete existing dashboard
   */
  public async deleteExisting(assetId: string): Promise<void> {
    await this.handleDeletion(assetId, () => this.quickSightService.deleteDashboard(assetId));
  }

  /**
   * Restore dashboard to QuickSight
   */
  public async restore(
    assetId: string,
    assetData: AssetExportData
  ): Promise<{ arn?: string; [key: string]: any }> {
    const dashboardData = this.extractDashboardData(assetData);

    this.validateRequiredData(assetId, dashboardData.definition, 'dashboard definition');

    this.logRestoreOperation(assetId, {
      name: dashboardData.name,
      hasDefinition: !!dashboardData.definition,
      hasPublishOptions: !!dashboardData.publishOptions,
      permissionCount: dashboardData.permissions.length,
      tagCount: dashboardData.tags.length,
    });

    // Revive ISO timestamp strings (time-range filters, DateTime parameter
    // defaults) back to Date objects so the AWS SDK can marshal them.
    // See: https://github.com/aws/aws-sdk-js-v3/issues/6176
    return await this.quickSightService.createDashboard({
      dashboardId: assetId,
      name: dashboardData.name,
      definition: reviveQuickSightTimestamps(dashboardData.definition),
      dashboardPublishOptions: dashboardData.publishOptions,
      permissions: dashboardData.permissions,
      ...this.getTagsForApi(dashboardData.tags),
      sourceEntity: undefined,
      themeArn: dashboardData.themeArn,
    });
  }

  /**
   * Validate dashboard dependencies (datasets)
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
   * Extract dashboard-specific data from export
   */
  private extractDashboardData(assetData: AssetExportData): {
    definition: any;
    publishOptions: any;
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
      publishOptions: apiResponses.definition?.data?.DashboardPublishOptions,
      themeArn: apiResponses.definition?.data?.ThemeArn,
    };
  }
}
