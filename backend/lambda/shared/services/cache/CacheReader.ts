/**
 * CacheReader - VSA View Layer for Cache Read Operations
 */
import { type MemoryCacheAdapter } from './adapters/MemoryCacheAdapter';
import { type S3CacheAdapter } from './adapters/S3CacheAdapter';
import { type FieldInfo } from './types';
import { CACHE_CONFIG } from '../../constants';
import { type CacheEntry, type MasterCache, type AssetType } from '../../models/asset.model';
import {
  AssetStatusFilter,
  DEFAULT_STATUS_FILTER,
  matchesStatusFilter,
} from '../../types/assetFilterTypes';
import { ASSET_TYPES } from '../../types/assetTypes';
import { logger } from '../../utils/logger';
import { SingleFlight } from '../../utils/singleFlight';

export class CacheReader {
  // Coalesces concurrent reads/revalidations of the same cache object so a
  // burst of parallel callers produces one S3 HEAD/GET instead of N
  private readonly singleFlight = new SingleFlight();

  constructor(
    private readonly s3Adapter: S3CacheAdapter,
    private readonly memoryAdapter: MemoryCacheAdapter
  ) {}

  public async getAsset(assetType: AssetType, assetId: string): Promise<CacheEntry | null> {
    const entries = await this.getCacheEntries({ assetType, statusFilter: AssetStatusFilter.ALL });
    return entries.find((entry) => entry.assetId === assetId) || null;
  }

  public async getAssetsByType(
    assetType: AssetType,
    options?: { statusFilter?: AssetStatusFilter }
  ): Promise<{ assets: CacheEntry[] }> {
    const statusFilter = options?.statusFilter || DEFAULT_STATUS_FILTER;
    const cache = await this.getMasterCache({ statusFilter });
    return { assets: cache.entries[assetType] || [] };
  }

  /**
   * Unified cache access method - can get single asset type or all types with status filtering
   * @param options.assetType - Get specific asset type, or omit for all types
   * @param options.statusFilter - Filter by asset status (default: ACTIVE)
   */
  public async getCacheEntries(options?: {
    assetType?: AssetType;
    statusFilter?: AssetStatusFilter;
  }): Promise<CacheEntry[]> {
    const statusFilter = options?.statusFilter || DEFAULT_STATUS_FILTER;

    if (options?.assetType) {
      // Single asset type - optimized path
      const rawEntries = await this.getTypeEntries(options.assetType);
      return rawEntries.filter((entry) => matchesStatusFilter(entry.status, statusFilter));
    } else {
      // All asset types - build from master cache
      const masterCache = await this.getMasterCache({ statusFilter });
      const allAssets: CacheEntry[] = [];

      for (const assetEntries of Object.values(masterCache.entries)) {
        allAssets.push(...assetEntries);
      }

      return allAssets;
    }
  }

  /**
   * Get cache metadata (counts and timestamps)
   */
  public getCacheMetadata(): Promise<any> {
    // Coalesced: a burst of concurrent callers past the window shares one GET
    return this.singleFlight.run('cache-metadata', () => this.getCacheMetadataUncoalesced());
  }

  public getEmptyMasterCache(): MasterCache {
    // Build empty structures dynamically from ASSET_TYPES
    const assetCounts: Record<string, number> = {};
    const entries: Record<string, CacheEntry[]> = {};

    Object.values(ASSET_TYPES).forEach((assetType) => {
      assetCounts[assetType] = 0;
      entries[assetType] = [];
    });

    return {
      version: '2.0',
      lastUpdated: new Date(),
      assetCounts: assetCounts as any,
      entries: entries as any,
    };
  }

  /**
   * Build a master cache structure from individual type caches
   * @param options.statusFilter - Filter by asset status (default: ACTIVE for most operations)
   */
  public async getMasterCache(options?: {
    statusFilter?: AssetStatusFilter;
  }): Promise<MasterCache> {
    const { cache } = await this.getMasterCacheWithVersion(options);
    return cache;
  }

  /**
   * Master cache plus a version string composed of the per-type S3 ETags.
   * The version changes iff any underlying type cache changed, making it a
   * safe key for memoizing data derived from the master cache.
   */
  public async getMasterCacheWithVersion(options?: {
    statusFilter?: AssetStatusFilter;
  }): Promise<{ cache: MasterCache; version: string }> {
    const metadata = await this.getCacheMetadata();
    const entries: any = {};
    const etagByType: Record<string, string | undefined> = {};

    // Determine status filter
    const statusFilter = options?.statusFilter || DEFAULT_STATUS_FILTER;

    // Load each asset type in parallel with consistent filtering
    const assetTypes = Object.values(ASSET_TYPES);
    const promises = assetTypes.map(async (assetType) => {
      const { entries: typeEntries, etag } = await this.getTypeEntriesWithEtag(assetType);

      // Apply status filter consistently using shared logic
      entries[assetType] = typeEntries.filter((entry) =>
        matchesStatusFilter(entry.status, statusFilter)
      );
      etagByType[assetType] = etag;
    });

    await Promise.all(promises);

    const version = assetTypes.map((t) => `${t}:${etagByType[t] ?? 'none'}`).join('|');

    return {
      cache: {
        version: metadata.version || '2.0',
        lastUpdated: metadata.lastUpdated ? new Date(metadata.lastUpdated) : new Date(),
        assetCounts: metadata.assetCounts || {},
        entries,
      },
      version,
    };
  }

  /**
   * Raw type entries plus the S3 ETag they were validated against. The ETag
   * doubles as a cheap version identifier for derived-data memoization.
   */
  public getTypeEntriesWithEtag(
    assetType: AssetType
  ): Promise<{ entries: CacheEntry[]; etag?: string }> {
    // Coalesced: concurrent callers for the same type share one flight
    return this.singleFlight.run(`type-entries:${assetType}`, async () => {
      try {
        const memoryKey = `cache-${assetType}`;

        // Memory-first with ETag revalidation: the memory copy carries the S3
        // ETag it was loaded with. Within the revalidation window we serve it
        // directly; after that a cheap HEAD confirms it still matches S3. This
        // makes cross-Lambda mutations (deletes, bulk tag/folder/permission,
        // rebuilds) visible on the next read with no manual invalidation.
        const cached = this.memoryAdapter.getValidatedEntry<CacheEntry[]>(memoryKey);
        if (cached) {
          if (Date.now() - cached.validatedAt < CACHE_CONFIG.REVALIDATE_WINDOW_MS) {
            return { entries: cached.value, etag: cached.etag };
          }
          const currentEtag = await this.s3Adapter.getTypeCacheEtag(assetType);
          if (currentEtag && cached.etag && currentEtag === cached.etag) {
            this.memoryAdapter.markValidated(memoryKey);
            return { entries: cached.value, etag: cached.etag };
          }
          // Stale, missing, or unconfirmable → fall through to a fresh GET.
          this.memoryAdapter.delete(memoryKey);
        }

        // Load from S3 (the source of truth)
        const result = await this.s3Adapter.getTypeCacheWithETag(assetType);
        if (result) {
          this.memoryAdapter.setValidated(memoryKey, result.entries, result.etag);
          return { entries: result.entries, etag: result.etag };
        }

        return { entries: [] };
      } catch (error) {
        logger.error(`Failed to get entries for ${assetType}`, { error });
        return { entries: [] };
      }
    });
  }

  /**
   * Search fields with cache-level filtering
   * Supports query, asset type, data type, and calculated field filtering
   */
  public async searchFields(options: {
    query?: string;
    assetTypes?: AssetType[];
    dataType?: string;
    isCalculated?: boolean;
    includeCalculated?: boolean; // Deprecated: use isCalculated instead
    limit?: number;
  }): Promise<FieldInfo[]> {
    try {
      const fieldCache = await this.s3Adapter.getFieldCache();
      if (!fieldCache || !Array.isArray(fieldCache)) {
        return [];
      }

      let filteredFields = fieldCache;

      // Apply text search filter at cache level
      if (options.query) {
        const query = options.query.toLowerCase();
        filteredFields = filteredFields.filter(
          (field: FieldInfo) =>
            field.fieldName.toLowerCase().includes(query) ||
            field.displayName?.toLowerCase().includes(query) ||
            field.description?.toLowerCase().includes(query)
        );
      }

      // Apply asset type filter
      if (options.assetTypes) {
        const assetTypes = options.assetTypes;
        filteredFields = filteredFields.filter((field: FieldInfo) =>
          assetTypes.includes(field.sourceAssetType as AssetType)
        );
      }

      // Apply data type filter
      if (options.dataType) {
        filteredFields = filteredFields.filter(
          (field: FieldInfo) => field.dataType === options.dataType
        );
      }

      // Apply calculated field filter (new isCalculated takes precedence)
      if (options.isCalculated !== undefined) {
        filteredFields = filteredFields.filter(
          (field: FieldInfo) => field.isCalculated === options.isCalculated
        );
      } else if (options.includeCalculated === false) {
        // Backwards compatibility
        filteredFields = filteredFields.filter((field: FieldInfo) => !field.isCalculated);
      }

      // Apply limit
      if (options.limit) {
        filteredFields = filteredFields.slice(0, options.limit);
      }

      return filteredFields;
    } catch (error) {
      logger.error('Failed to search fields', { error });
      return [];
    }
  }

  private async getCacheMetadataUncoalesced(): Promise<any> {
    try {
      // Memory-first within the revalidation window; metadata.json is small,
      // so past the window we just re-GET it (a HEAD would save almost nothing).
      const cached = this.memoryAdapter.getValidatedEntry<any>('cache-metadata');
      if (cached && Date.now() - cached.validatedAt < CACHE_CONFIG.REVALIDATE_WINDOW_MS) {
        return cached.value;
      }

      const result = await this.s3Adapter.getCacheMetadataWithETag();
      if (result?.metadata) {
        this.memoryAdapter.setValidated('cache-metadata', result.metadata, result.etag);
        return result.metadata;
      }
      if (cached) {
        // Transient S3 failure — serve the previous copy rather than defaults.
        return cached.value;
      }

      // Return default metadata
      return {
        version: '2.0',
        lastUpdated: new Date(),
        assetCounts: {
          dashboard: 0,
          analysis: 0,
          dataset: 0,
          datasource: 0,
          folder: 0,
          user: 0,
          group: 0,
        },
        assetTimestamps: {},
      };
    } catch (error) {
      logger.error('Failed to get cache metadata', { error });
      return {
        version: '2.0',
        lastUpdated: new Date(),
        assetCounts: {},
        assetTimestamps: {},
      };
    }
  }

  /**
   * Internal method to get raw type entries without status filtering
   */
  private async getTypeEntries(assetType: AssetType): Promise<CacheEntry[]> {
    return (await this.getTypeEntriesWithEtag(assetType)).entries;
  }
}
