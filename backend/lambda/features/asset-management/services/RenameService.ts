/**
 * RenameService - live rename of QuickSight assets.
 *
 * QuickSight has no dedicated rename API for most types: Update* calls
 * require the full current specification back. So each rename is a
 * describe -> update round trip against LIVE QuickSight (never the cache,
 * which could be stale):
 * - dashboard: DescribeDashboardDefinition -> UpdateDashboard (new draft
 *   version) -> UpdateDashboardPublishedVersion so viewers see it
 * - analysis:  DescribeAnalysisDefinition -> UpdateAnalysis
 * - dataset:   DescribeDataSet -> UpdateDataSet (full table maps resent)
 * - folder:    UpdateFolder (name-only API)
 *
 * Not supported: datasource (UpdateDataSource requires resending connection
 * parameters and has unclear stored-credential semantics), user/group (the
 * QuickSight API has no rename for principals).
 *
 * After a successful rename the cache entry's name is updated so listings
 * reflect it immediately; QuickSight bumps LastUpdatedTime, so the next
 * Smart Sync re-exports the asset file automatically.
 */

import { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { type AssetType } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';

export const RENAMEABLE_ASSET_TYPES = ['dashboard', 'analysis', 'dataset', 'folder'] as const;
export type RenameableAssetType = (typeof RENAMEABLE_ASSET_TYPES)[number];

/** QuickSight name constraints (dashboards/analyses/datasets allow 1-2048;
 *  folders 1-200 - enforce the stricter bound uniformly for sanity) */
const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 200;

export function isRenameableAssetType(assetType: string): assetType is RenameableAssetType {
  return (RENAMEABLE_ASSET_TYPES as readonly string[]).includes(assetType);
}

export class RenameService {
  private readonly quickSightService: QuickSightService;

  constructor(awsAccountId: string) {
    this.quickSightService = new QuickSightService(awsAccountId);
  }

  /**
   * Rename an asset in QuickSight and reflect it in the cache.
   * Returns the new name on success; throws with a user-presentable message.
   */
  public async renameAsset(
    assetType: RenameableAssetType,
    assetId: string,
    rawName: string
  ): Promise<{ name: string }> {
    const name = rawName.trim();
    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      throw new Error(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`);
    }

    logger.info('Renaming asset', { assetType, assetId, name });

    switch (assetType) {
      case 'dashboard':
        await this.renameDashboard(assetId, name);
        break;
      case 'analysis':
        await this.renameAnalysis(assetId, name);
        break;
      case 'dataset':
        await this.renameDataset(assetId, name);
        break;
      case 'folder':
        await this.quickSightService.updateFolder({ folderId: assetId, name });
        break;
    }

    // Listings reflect the new name immediately; the exported S3 file
    // refreshes on the next Smart Sync (QuickSight bumped LastUpdatedTime)
    try {
      await cacheService.updateAsset(assetType as AssetType, assetId, { assetName: name });
    } catch (error) {
      // Non-fatal: the rename in QuickSight succeeded; the next export
      // reconciles the cache
      logger.warn('Rename succeeded but cache update failed', { assetType, assetId, error });
    }

    logger.info('Asset renamed', { assetType, assetId, name });
    return { name };
  }

  private parseVersionNumber(versionArn?: string): number | null {
    const match = versionArn?.match(/\/version\/(\d+)$/);
    if (!match?.[1]) {
      return null;
    }
    const parsed = parseInt(match[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private async renameAnalysis(analysisId: string, name: string): Promise<void> {
    const current = await this.quickSightService.describeAnalysisDefinition(analysisId);
    if (!current?.Definition) {
      throw new Error('Could not load the current analysis definition from QuickSight');
    }
    await this.quickSightService.updateAnalysis({
      analysisId,
      name,
      definition: current.Definition,
      themeArn: current.ThemeArn,
    });
  }

  private async renameDashboard(dashboardId: string, name: string): Promise<void> {
    const current = await this.quickSightService.describeDashboardDefinition(dashboardId);
    if (!current?.Definition) {
      throw new Error('Could not load the current dashboard definition from QuickSight');
    }
    const updated = await this.quickSightService.updateDashboard({
      dashboardId,
      name,
      definition: current.Definition,
      themeArn: current.ThemeArn,
      dashboardPublishOptions: current.DashboardPublishOptions,
    });

    // UpdateDashboard creates a DRAFT version - publish it or viewers keep
    // seeing the old name. The new version number rides on the VersionArn
    // (arn:...:dashboard/<id>/version/<n>).
    const versionNumber = this.parseVersionNumber(updated?.versionArn);
    if (versionNumber === null) {
      throw new Error(
        'Dashboard was renamed but the new version could not be determined for publishing'
      );
    }
    await this.quickSightService.updateDashboardPublishedVersion(dashboardId, versionNumber);
  }

  private async renameDataset(dataSetId: string, name: string): Promise<void> {
    const current = await this.quickSightService.describeDataset(dataSetId);
    if (!current?.PhysicalTableMap || !current?.ImportMode) {
      throw new Error(
        'Could not load the current dataset specification from QuickSight ' +
          '(flat-file datasets cannot be described via the API and cannot be renamed here)'
      );
    }
    await this.quickSightService.updateDataSet({
      dataSetId,
      name,
      physicalTableMap: current.PhysicalTableMap,
      logicalTableMap: current.LogicalTableMap,
      importMode: current.ImportMode,
      columnGroups: current.ColumnGroups,
      fieldFolders: current.FieldFolders,
      rowLevelPermissionDataSet: current.RowLevelPermissionDataSet,
      rowLevelPermissionTagConfiguration: current.RowLevelPermissionTagConfiguration,
      columnLevelPermissionRules: current.ColumnLevelPermissionRules,
      dataSetUsageConfiguration: current.DataSetUsageConfiguration,
    });
  }
}
