/**
 * CacheService - Main orchestrator for all caching operations
 * VSA Pattern - Service Layer
 */
import { EventEmitter } from 'events';

import { MemoryCacheAdapter } from './adapters/MemoryCacheAdapter';
import { CacheReader } from './CacheReader';
import { S3Service } from '../aws/S3Service';
import { S3CacheAdapter } from './adapters/S3CacheAdapter';
import { CACHE_CONFIG, STATUS_CODES } from '../../constants';
import { type AssetType, type CacheEntry, type MasterCache } from '../../models/asset.model';
import {
  AssetStatusFilter,
  DEFAULT_STATUS_FILTER,
  type CacheFilterOptions,
} from '../../types/assetFilterTypes';
import { ASSET_TYPES } from '../../types/assetTypes';
import {
  type ExportSummary,
  type AssetTypeCounts,
  type FieldStatistics,
} from '../../types/exportSummaryTypes';
import { logger } from '../../utils/logger';
import { SingleFlight } from '../../utils/singleFlight';

/**
 * Main CacheService - coordinates all caching operations
 */
export class CacheService extends EventEmitter {
  private static instance: CacheService;
  private static s3Service: S3Service | null = null;
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private bucketName: string;
  private readonly cacheReader: CacheReader;
  private cacheWriter: any = null; // Type any to avoid circular import
  // Coalesces concurrent get() calls for the same key (one S3 HEAD/GET per burst)
  private readonly getSingleFlight = new SingleFlight();
  private readonly memoryAdapter: MemoryCacheAdapter;
  private readonly s3Adapter: S3CacheAdapter;

  private readonly s3Service: S3Service;

  private constructor() {
    super();

    // Create or reuse S3 client and service
    if (!CacheService.s3Service) {
      const accountId = process.env.AWS_ACCOUNT_ID || '';
      CacheService.s3Service = new S3Service(accountId);
    }

    // Initialize adapters
    this.s3Service = CacheService.s3Service;
    this.s3Adapter = new S3CacheAdapter(this.s3Service);

    this.memoryAdapter = new MemoryCacheAdapter({
      maxSize: this.getMemoryCacheSize(),
      ttlMs: CACHE_CONFIG.MEMORY_TTL_MS,
      enableStats: true,
    });

    // Get bucket name from environment
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`;

    // Initialize reader and writer services
    this.cacheReader = new CacheReader(this.s3Adapter, this.memoryAdapter);
    // Lazy load CacheWriter to avoid circular dependency
    this.cacheWriter = null;
  }

  /**
   * High-level entry point for archiving assets in the index after a successful
   * delete from QuickSight + move of definition to archived/.
   *
   * This is the shared, DRY method that all "live delete" paths should use
   * (BulkDelete, future single deletes, demo cleanup, etc.).
   * It ensures the cache entry is updated with archived status (so ACTIVE lists
   * hide it while ARCHIVED lists + restore still see it) and that S3 type caches
   * + memory are kept consistent.
   */
  public async archiveAssetsInCache(
    assets: Array<{
      assetType: AssetType;
      assetId: string;
      archiveReason?: string;
      archivedBy?: string;
    }>
  ): Promise<void> {
    const writer = await this.getCacheWriter();
    return writer.archiveAssetsInCache(assets);
  }

  public async bulkUpdateAssetTags(
    assetType: AssetType,
    assetIds: string[],
    tags: Array<{ key: string; value: string }>
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.bulkUpdateAssetTags(assetType, assetIds, tags);
  }

  public async clearAllCaches(): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.clearAllCaches();
  }

  public async clearMemoryCache(): Promise<void> {
    await Promise.resolve(this.memoryAdapter.clear());
    logger.info('Cleared memory cache');
  }

  public async clearPendingSync(
    assetType: AssetType,
    assetId: string,
    components: string[]
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.clearPendingSync(assetType, assetId, components);
  }

  public destroy(): void {
    this.memoryAdapter.destroy();
    this.removeAllListeners();
  }

  /**
   * Get any object from cache by key.
   *
   * Memory-first with ETag revalidation: a memory hit is served directly only
   * within a short validation window; after that, a cheap S3 HEAD compares
   * ETags — matching serves memory, mismatching re-fetches. This keeps every
   * Lambda instance exactly as fresh as S3 with no manual invalidation
   * (no clear-memory endpoint, no per-mutation cache clearing).
   */
  public async get<T = any>(key: string): Promise<T | null> {
    return (await this.getWithEtag<T>(key)).value;
  }

  /**
   * Get activity cache
   */
  public async getActivityCache(): Promise<any | null> {
    return await this.get('cache/activity-cache.json');
  }

  /**
   * Get activity cache with its S3 ETag (version identifier)
   */
  public async getActivityCacheWithEtag(): Promise<{ value: any | null; etag?: string }> {
    return await this.getWithEtag('cache/activity-cache.json');
  }

  /**
   * Get activity persistence (historical dates)
   */
  public async getActivityPersistence(): Promise<any | null> {
    return await this.get('cache/activity-persistence.json');
  }

  /**
   * Get activity persistence with its S3 ETag (version identifier)
   */
  public async getActivityPersistenceWithEtag(): Promise<{ value: any | null; etag?: string }> {
    return await this.getWithEtag('cache/activity-persistence.json');
  }

  /**
   * Get all datasets from cache
   */
  public async getAllDatasets(): Promise<any[]> {
    const datasetsResult = await this.getAssetsByType(ASSET_TYPES.dataset);
    return datasetsResult.assets || [];
  }

  /**
   * Get archived asset counts using the filtering system
   */
  public async getArchivedAssetCounts(): Promise<AssetTypeCounts & { total: number }> {
    const archivedCounts: AssetTypeCounts & { total: number } = {
      dashboards: 0,
      datasets: 0,
      analyses: 0,
      datasources: 0,
      folders: 0,
      users: 0,
      groups: 0,
      total: 0,
    };

    try {
      // Use the efficient filtering system to get archived assets
      const archivedAssets = await this.getAssetsByStatus(AssetStatusFilter.ARCHIVED);

      // Count by type
      for (const asset of archivedAssets) {
        const typeKey = this.getAssetTypeCountKey(asset.assetType);
        if (typeKey && typeKey in archivedCounts) {
          (archivedCounts[typeKey] as number)++;
          archivedCounts.total++;
        }
      }
    } catch (error) {
      logger.debug('No archived assets found or error loading archived assets', { error });
    }

    return archivedCounts;
  }

  public async getAsset(assetType: AssetType, assetId: string): Promise<any> {
    return await this.cacheReader.getAsset(assetType, assetId);
  }

  // Delegate to CacheReader for read operations
  public async getAssets(options: any = {}): Promise<any> {
    return await this.cacheReader.searchAssets(options);
  }

  public async getAssetsByStatus(
    statusFilter: AssetStatusFilter = DEFAULT_STATUS_FILTER,
    options?: { assetType?: AssetType }
  ): Promise<CacheEntry[]> {
    return await this.getCacheEntries({
      assetType: options?.assetType,
      statusFilter,
    });
  }

  public async getAssetsByType(
    assetType: AssetType,
    options?: CacheFilterOptions
  ): Promise<{ assets: CacheEntry[]; metadata?: any }> {
    const statusFilter = options?.statusFilter || DEFAULT_STATUS_FILTER;
    return await this.cacheReader.getAssetsByType(assetType, { ...options, statusFilter });
  }

  public async getAssetsWithPendingSync(): Promise<any[]> {
    const masterCache = await this.getMasterCache();
    const assetsWithPendingSync: any[] = [];

    for (const [assetType, assets] of Object.entries(masterCache.entries)) {
      for (const asset of assets) {
        if (asset.enrichmentStatus === 'partial') {
          assetsWithPendingSync.push({
            ...asset,
            assetType,
          });
        }
      }
    }

    return assetsWithPendingSync;
  }

  /**
   * Get cache entries with unified filtering - can get single asset type or all types
   * @param options.assetType - Get specific asset type, or omit for all types
   * @param options.statusFilter - Filter by asset status (default: ACTIVE)
   */
  public async getCacheEntries(options?: {
    assetType?: AssetType;
    statusFilter?: AssetStatusFilter;
  }): Promise<CacheEntry[]> {
    return await this.cacheReader.getCacheEntries(options);
  }

  public getCacheReader(): any {
    return this.cacheReader;
  }

  // Lineage operations are handled during cache rebuild by CacheWriter
  // Deleted asset detection is handled during export by ExportOrchestrator

  public async getCacheStats(): Promise<any> {
    try {
      const s3Stats = await this.s3Adapter.getCacheStatistics();
      const memoryStats = this.memoryAdapter.getStats();

      return {
        s3: s3Stats,
        memory: memoryStats,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      return null;
    }
  }

  // Get cache writer for advanced operations
  public async getCacheWriter(): Promise<any> {
    if (!this.cacheWriter) {
      // eslint-disable-next-line import/no-cycle
      const { CacheWriter } = await import('./CacheWriter');
      this.cacheWriter = new CacheWriter(
        this.s3Adapter,
        this.memoryAdapter,
        this.s3Service,
        this.bucketName
      );
    }
    return this.cacheWriter;
  }

  /**
   * Get comprehensive export summary with asset counts and statistics
   */
  public async getExportSummary(): Promise<ExportSummary> {
    try {
      // Get metadata without loading all cache files
      const metadata = await this.cacheReader.getCacheMetadata();

      // Build asset type counts from metadata
      const assetTypeCounts: AssetTypeCounts = {
        dashboards: metadata.assetCounts?.dashboard || 0,
        datasets: metadata.assetCounts?.dataset || 0,
        analyses: metadata.assetCounts?.analysis || 0,
        datasources: metadata.assetCounts?.datasource || 0,
        folders: metadata.assetCounts?.folder || 0,
        users: metadata.assetCounts?.user || 0,
        groups: metadata.assetCounts?.group || 0,
      };

      // Get archived counts efficiently using the filtering system
      const archivedAssetCounts = await this.getArchivedAssetCounts();

      // Get field statistics efficiently
      const fieldStatistics = await this.getFieldStatistics();

      const totalAssets = Object.values(assetTypeCounts).reduce((sum, count) => sum + count, 0);

      return {
        totalAssets,
        exportedAssets: totalAssets,
        lastExportDate: metadata.lastUpdated ? new Date(metadata.lastUpdated).toISOString() : null,
        exportInProgress: false,
        needsInitialExport: false,
        assetTypeCounts,
        archivedAssetCounts,
        fieldStatistics,
        cacheVersion: metadata.version || 1,
        message: 'Export summary retrieved successfully',
      };
    } catch (error: any) {
      // Handle case where no cache exists
      if (error.message?.includes('No cache found') || error.name === 'NoSuchKey') {
        return this.getEmptyExportSummary();
      }
      logger.error('Failed to get export summary', { error });
      throw error;
    }
  }

  /**
   * Get field statistics efficiently from field cache
   */
  public async getFieldStatistics(): Promise<FieldStatistics | null> {
    try {
      const fieldCache = await this.searchFields({});
      if (!fieldCache || fieldCache.length === 0) {
        return null;
      }

      const calculatedFields = fieldCache.filter((f) => f.isCalculated).length;
      return {
        totalFields: fieldCache.length,
        totalCalculatedFields: calculatedFields,
        totalUniqueFields: fieldCache.length - calculatedFields,
      };
    } catch (error) {
      logger.debug('No field cache available, field statistics will be null', { error });
      return null;
    }
  }

  /**
   * Get ingestions from cache
   */
  public async getIngestions(): Promise<{ ingestions: any[]; metadata: any } | null> {
    try {
      // get() is memory-first with ETag revalidation — no extra layer needed.
      return await this.get('cache/ingestions.json');
    } catch (error) {
      logger.error('Failed to get ingestions from cache', { error });
      return null;
    }
  }

  // Job index operations - single cache file for all jobs
  public async getJobIndex(forceS3Fetch: boolean = false): Promise<any[]> {
    const cacheKey = 'jobs';

    try {
      // Try memory cache first (unless forcing S3 fetch)
      if (!forceS3Fetch) {
        const memoryResult = this.memoryAdapter.get(cacheKey);
        if (memoryResult && Array.isArray(memoryResult)) {
          return memoryResult;
        }
      }

      // Try S3 cache
      const s3Result = await this.s3Service.getObject<any[]>(
        this.bucketName,
        `cache/${cacheKey}.json`
      );

      if (s3Result) {
        // Store in memory cache for faster access
        this.memoryAdapter.set(cacheKey, s3Result);
        return s3Result;
      }

      return [];
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get master cache with flexible status filtering
   * @param options.statusFilter - Filter by asset status (default: ACTIVE - most common use case)
   */
  public async getMasterCache(options?: {
    statusFilter?: AssetStatusFilter;
  }): Promise<MasterCache> {
    const statusFilter = options?.statusFilter || DEFAULT_STATUS_FILTER;

    // Delegate to CacheReader which handles memory caching and S3 access
    return await this.cacheReader.getMasterCache({ statusFilter });
  }

  /**
   * Master cache plus a version string derived from the per-type S3 ETags —
   * changes iff any underlying type cache changed. Safe memoization key for
   * data derived from the master cache.
   */
  public async getMasterCacheWithVersion(options?: {
    statusFilter?: AssetStatusFilter;
  }): Promise<{ cache: MasterCache; version: string }> {
    const statusFilter = options?.statusFilter || DEFAULT_STATUS_FILTER;
    return await this.cacheReader.getMasterCacheWithVersion({ statusFilter });
  }

  public async getTypeCache(assetType: AssetType): Promise<CacheEntry[]> {
    return await this.getCacheEntries({ assetType });
  }

  /**
   * Like get(), but also returns the S3 ETag the value was validated against.
   * The ETag serves as a cheap version identifier for derived-data memoization.
   */
  public getWithEtag<T = any>(key: string): Promise<{ value: T | null; etag?: string }> {
    // Coalesced: concurrent callers for the same key share one flight
    return this.getSingleFlight.run(key, async () => {
      try {
        const cached = this.memoryAdapter.getValidatedEntry<T>(key);
        if (cached) {
          if (Date.now() - cached.validatedAt < CACHE_CONFIG.REVALIDATE_WINDOW_MS) {
            return { value: cached.value, etag: cached.etag };
          }
          const verdict = await this.revalidateAgainstS3(key, cached.etag);
          if (verdict === 'fresh') {
            this.memoryAdapter.markValidated(key);
            return { value: cached.value, etag: cached.etag };
          }
          if (verdict === 'missing') {
            this.memoryAdapter.delete(key);
            return { value: null };
          }
          if (verdict === 'unknown') {
            // Transient HEAD failure — serve the (possibly slightly stale) copy
            // rather than failing the read.
            return { value: cached.value, etag: cached.etag };
          }
          // 'stale' → fall through to a fresh GET
        }

        const result = await this.s3Service
          .getObjectWithETag<T>(this.bucketName, key)
          .catch(() => null);
        if (!result || result.data === null || result.data === undefined) {
          return { value: null };
        }
        const data = typeof result.data === 'string' ? (JSON.parse(result.data) as T) : result.data;
        this.memoryAdapter.setValidated(key, data, result.etag);
        return { value: data, etag: result.etag };
      } catch (error) {
        logger.error('Failed to get cache item', { key, error });
        return { value: null };
      }
    });
  }

  /**
   * List all keys matching a prefix
   */
  public async list(prefix: string): Promise<string[]> {
    try {
      const objects = await this.s3Service.listObjects(this.bucketName, prefix);
      return objects.map((obj: any) => obj.key || '').filter((key: string) => key);
    } catch (error) {
      logger.error('Failed to list cache keys', { prefix, error });
      return [];
    }
  }

  public async markForSync(
    assetType: AssetType,
    assetIds: string[],
    components: string[]
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.markForSync(assetType, assetIds, components);
  }

  public async persistJobIndex(): Promise<void> {
    const cacheKey = 'jobs';
    const jobs = (this.memoryAdapter.get(cacheKey) as any[]) || [];

    await this.s3Service.putObject(this.bucketName, `cache/${cacheKey}.json`, jobs);
  }

  /**
   * Put any object to cache by key
   */
  public async put<T = any>(key: string, data: T): Promise<void> {
    try {
      // Store in S3 with pretty formatting; capture the new ETag so this
      // instance's memory copy is immediately marked fresh.
      const etag = await this.s3Service.putObject(
        this.bucketName,
        key,
        JSON.stringify(data, null, 2)
      );
      this.memoryAdapter.setValidated(key, data, etag);
    } catch (error) {
      logger.error('Failed to put cache item', { key, error });
      throw error;
    }
  }

  /**
   * Put activity cache
   */
  public async putActivityCache(data: any): Promise<void> {
    return await this.put('cache/activity-cache.json', data);
  }

  /**
   * Put activity persistence
   */
  public async putActivityPersistence(data: any): Promise<void> {
    return await this.put('cache/activity-persistence.json', data);
  }

  public async rebuildCache(
    forceRefresh = false,
    rebuildLineage = true,
    exportStateService?: any
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.rebuildCache(forceRefresh, rebuildLineage, exportStateService);
  }

  public async rebuildCacheForAssetType(
    assetType: AssetType,
    exportStateService?: any
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.rebuildCacheForAssetType(assetType, exportStateService);
  }

  public async removeAssetFromCache(assetType: AssetType, assetId: string): Promise<boolean> {
    const writer = await this.getCacheWriter();
    return writer.removeAssetFromCache(assetType, assetId);
  }

  public async replaceAsset(
    assetType: AssetType,
    assetId: string,
    updates: Partial<CacheEntry>
  ): Promise<any> {
    // First remove any existing entry to prevent duplicates
    await this.removeAssetFromCache(assetType, assetId);
    // Then add/update with the new data
    const writer = await this.getCacheWriter();
    return writer.updateAsset(assetType, assetId, updates);
  }

  /**
   * Save ingestions to cache
   */
  public async saveIngestions(ingestions: any[], metadata: any): Promise<void> {
    await this.put('cache/ingestions.json', {
      ingestions,
      metadata,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Search assets with tag filtering at the cache level
   * More efficient than loading all assets and filtering in JavaScript
   */
  public async searchAssetsWithFilters(
    options: Parameters<CacheReader['searchAssetsWithFilters']>[0]
  ): Promise<ReturnType<CacheReader['searchAssetsWithFilters']>> {
    return await this.cacheReader.searchAssetsWithFilters(options);
  }

  public async searchFields(options: any): Promise<any[]> {
    return await this.cacheReader.searchFields(options);
  }

  /**
   * Search fields with pagination using cache-level filtering
   */
  public async searchFieldsPaginated(
    options: Parameters<CacheReader['searchFieldsPaginated']>[0]
  ): Promise<ReturnType<CacheReader['searchFieldsPaginated']>> {
    return await this.cacheReader.searchFieldsPaginated(options);
  }

  // Allow setting bucket name after initialization for cases where env vars aren't available
  public setBucketName(bucketName: string): void {
    this.bucketName = bucketName;
  }

  public async updateAsset(
    assetType: AssetType,
    assetId: string,
    updates: Partial<CacheEntry>
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.updateAsset(assetType, assetId, updates);
  }

  public async updateAssetPermissions(
    assetType: AssetType,
    assetId: string,
    permissions: any[]
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.updateAssetPermissions(assetType, assetId, permissions);
  }

  public async updateAssetTags(
    assetType: AssetType,
    assetId: string,
    tags: Array<{ key: string; value: string }>
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.updateAssetTags(assetType, assetId, tags);
  }

  public async updateFieldCache(fieldCache: any): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.updateFieldCache(fieldCache);
  }

  /**
   * Update group membership after adding/removing users
   */
  public async updateGroupMembership(
    groupName: string,
    operation: 'add' | 'remove',
    userName: string,
    userArn?: string,
    userEmail?: string
  ): Promise<any> {
    const writer = await this.getCacheWriter();
    return writer.updateGroupMembership(groupName, operation, userName, userArn, userEmail);
  }

  public async updateJobIndex(jobs: any[]): Promise<void> {
    const cacheKey = 'jobs';

    // Update memory cache FIRST (instant!)
    this.memoryAdapter.set(cacheKey, jobs);

    // Don't write to S3 here - let the caller decide when to persist
    // This makes updates instant and non-blocking
    // Use nextTick to make it truly async without blocking
    await new Promise<void>((resolve) => process.nextTick(resolve));
  }

  /**
   * Map asset type to count key for the summary
   */
  private getAssetTypeCountKey(assetType: AssetType): keyof AssetTypeCounts | null {
    const mapping: Record<AssetType, keyof AssetTypeCounts> = {
      dashboard: 'dashboards',
      dataset: 'datasets',
      analysis: 'analyses',
      datasource: 'datasources',
      folder: 'folders',
      user: 'users',
      group: 'groups',
    };
    return mapping[assetType] || null;
  }

  /**
   * Get empty export summary for when no cache exists
   */
  private getEmptyExportSummary(): ExportSummary {
    return {
      totalAssets: 0,
      exportedAssets: 0,
      lastExportDate: null,
      exportInProgress: false,
      needsInitialExport: true,
      assetTypeCounts: {
        dashboards: 0,
        datasets: 0,
        analyses: 0,
        datasources: 0,
        folders: 0,
        users: 0,
        groups: 0,
      },
      archivedAssetCounts: {
        dashboards: 0,
        datasets: 0,
        analyses: 0,
        datasources: 0,
        folders: 0,
        users: 0,
        groups: 0,
        total: 0,
      },
      fieldStatistics: null,
      cacheVersion: 1,
      message: 'No cache found. Run initial export to build asset inventory.',
    };
  }

  private getMemoryCacheSize(): number {
    const lambdaMemoryMB = parseInt(
      process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ||
        CACHE_CONFIG.DEFAULT_LAMBDA_MEMORY_MB.toString()
    );

    if (lambdaMemoryMB >= CACHE_CONFIG.LARGE_LAMBDA_MEMORY_MB) {
      return CACHE_CONFIG.LARGE_LAMBDA_CACHE_SIZE;
    } else if (lambdaMemoryMB >= CACHE_CONFIG.MEDIUM_LAMBDA_MEMORY_MB) {
      return CACHE_CONFIG.MEDIUM_LAMBDA_CACHE_SIZE;
    } else {
      return CACHE_CONFIG.SMALL_LAMBDA_CACHE_SIZE;
    }
  }

  /**
   * Compare the memory copy's ETag against S3's current ETag via HEAD.
   */
  private async revalidateAgainstS3(
    key: string,
    memoryEtag: string | undefined
  ): Promise<'fresh' | 'stale' | 'missing' | 'unknown'> {
    try {
      const head = await this.s3Service.headObject(this.bucketName, key);
      if (head.etag && memoryEtag && head.etag === memoryEtag) {
        return 'fresh';
      }
      return 'stale';
    } catch (error: any) {
      if (
        error?.name === 'NotFound' ||
        error?.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND
      ) {
        return 'missing';
      }
      return 'unknown';
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();
