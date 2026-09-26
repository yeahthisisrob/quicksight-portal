/**
 * BulkDeleteService - Service for handling bulk asset deletion with automatic archiving
 * Follows VSA pattern and reuses existing deletion/archiving logic
 */
import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import { TIME_UNITS } from '../../../shared/constants';
import type { CacheEntry } from '../../../shared/models/asset.model';
import { ArchiveService } from '../../../shared/services/archive/ArchiveService';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { cacheService } from '../../../shared/services/cache/CacheService';
import {
  ASSET_TYPES,
  type AssetType,
  COLLECTION_ASSET_TYPES,
} from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';

interface BulkDeleteRequest {
  assets: Array<{
    type: AssetType;
    id: string;
  }>;
  reason?: string;
  deletedBy: string;
}

interface BulkDeleteResult {
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

/** Re-export these assets from QuickSight (the worker hands in the export's refresh). */
export type RefreshAssets = (
  assets: Array<{ assetType: AssetType; assetId: string }>
) => Promise<{ refreshed: string[]; missing: string[]; failed: string[] }>;

export class BulkDeleteService {
  private readonly archiveService: ArchiveService;

  public constructor(
    private readonly quickSightService: QuickSightService,
    private readonly refreshAssets?: RefreshAssets
  ) {
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

    const reason = request.reason || 'Bulk delete operation';
    const individual = request.assets.filter((a) => !COLLECTION_ASSET_TYPES.includes(a.type));
    const collection = request.assets.filter((a) => COLLECTION_ASSET_TYPES.includes(a.type));

    // The archive is what a restore reads, so bring each export record up to
    // date first: it then keeps the audience, tags and definition QuickSight
    // has now, not what the last export saw.
    await this.refreshBeforeDelete(individual);

    const deleteLimit = pLimit(EXPORT_CONFIG.s3Operations.maxConcurrentArchiveOps);
    await Promise.all(
      individual.map((asset) =>
        deleteLimit(() => this.deleteOne(asset.type, asset.id, reason, request.deletedBy, result))
      )
    );

    // Folders, users and groups: deleted, then moved within their collection file.
    const collectionDeleted: Array<{
      assetType: AssetType;
      assetId: string;
      archiveReason?: string;
      archivedBy?: string;
    }> = [];
    await Promise.all(
      collection.map((asset) =>
        deleteLimit(async () => {
          try {
            await this.deleteFromQuickSight(asset.type, asset.id);
            result.deleted.byType[asset.type]++;
            result.deleted.total++;
            collectionDeleted.push({
              assetType: asset.type,
              assetId: asset.id,
              archiveReason: reason,
              archivedBy: request.deletedBy,
            });
          } catch (deleteError: any) {
            result.errors.push({
              assetType: asset.type,
              assetId: asset.id,
              error: deleteError.message || 'Unknown error',
            });
          }
        })
      )
    );
    if (collectionDeleted.length > 0) {
      const archived = await this.archiveService.archiveAssetsBulk(collectionDeleted);
      for (const outcome of archived) {
        if (outcome.success) {
          result.archived.byType[outcome.assetType as AssetType]++;
          result.archived.total++;
        } else {
          result.errors.push({
            assetType: outcome.assetType as AssetType,
            assetId: outcome.assetId,
            error: `Deleted from QuickSight but not archived: ${outcome.error ?? 'unknown error'}`,
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

  private async refreshBeforeDelete(assets: Array<{ type: AssetType; id: string }>) {
    if (!this.refreshAssets || assets.length === 0) {
      return;
    }
    try {
      const refreshed = await this.refreshAssets(
        assets.map((a) => ({ assetType: a.type, assetId: a.id }))
      );
      if (refreshed.failed.length > 0) {
        logger.warn(
          'Some assets could not be re-exported before delete; the archive keeps their last export',
          {
            failed: refreshed.failed,
          }
        );
      }
    } catch (error) {
      logger.warn('Re-export before delete failed; the archive keeps the last export', { error });
    }
  }

  /**
   * One asset, restore-safe: a copy goes into the archive first, then
   * QuickSight deletes it; if QuickSight refuses, the archive is put back
   * as it was. With no copy to keep, it is not deleted at all.
   */
  private async deleteOne(
    assetType: AssetType,
    assetId: string,
    reason: string,
    deletedBy: string,
    result: BulkDeleteResult
  ): Promise<void> {
    const kept = await this.archiveService.keepCopy(assetType, assetId, reason, deletedBy);
    if (!kept.kept) {
      result.errors.push({ assetType, assetId, error: `Not deleted: ${kept.error}` });
      return;
    }
    try {
      await this.deleteFromQuickSight(assetType, assetId);
    } catch (deleteError: any) {
      await this.archiveService.abandonArchive(assetType, assetId, kept.replaced);
      logger.error(`Failed to delete ${assetType} ${assetId} from QuickSight`, {
        error: deleteError.message,
      });
      result.errors.push({ assetType, assetId, error: deleteError.message || 'Unknown error' });
      return;
    }
    result.deleted.byType[assetType]++;
    result.deleted.total++;
    try {
      await this.archiveService.finishArchive(assetType, assetId, reason, deletedBy);
      result.archived.byType[assetType]++;
      result.archived.total++;
    } catch (error: any) {
      // The copy is in the archive; only the live file or the cache lags.
      result.errors.push({
        assetType,
        assetId,
        error: `Deleted and archived, but its live record could not be cleared: ${error?.message}`,
      });
    }
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
