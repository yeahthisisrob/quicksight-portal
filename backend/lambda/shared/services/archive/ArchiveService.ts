import { STORAGE_CONVERSION } from '../../constants';
import { type AssetType } from '../../models/asset.model';
import { type ArchiveResult, type ArchiveStats } from '../../types/archiveTypes';
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import { ASSET_TYPES, ASSET_TYPES_PLURAL, isCollectionType } from '../../types/assetTypes';
import { logger } from '../../utils/logger';
import { S3Service } from '../aws/S3Service';
import { type CacheService } from '../cache/CacheService';

/**
 * Service for handling asset archiving operations
 * VSA Service Layer - orchestrates archiving business logic
 */
export class ArchiveService {
  private readonly s3Service: S3Service;

  constructor(
    private readonly bucketName: string,
    private readonly cacheService?: CacheService
  ) {
    // Create S3Service internally - proper service layer encapsulation
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.s3Service = new S3Service(accountId);
  }

  /**
   * Archive a single asset - coordinates both file and cache operations
   */
  public async archiveAsset(
    assetType: AssetType,
    assetId: string,
    archiveReason?: string,
    archivedBy?: string
  ): Promise<ArchiveResult> {
    try {
      // First check if asset exists and isn't already archived
      if (this.cacheService) {
        const assets = await this.cacheService.getCacheEntries({
          assetType,
          statusFilter: AssetStatusFilter.ALL,
        });
        const asset = assets.find((a) => a.assetId === assetId);

        if (!asset) {
          throw new Error(`Asset ${assetType}/${assetId} not found`);
        }

        // Check if truly archived (both status AND file location)
        if (asset.status === 'archived' && asset.exportFilePath?.includes('archived/')) {
          logger.info(`Asset ${assetType}/${assetId} is already properly archived, skipping`);
          return {
            success: true,
            assetId,
            assetType,
            originalPath: asset.exportFilePath,
            archivePath: asset.exportFilePath,
            archivedAt: asset.lastUpdatedTime?.toISOString() || new Date().toISOString(),
          };
        } else if (asset.status === 'archived' && !asset.exportFilePath?.includes('archived/')) {
          logger.warn(
            `Asset ${assetType}/${assetId} marked as archived but file at ${asset.exportFilePath} - proceeding with archive`
          );
          // Continue with archiving to fix the inconsistency
        }
      }

      // Archive the file
      const fileResult = isCollectionType(assetType)
        ? await this.archiveCollectionItem(
            assetType as 'user' | 'group' | 'folder',
            assetId,
            archiveReason,
            archivedBy
          )
        : await this.archiveIndividualAsset(assetType, assetId, archiveReason, archivedBy);

      // Update cache metadata to mark as archived
      if (this.cacheService && fileResult.success) {
        await this.updateCacheAfterArchive(assetType, assetId, archiveReason, archivedBy);
      }

      return fileResult;
    } catch (error) {
      logger.error(`Failed to archive asset ${assetType}/${assetId}`, { error });
      return {
        success: false,
        assetId,
        assetType,
        originalPath: `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`,
        archivePath: `archived/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`,
        archivedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Archive multiple assets in bulk
   */
  public async archiveAssetsBulk(
    assetsToArchive: Array<{
      assetType: AssetType;
      assetId: string;
      archiveReason?: string;
      archivedBy?: string;
    }>
  ): Promise<ArchiveResult[]> {
    const results: ArchiveResult[] = [];

    // Process each asset
    for (const asset of assetsToArchive) {
      const result = await this.archiveAsset(
        asset.assetType,
        asset.assetId,
        asset.archiveReason,
        asset.archivedBy
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Archive a collection asset (user, group, folder)
   * Moves the item from the active collection to the archived collection
   */
  public async archiveCollectionItem(
    assetType: AssetType,
    itemId: string,
    archiveReason?: string,
    archivedBy?: string
  ): Promise<ArchiveResult> {
    // Validate that this is a collection type
    if (!isCollectionType(assetType)) {
      throw new Error(`${assetType} is not a collection type. Use archiveIndividualAsset instead.`);
    }

    const collectionPath = `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`;
    const archivePath = `archived/organization/${ASSET_TYPES_PLURAL[assetType]}.json`;

    try {
      // Get the active collection file
      const activeCollection =
        (await this.s3Service.getObject(this.bucketName, collectionPath)) || {};

      if (!activeCollection[itemId]) {
        throw new Error(`Item ${itemId} not found in ${assetType} collection`);
      }

      // Get or create the archived collection
      let archivedCollection: Record<string, any> = {};
      try {
        archivedCollection = (await this.s3Service.getObject(this.bucketName, archivePath)) || {};
      } catch (_error) {
        // Archive collection doesn't exist yet, start with empty
        archivedCollection = {};
      }

      // Move the item to archived collection with metadata
      archivedCollection[itemId] = {
        ...activeCollection[itemId],
        archivedMetadata: {
          archivedAt: new Date().toISOString(),
          archiveReason,
          archivedBy,
          originalPath: `${collectionPath}#${itemId}`,
        },
      };

      // Remove from active collection
      delete activeCollection[itemId];

      // Save both collections
      await this.s3Service.putObject(this.bucketName, collectionPath, activeCollection);
      await this.s3Service.putObject(this.bucketName, archivePath, archivedCollection);

      logger.info(`Archived ${assetType} item ${itemId}`, {
        originalPath: collectionPath,
        archivePath,
        archiveReason,
      });

      return {
        success: true,
        assetId: itemId,
        assetType,
        originalPath: `${collectionPath}#${itemId}`,
        archivePath: `${archivePath}#${itemId}`,
        archivedAt: archivedCollection[itemId].archivedMetadata.archivedAt,
      };
    } catch (error) {
      logger.error(`Failed to archive ${assetType} item ${itemId}`, { error });
      return {
        success: false,
        assetId: itemId,
        assetType,
        originalPath: `${collectionPath}#${itemId}`,
        archivePath: `${collectionPath}#${itemId}`,
        archivedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Archive an individual asset (dashboard, dataset, analysis, datasource)
   * Moves the file from assets/ to archived/ directory
   */
  public async archiveIndividualAsset(
    assetType: AssetType,
    assetId: string,
    archiveReason?: string,
    archivedBy?: string,
    assetData?: any
  ): Promise<ArchiveResult> {
    const originalPath = `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`;
    const archivePath = `archived/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`;

    try {
      let dataToArchive = assetData;

      // If no data provided, load from original location
      if (!dataToArchive) {
        // Check if asset exists in original location
        const exists = await this.s3Service.objectExists(this.bucketName, originalPath);
        if (!exists) {
          // Check if already archived
          const archiveExists = await this.s3Service.objectExists(this.bucketName, archivePath);
          if (archiveExists) {
            logger.info(`Asset ${assetType}/${assetId} is already archived at ${archivePath}`);
            return {
              success: true,
              assetId,
              assetType,
              originalPath,
              archivePath,
              archivedAt: new Date().toISOString(),
            };
          }
          throw new Error(`Cannot archive asset that doesn't exist: ${originalPath}`);
        }

        // Get the asset data
        dataToArchive = await this.s3Service.getObject(this.bucketName, originalPath);
      }

      // Preserve existing archive metadata if it exists
      const existingMetadata = dataToArchive.archivedMetadata;

      // Add archive metadata
      const archivedData = {
        ...dataToArchive,
        archivedMetadata: existingMetadata || {
          archivedAt: new Date().toISOString(),
          archiveReason,
          archivedBy,
          originalPath,
        },
      };

      // Save to archive location first
      await this.s3Service.putObject(this.bucketName, archivePath, archivedData);

      // Verify the archive was created successfully before deleting original
      const archiveExists = await this.s3Service.objectExists(this.bucketName, archivePath);
      if (!archiveExists) {
        throw new Error(`Failed to verify archive creation at ${archivePath}`);
      }

      // Delete from original location
      await this.s3Service.deleteObject(this.bucketName, originalPath);

      logger.info(`Archived ${assetType} ${assetId}`, {
        originalPath,
        archivePath,
        archiveReason,
      });

      return {
        success: true,
        assetId,
        assetType,
        originalPath,
        archivePath,
        archivedAt: archivedData.archivedMetadata.archivedAt,
      };
    } catch (error) {
      logger.error(`Failed to archive ${assetType} ${assetId}`, { error });
      return {
        success: false,
        assetId,
        assetType,
        originalPath,
        archivePath,
        archivedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a specific archived asset
   */
  public async getArchivedAsset(assetType: AssetType, assetId: string): Promise<any | null> {
    try {
      if (isCollectionType(assetType)) {
        // For collection types, look in the archived collection
        const archivePath = `archived/organization/${ASSET_TYPES_PLURAL[assetType]}.json`;
        try {
          const archivedCollection = await this.s3Service.getObject(this.bucketName, archivePath);

          const item = archivedCollection[assetId];
          if (item) {
            return { id: assetId, ...item };
          }
        } catch (_error) {
          // Archive collection doesn't exist
        }
        return null;
      } else {
        // For individual types
        const archivePath = `archived/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`;
        const exists = await this.s3Service.objectExists(this.bucketName, archivePath);

        if (exists) {
          return await this.s3Service.getObject(this.bucketName, archivePath);
        }
        return null;
      }
    } catch (error) {
      logger.error(`Failed to get archived asset ${assetType}/${assetId}`, { error });
      return null;
    }
  }

  /**
   * Get all archived assets of a specific type
   */
  public async getArchivedAssets(assetType: AssetType): Promise<any[]> {
    try {
      if (isCollectionType(assetType)) {
        // For collection types, get from the archived collection file
        const archivePath = `archived/organization/${ASSET_TYPES_PLURAL[assetType]}.json`;
        try {
          const archivedCollection = await this.s3Service.getObject(this.bucketName, archivePath);

          return Object.entries(archivedCollection).map(([id, item]) => ({
            id,
            ...(item as object),
          }));
        } catch (_error) {
          // No archived collection file exists yet
          return [];
        }
      } else {
        // For individual types, list from archived directory
        const prefix = `archived/${ASSET_TYPES_PLURAL[assetType]}/`;
        const objects = await this.s3Service.listObjects(this.bucketName, prefix);

        const assets = [];
        for (const obj of objects) {
          if (obj.key?.endsWith('.json')) {
            const asset = await this.s3Service.getObject(this.bucketName, obj.key);
            assets.push(asset);
          }
        }

        return assets;
      }
    } catch (error) {
      logger.error(`Failed to get archived ${assetType} assets`, { error });
      return [];
    }
  }

  /**
   * Get archive statistics
   */
  public async getArchiveStatistics(): Promise<ArchiveStats> {
    try {
      const stats: ArchiveStats = {
        totalArchived: 0,
        totalSizeGB: 0,
        byType: {} as Record<AssetType, number>,
        oldestArchive: '',
        growthRateGB: 0,
      };

      // Get stats for individual archived assets
      const individualTypes = Object.values(ASSET_TYPES).filter((type) => !isCollectionType(type));
      let oldestDate = new Date();

      for (const type of individualTypes) {
        const prefix = `archived/${ASSET_TYPES_PLURAL[type]}/`;
        const objects = await this.s3Service.listObjects(this.bucketName, prefix);

        stats.byType[type] = objects.length;
        stats.totalArchived += objects.length;

        for (const obj of objects) {
          if (obj.size) {
            stats.totalSizeGB += obj.size / STORAGE_CONVERSION.BYTES_PER_GB;
          }
          if (obj.lastModified && obj.lastModified < oldestDate) {
            oldestDate = obj.lastModified;
          }
        }
      }

      // Get stats for collection archived items
      const collectionTypes = Object.values(ASSET_TYPES).filter((type) => isCollectionType(type));
      for (const type of collectionTypes) {
        const archivePath = `archived/organization/${ASSET_TYPES_PLURAL[type]}.json`;
        try {
          const archivedCollection = await this.s3Service.getObject(this.bucketName, archivePath);
          const archivedCount = Object.keys(archivedCollection).length;

          stats.byType[type] = archivedCount;
          stats.totalArchived += archivedCount;

          // Also check file size
          const objectInfo = await this.s3Service.listObjects(this.bucketName, archivePath);
          if (objectInfo.length > 0 && objectInfo[0]?.size) {
            stats.totalSizeGB += objectInfo[0].size / STORAGE_CONVERSION.BYTES_PER_GB;
          }
        } catch (_error) {
          // No archived collection exists
          stats.byType[type] = 0;
        }
      }

      stats.oldestArchive = oldestDate.toISOString();

      return stats;
    } catch (error) {
      logger.error('Failed to get archive statistics', { error });
      throw error;
    }
  }

  /**
   * Update cache index after successful archive operation.
   *
   * Delegates to the shared CacheService.archiveAssetsInCache() so that
   * all live mutation paths (bulk delete, archive during export detection,
   * demo cleanup, etc.) use the exact same DRY logic for:
   *   - status flip to 'archived' (ACTIVE lists hide it)
   *   - correct exportFilePath + archive metadata
   *   - persisting the per-type S3 cache files (readers' source of truth)
   *   - evicting memory keys + freshness for the current process
   *
   * The file move (assets/ → archived/) is already performed by the caller.
   * Keeping the CacheEntry (with archived status) allows archived listings,
   * restore previews, and stats to continue working from the unified cache.
   */
  private async updateCacheAfterArchive(
    assetType: AssetType,
    assetId: string,
    archiveReason?: string,
    archivedBy?: string
  ): Promise<void> {
    if (!this.cacheService) {
      return;
    }

    try {
      await this.cacheService.archiveAssetsInCache([
        {
          assetType,
          assetId,
          archiveReason,
          archivedBy,
        },
      ]);

      logger.info(
        `Updated cache index for archived asset ${assetType}/${assetId} (via shared archiveAssetsInCache)`
      );
    } catch (error) {
      logger.error(`Failed to update cache after archiving ${assetType}/${assetId}`, { error });
      // Don't throw - the file was successfully moved to archived/; cache index update is best-effort
    }
  }
}
