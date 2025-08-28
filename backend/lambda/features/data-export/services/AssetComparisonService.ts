import { AssetStatus, type CacheEntry } from '../../../shared/models/asset.model';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { type JobStateService } from '../../../shared/services/jobs/JobStateService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { logger } from '../../../shared/utils/logger';
import { type AssetType, type AssetSummary } from '../types';

/**
 * Service for comparing assets with cache and detecting changes/deletions
 * Optimized for Lambda with lazy initialization and dependency injection for testing
 */
export class AssetComparisonService {
  private readonly cacheService: CacheService;
  private jobId: string = '';
  private jobStateService: JobStateService | null = null;

  /**
   * Constructor allows dependency injection for testing while maintaining Lambda optimization
   * @param cacheService - Optional cache service instance (defaults to singleton for production)
   */
  constructor(cacheService?: CacheService) {
    // Use injected service for testing, or lazy-load singleton for production Lambda
    this.cacheService = cacheService || CacheService.getInstance();
  }

  /**
   * Compare assets with cache and detect all changes including deletions
   * Combines comparison and deletion detection into a single operation
   */
  public async compareAndDetectChanges(
    assetType: AssetType,
    allAssetsToProcess: Array<{
      id: string;
      name: string;
      arn: string;
      lastModified: string | undefined;
      created: string | undefined;
      status: 'UPDATED';
      originalSummary: any;
    }>,
    deletedAssets: any[],
    forceRefresh: boolean
  ): Promise<{
    needsUpdate: Set<string>;
    unchanged: Set<string>;
    deletedAssetIds: Set<string>;
  }> {
    if (this.jobStateService) {
      await this.jobStateService.logInfo(
        this.jobId,
        `Comparing with existing cache to detect deleted assets`,
        { assetType }
      );
    }

    // Detect deleted assets (archiving happens in orchestrator)
    const deletedAssetIds = await this.detectDeletedAssets(
      assetType,
      allAssetsToProcess,
      deletedAssets
    );

    if (this.jobStateService) {
      await this.jobStateService.logInfo(
        this.jobId,
        `Comparing ${allAssetsToProcess.length} assets with cache`,
        { assetType }
      );
    }

    // Compare with cache to find which need updates
    const comparisonResult = await this.compareWithCache(
      assetType,
      allAssetsToProcess,
      forceRefresh
    );

    return {
      ...comparisonResult,
      deletedAssetIds,
    };
  }

  /**
   * Compare a list of assets with the cache to determine which need updates
   * Uses the in-memory cache from CacheService
   * @returns Sets of asset IDs that need updates and those that are unchanged
   */
  public async compareWithCache(
    assetType: AssetType,
    assets: Array<{
      id: string;
      name: string;
      arn: string;
      lastModified: string | undefined;
      originalSummary: any;
    }>,
    forceRefresh: boolean = false
  ): Promise<{
    needsUpdate: Set<string>;
    unchanged: Set<string>;
  }> {
    const needsUpdate = new Set<string>();
    const unchanged = new Set<string>();

    if (forceRefresh) {
      // Force refresh - all assets need update
      assets.forEach((asset) => needsUpdate.add(asset.id));
      return { needsUpdate, unchanged };
    }

    // Get only the specific asset type cache we need (not all types)
    const cachedEntries = await this.cacheService.getTypeCache(assetType);

    if (!cachedEntries || cachedEntries.length === 0) {
      // No cache exists yet - all assets need export
      logger.info(`No cache found for ${assetType} - all ${assets.length} assets need export`);
      assets.forEach((asset) => needsUpdate.add(asset.id));
      return { needsUpdate, unchanged };
    }

    // Build map for quick lookup of cached entries
    const cacheMap = new Map(cachedEntries.map((c) => [c.assetId, c]));

    // Check each asset against cache
    for (const asset of assets) {
      const cachedEntry = cacheMap.get(asset.id);

      // Organizational assets (folders, groups, users) need special handling:
      // - Groups/Users: don't have LastUpdatedTime in List API response
      // - Folders: have LastUpdatedTime but it doesn't change when members/permissions change
      // For these asset types, we must always refresh to catch all changes
      const isOrganizationalAsset =
        assetType === 'folder' || assetType === 'group' || assetType === 'user';

      if (!cachedEntry) {
        // New asset not in cache
        needsUpdate.add(asset.id);
        logger.debug(`Asset ${asset.id} not in cache - marking for export`);
      } else if (isOrganizationalAsset) {
        // Always refresh organizational assets since we can't reliably detect changes
        needsUpdate.add(asset.id);
        logger.debug(`${assetType} ${asset.id} - always refresh (organizational asset)`);
      } else if (!cachedEntry.lastUpdatedTime && !asset.lastModified) {
        // Both have no lastUpdatedTime - consider unchanged for non-organizational assets
        unchanged.add(asset.id);
      } else if (!cachedEntry.lastUpdatedTime || !asset.lastModified) {
        // One has lastUpdatedTime and other doesn't - needs update
        needsUpdate.add(asset.id);
        logger.debug(`Asset ${asset.id} missing timestamp - marking for export`);
      } else {
        // Compare timestamps
        const cachedTime = new Date(cachedEntry.lastUpdatedTime).getTime();
        const assetTime = new Date(asset.lastModified).getTime();

        if (assetTime > cachedTime) {
          needsUpdate.add(asset.id);
          logger.debug(
            `Asset ${asset.id} modified (${asset.lastModified} > ${cachedEntry.lastUpdatedTime}) - marking for export`
          );
        } else {
          unchanged.add(asset.id);
        }
      }
    }

    return { needsUpdate, unchanged };
  }

  /**
   * Detect assets that have been deleted from QuickSight
   * Handles both:
   * 1. Hard deletes - asset no longer in list (dashboards, datasets, etc.)
   * 2. Soft deletes - asset has Status='DELETED' (analyses only)
   * 3. Inconsistent states - assets marked archived but files not moved
   * Returns the IDs of deleted assets (does NOT archive them - that's the orchestrator's job)
   */
  public async detectDeletedAssets(
    assetType: AssetType,
    currentAssets: Array<{ id: string; name: string }>,
    softDeletedAssets: AssetSummary[] = []
  ): Promise<Set<string>> {
    const deletedAssetIds = new Set<string>();

    logger.info(`Starting deletion detection for ${assetType}:`, {
      currentAssetsCount: currentAssets.length,
    });

    try {
      // Get ALL assets from cache (including archived ones)
      const masterCache = await this.cacheService.getMasterCache({
        statusFilter: AssetStatusFilter.ALL,
      });
      const allCachedAssets = masterCache.entries[assetType] || [];

      if (!allCachedAssets || allCachedAssets.length === 0) {
        logger.debug(`No existing cache for ${assetType} - nothing to detect as deleted`);
        return deletedAssetIds;
      }

      // Build set of current asset IDs for quick lookup
      const currentAssetIds = new Set(currentAssets.map((a) => a.id));

      // Process hard-deleted assets
      await this.processHardDeletedAssets(
        allCachedAssets,
        currentAssetIds,
        assetType,
        deletedAssetIds
      );

      // Process soft-deleted assets (analyses only)
      if (softDeletedAssets.length > 0 && assetType === 'analysis') {
        await this.processSoftDeletedAssets(
          allCachedAssets,
          softDeletedAssets,
          assetType,
          deletedAssetIds
        );
      }

      if (deletedAssetIds.size > 0) {
        logger.info(`Detected ${deletedAssetIds.size} deleted ${assetType} assets to be archived`);
      }
    } catch (error) {
      logger.error(`Failed to detect deleted ${assetType} assets:`, error);
      if (this.jobStateService) {
        await this.jobStateService.logError(
          this.jobId,
          `Error: Failed to detect deleted ${assetType} assets`,
          { assetType }
        );
      }
    }

    return deletedAssetIds;
  }

  /**
   * Process assets to prepare them for comparison
   * Assets are already in domain format (camelCase)
   */
  public prepareAssetsForComparison(
    activeAssets: AssetSummary[],
    assetType: AssetType,
    getAssetId: (asset: AssetSummary, type: AssetType) => string,
    getAssetName: (asset: AssetSummary, type: AssetType) => string
  ): Array<{
    id: string;
    name: string;
    arn: string;
    lastModified: string | undefined;
    created: string | undefined;
    status: 'UPDATED';
    originalSummary: AssetSummary;
  }> {
    return activeAssets.map((asset) => ({
      id: getAssetId(asset, assetType),
      name: getAssetName(asset, assetType),
      arn: asset.arn || '',
      lastModified: asset.lastUpdatedTime?.toISOString() || asset.createdTime?.toISOString(),
      created: asset.createdTime?.toISOString(),
      status: 'UPDATED' as const,
      originalSummary: asset,
    }));
  }

  /**
   * Set the job context for logging
   */
  public setJobContext(jobStateService: JobStateService, jobId: string): void {
    this.jobStateService = jobStateService;
    this.jobId = jobId;
  }

  /**
   * Deduplicate cache entries by assetId, keeping the most recent entry
   * This handles cases where there are duplicate entries (e.g., active + archived)
   */
  private deduplicateCacheEntries(assets: CacheEntry[]): CacheEntry[] {
    const assetMap = new Map<string, CacheEntry>();

    for (const asset of assets) {
      const existingAsset = assetMap.get(asset.assetId);

      if (!existingAsset) {
        // First entry for this assetId
        assetMap.set(asset.assetId, asset);
      } else {
        // Keep the more recent entry, prioritizing archived status if both have same timestamp
        const existingTime = existingAsset.lastUpdatedTime?.getTime() || 0;
        const currentTime = asset.lastUpdatedTime?.getTime() || 0;

        if (currentTime > existingTime) {
          // Current asset is newer
          assetMap.set(asset.assetId, asset);
        } else if (currentTime === existingTime && asset.status === AssetStatus.ARCHIVED) {
          // Same timestamp but current is archived - prefer archived status
          assetMap.set(asset.assetId, asset);
        }
        // Otherwise keep the existing one
      }
    }

    const deduplicatedAssets = Array.from(assetMap.values());

    if (deduplicatedAssets.length < assets.length) {
      logger.info(
        `Deduplicated cache entries: ${assets.length} → ${deduplicatedAssets.length} (removed ${assets.length - deduplicatedAssets.length} duplicates)`
      );
    }

    return deduplicatedAssets;
  }

  /**
   * Process hard-deleted assets (in cache but not in current list)
   */
  private async processHardDeletedAssets(
    allCachedAssets: CacheEntry[],
    currentAssetIds: Set<string>,
    assetType: AssetType,
    deletedAssetIds: Set<string>
  ): Promise<void> {
    // Deduplicate cache entries by assetId, keeping the most recent entry
    const deduplicatedAssets = this.deduplicateCacheEntries(allCachedAssets);
    const activeInCache = deduplicatedAssets.filter((a) => a.status !== AssetStatus.ARCHIVED);
    const SAMPLE_SIZE = 5;

    logger.info(`Processing ${assetType} deletion detection:`, {
      totalInCache: allCachedAssets.length,
      activeInCache: activeInCache.length,
      archivedInCache: allCachedAssets.filter((a) => a.status === AssetStatus.ARCHIVED).length,
      activeInQuickSight: currentAssetIds.size,
      sampleCachedIds: activeInCache
        .slice(0, SAMPLE_SIZE)
        .map((a) => ({ id: a.assetId, status: a.status })),
      sampleCurrentIds: Array.from(currentAssetIds).slice(0, SAMPLE_SIZE),
    });

    for (const cached of deduplicatedAssets) {
      // Check if asset is missing from QuickSight
      if (cached.assetId && !currentAssetIds.has(cached.assetId)) {
        // If marked as archived but file hasn't been moved, it's inconsistent
        if (cached.status === AssetStatus.ARCHIVED) {
          // Check if the file path indicates it's not actually archived
          if (cached.exportFilePath && !cached.exportFilePath.includes('archived/')) {
            logger.warn(
              `Asset ${cached.assetId} marked as archived but file still in assets/ path: ${cached.exportFilePath} - treating as deleted`
            );
            // Reset status and track for archiving
            await this.trackDeletedAsset(cached, assetType, deletedAssetIds, false);
          }
        } else {
          // Normal case - active asset that's been deleted
          logger.info(
            `Asset ${cached.assetId} is in cache but not in QuickSight - marking for archival`
          );
          await this.trackDeletedAsset(cached, assetType, deletedAssetIds, false);
        }
      }
    }

    if (deletedAssetIds.size === 0 && activeInCache.length > currentAssetIds.size) {
      const MAX_MISSING_TO_LOG = 10;
      logger.warn(
        `No deletions detected but cache has ${activeInCache.length} active assets while QuickSight has ${currentAssetIds.size}`,
        {
          missingFromQuickSight: activeInCache
            .filter((c) => !currentAssetIds.has(c.assetId))
            .slice(0, MAX_MISSING_TO_LOG)
            .map((c) => ({ id: c.assetId, name: c.assetName, status: c.status })),
        }
      );
    }
  }

  /**
   * Process soft-deleted assets (analyses with Status='DELETED')
   */
  private async processSoftDeletedAssets(
    allCachedAssets: CacheEntry[],
    softDeletedAssets: AssetSummary[],
    assetType: AssetType,
    deletedAssetIds: Set<string>
  ): Promise<void> {
    const cachedAssetsMap = new Map(allCachedAssets.map((c) => [c.assetId, c]));

    for (const asset of softDeletedAssets) {
      const assetId = (asset as any).AnalysisId || (asset as any).analysisId;
      if (!assetId) {
        continue;
      }

      const cachedAsset = cachedAssetsMap.get(assetId);
      if (cachedAsset?.status === AssetStatus.ARCHIVED) {
        continue;
      }

      await this.trackDeletedAsset(
        { assetId, assetName: (asset as any).Name || (asset as any).name || assetId } as CacheEntry,
        assetType,
        deletedAssetIds,
        true
      );
    }
  }

  /**
   * Track a deleted asset for later archiving
   * This method only detects and tracks - actual archiving is handled by ArchiveService
   */
  private async trackDeletedAsset(
    asset: Pick<CacheEntry, 'assetId' | 'assetName'>,
    assetType: AssetType,
    deletedAssetIds: Set<string>,
    isSoftDeleted: boolean
  ): Promise<void> {
    const assetId = asset.assetId;
    const logPrefix = isSoftDeleted ? 'soft-deleted' : 'deleted';

    logger.info(`Detected ${logPrefix} ${assetType}: ${assetId} (${asset.assetName})`);

    // Just track the deleted asset ID - actual archiving happens in ExportOrchestrator
    deletedAssetIds.add(assetId);

    if (this.jobStateService) {
      await this.jobStateService.logInfo(
        this.jobId,
        `Detected ${logPrefix} ${assetType}: ${asset.assetName}`,
        { assetType, assetId }
      );
    }
  }
}
