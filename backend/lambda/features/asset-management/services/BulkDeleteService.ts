/**
 * BulkDeleteService - Service for handling bulk asset deletion with automatic archiving
 * Follows VSA pattern and reuses existing deletion/archiving logic
 */
import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import { TIME_UNITS } from '../../../shared/constants';
import { type CacheEntry } from '../../../shared/models/asset.model';
import { ArchiveService } from '../../../shared/services/archive/ArchiveService';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { cacheService } from '../../../shared/services/cache/CacheService';
import {
  ASSET_TYPES,
  COLLECTION_ASSET_TYPES,
  type AssetType,
} from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';

export interface BulkDeleteRequest {
  assets: Array<{
    type: AssetType;
    id: string;
  }>;
  reason?: string;
  deletedBy: string;
}

export interface BulkDeleteResult {
  deleted: {
    total: number;
    byType: Record<AssetType, number>;
  };
  archived: {
    total: number;
    byType: Record<AssetType, number>;
  };
  errors: Array<{
    assetType: AssetType;
    assetId: string;
    error: string;
  }>;
  startTime: number;
  endTime: number;
  duration: number;
}

export class BulkDeleteService {
  private readonly archiveService: ArchiveService;

  constructor(private readonly quickSightService: QuickSightService) {
    const bucketName = process.env.BUCKET_NAME || 'quicksight-metadata-bucket';
    this.archiveService = new ArchiveService(bucketName, cacheService);
  }

  /**
   * Delete multiple assets with automatic archiving
   */
  public async deleteAssets(request: BulkDeleteRequest): Promise<BulkDeleteResult> {
    const startTime = Date.now();
    const result: BulkDeleteResult = {
      deleted: {
        total: 0,
        byType: {} as Record<AssetType, number>,
      },
      archived: {
        total: 0,
        byType: {} as Record<AssetType, number>,
      },
      errors: [],
      startTime,
      endTime: 0,
      duration: 0,
    };

    // Initialize counters for all asset types
    Object.values(ASSET_TYPES).forEach((type) => {
      result.deleted.byType[type] = 0;
      result.archived.byType[type] = 0;
    });

    logger.info('Starting bulk delete operation', {
      assetCount: request.assets.length,
      reason: request.reason,
      deletedBy: request.deletedBy,
    });

    // Group assets by type for more efficient processing
    const assetsByType = this.groupAssetsByType(request.assets);

    // Process each asset type with concurrency control
    const deleteLimit = pLimit(EXPORT_CONFIG.s3Operations.maxConcurrentArchiveOps);
    const assetsToArchive: Array<{
      assetType: AssetType;
      assetId: string;
      archiveReason?: string;
      archivedBy?: string;
    }> = [];

    for (const [assetType, assetIds] of Object.entries(assetsByType)) {
      logger.info(`Processing ${assetIds.length} ${assetType} assets for deletion`);

      const deletePromises = assetIds.map((assetId) =>
        deleteLimit(async () => {
          try {
            // First, try to delete from QuickSight
            await this.deleteFromQuickSight(assetType as AssetType, assetId);
            result.deleted.byType[assetType as AssetType]++;
            result.deleted.total++;

            // Track asset for bulk archiving
            assetsToArchive.push({
              assetType: assetType as AssetType,
              assetId,
              archiveReason: request.reason || 'Bulk delete operation',
              archivedBy: request.deletedBy,
            });

            logger.info(`Successfully deleted ${assetType} ${assetId} from QuickSight`);
          } catch (deleteError: any) {
            // QuickSight deletion failed - do not archive
            logger.error(`Failed to delete ${assetType} ${assetId} from QuickSight`, {
              error: deleteError.message,
            });
            result.errors.push({
              assetType: assetType as AssetType,
              assetId,
              error: deleteError.message || 'Unknown error',
            });
          }
        })
      );

      await Promise.all(deletePromises);
    }

    // Archive all successfully deleted assets in bulk
    if (assetsToArchive.length > 0) {
      try {
        logger.info(`Archiving ${assetsToArchive.length} successfully deleted assets in bulk`);
        await this.archiveService.archiveAssetsBulk(assetsToArchive);

        // Update archived counts
        for (const asset of assetsToArchive) {
          result.archived.byType[asset.assetType]++;
          result.archived.total++;
        }

        logger.info(`Successfully archived ${assetsToArchive.length} assets`);
      } catch (archiveError: any) {
        logger.error('Failed to bulk archive assets', { error: archiveError });
        // Add error for each asset that failed to archive
        for (const asset of assetsToArchive) {
          result.errors.push({
            assetType: asset.assetType,
            assetId: asset.assetId,
            error: `Deleted from QuickSight but archive failed: ${archiveError.message}`,
          });
        }
      }
    }

    const endTime = Date.now();
    result.endTime = endTime;
    result.duration = endTime - startTime;

    logger.info('Bulk delete operation completed', {
      deleted: result.deleted.total,
      archived: result.archived.total,
      errors: result.errors.length,
      duration: `${(result.duration / TIME_UNITS.SECOND).toFixed(2)}s`,
    });

    return result;
  }

  /**
   * Validate if assets can be deleted
   * Check for dependencies, permissions, etc.
   */
  public async validateDeletion(assets: Array<{ type: AssetType; id: string }>): Promise<{
    canDelete: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Extract IDs for different asset types
    const datasetIds = assets.filter((a) => a.type === ASSET_TYPES.dataset).map((a) => a.id);
    const datasourceIds = assets.filter((a) => a.type === ASSET_TYPES.datasource).map((a) => a.id);

    // Check dependencies in parallel where possible
    await Promise.all([
      this.checkDatasetDependencies(datasetIds, warnings),
      this.checkDatasourceDependencies(datasourceIds, warnings),
    ]);

    // Validate collection assets
    this.validateCollectionAssets(assets, errors);

    return {
      canDelete: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Check asset dependencies for a specific dependency type
   */
  private checkAssetDependencies(
    assets: CacheEntry[],
    dependencyIds: string[],
    assetTypeLabel: string,
    dependencyTypeLabel: string,
    warnings: string[]
  ): void {
    for (const asset of assets) {
      const datasetIds = asset.metadata?.lineageData?.datasetIds || [];
      for (const dependencyId of dependencyIds) {
        if (datasetIds.includes(dependencyId)) {
          warnings.push(
            `${assetTypeLabel} "${asset.assetName}" uses ${dependencyTypeLabel} "${dependencyId}"`
          );
        }
      }
    }
  }

  /**
   * Check if dashboards or analyses depend on datasets being deleted
   */
  private async checkDatasetDependencies(datasetIds: string[], warnings: string[]): Promise<void> {
    if (datasetIds.length === 0) {
      return;
    }

    const [dashboardsResult, analysesResult] = await Promise.all([
      cacheService.getAssetsByType(ASSET_TYPES.dashboard),
      cacheService.getAssetsByType(ASSET_TYPES.analysis),
    ]);

    const dashboards = dashboardsResult.assets || [];
    const analyses = analysesResult.assets || [];

    this.checkAssetDependencies(dashboards, datasetIds, 'Dashboard', 'dataset', warnings);
    this.checkAssetDependencies(analyses, datasetIds, 'Analysis', 'dataset', warnings);
  }

  /**
   * Check if datasets depend on datasources being deleted
   */
  private async checkDatasourceDependencies(
    datasourceIds: string[],
    warnings: string[]
  ): Promise<void> {
    if (datasourceIds.length === 0) {
      return;
    }

    const datasetsResult = await cacheService.getAssetsByType(ASSET_TYPES.dataset);
    const datasets = datasetsResult.assets || [];

    for (const dataset of datasets) {
      const datasetDatasourceIds = dataset.metadata?.lineageData?.datasourceIds || [];
      const datasourceArns = dataset.metadata?.datasourceArns || [];

      for (const datasourceId of datasourceIds) {
        if (this.datasetUsesDatasource(datasetDatasourceIds, datasourceArns, datasourceId)) {
          warnings.push(`Dataset "${dataset.assetName}" uses datasource "${datasourceId}"`);
        }
      }
    }
  }

  /**
   * Check if a dataset uses a specific datasource
   */
  private datasetUsesDatasource(
    datasourceIds: string[],
    datasourceArns: string[],
    datasourceId: string
  ): boolean {
    return (
      datasourceIds.includes(datasourceId) ||
      datasourceArns.some((arn: string) => arn.includes(datasourceId))
    );
  }

  /**
   * Delete asset from QuickSight based on type
   */
  private async deleteFromQuickSight(assetType: AssetType, assetId: string): Promise<void> {
    switch (assetType) {
      case ASSET_TYPES.analysis:
        await this.quickSightService.deleteAnalysis(assetId);
        break;

      case ASSET_TYPES.dashboard:
        await this.quickSightService.deleteDashboard(assetId);
        break;

      case ASSET_TYPES.dataset:
        await this.quickSightService.deleteDataset(assetId);
        break;

      case ASSET_TYPES.datasource:
        await this.quickSightService.deleteDatasource(assetId);
        break;

      default:
        throw new Error(`Deletion not supported for asset type: ${assetType}`);
    }
  }

  /**
   * Group assets by type for batch processing
   */
  private groupAssetsByType(
    assets: Array<{ type: AssetType; id: string }>
  ): Record<AssetType, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const asset of assets) {
      if (!grouped[asset.type]) {
        grouped[asset.type] = [];
      }
      const typeArray = grouped[asset.type];
      if (typeArray) {
        typeArray.push(asset.id);
      }
    }

    return grouped as Record<AssetType, string[]>;
  }

  /**
   * Check for collection assets that cannot be deleted
   */
  private validateCollectionAssets(
    assets: Array<{ type: AssetType; id: string }>,
    errors: string[]
  ): void {
    const collectionAssets = assets.filter((a) => COLLECTION_ASSET_TYPES.includes(a.type));

    if (collectionAssets.length > 0) {
      errors.push(
        `Cannot delete collection assets: ${collectionAssets.map((a) => `${a.type}/${a.id}`).join(', ')}`
      );
    }
  }
}
