/**
 * CacheReader - VSA View Layer for Cache Read Operations
 */
import { type MemoryCacheAdapter } from './adapters/MemoryCacheAdapter';
import { type S3CacheAdapter } from './adapters/S3CacheAdapter';
import { type CacheSearchOptions, type FieldInfo } from './types';
import { QUICKSIGHT_LIMITS } from '../../constants';
import { type CacheEntry, type MasterCache, type AssetType } from '../../models/asset.model';
import {
  AssetStatusFilter,
  DEFAULT_STATUS_FILTER,
  matchesStatusFilter,
} from '../../types/assetFilterTypes';
import { ASSET_TYPES } from '../../types/assetTypes';
import { logger } from '../../utils/logger';

export class CacheReader {
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
    options?: {
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      pageSize?: number;
      statusFilter?: AssetStatusFilter;
    }
  ): Promise<{
    assets: CacheEntry[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS;
    const offset = (page - 1) * pageSize;

    // Get cache with the requested status filter
    const statusFilter = options?.statusFilter || DEFAULT_STATUS_FILTER;
    const cache = await this.getMasterCache({ statusFilter });

    // Get assets of the specified type - already filtered by status
    let typeAssets = cache.entries[assetType] || [];

    // Apply search filter if provided
    if (options?.search) {
      const query = options.search.toLowerCase();
      typeAssets = typeAssets.filter(
        (asset) =>
          asset.assetName.toLowerCase().includes(query) ||
          asset.assetId.toLowerCase().includes(query) ||
          asset.metadata?.description?.toLowerCase().includes(query) ||
          asset.arn?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (options?.sortBy) {
      const sortBy = options.sortBy;
      const sortOrder = options.sortOrder || 'asc';
      typeAssets.sort((a, b) => {
        const aVal = this.getAssetSortValue(a, sortBy);
        const bVal = this.getAssetSortValue(b, sortBy);

        if (sortOrder === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    // Apply pagination
    const totalItems = typeAssets.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedAssets = typeAssets.slice(offset, offset + pageSize);

    return {
      assets: paginatedAssets,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: offset + pageSize < totalItems,
      },
    };
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
  public async getCacheMetadata(): Promise<any> {
    try {
      // Try memory cache first
      const cached = this.memoryAdapter.get<any>('cache-metadata');
      if (cached) {
        return cached;
      }

      // Try S3
      const metadata = await this.s3Adapter.getCacheMetadata();
      if (metadata) {
        this.memoryAdapter.set('cache-metadata', metadata); // Cache for 1 minute
        return metadata;
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
    const metadata = await this.getCacheMetadata();
    const entries: any = {};

    // Determine status filter
    const statusFilter = options?.statusFilter || DEFAULT_STATUS_FILTER;

    // Load each asset type in parallel with consistent filtering
    const assetTypes = Object.values(ASSET_TYPES);
    const promises = assetTypes.map(async (assetType) => {
      let typeEntries = await this.getTypeEntries(assetType);

      // Apply status filter consistently using shared logic
      typeEntries = typeEntries.filter((entry) => matchesStatusFilter(entry.status, statusFilter));

      entries[assetType] = typeEntries;
    });

    await Promise.all(promises);

    return {
      version: metadata.version || '2.0',
      lastUpdated: metadata.lastUpdated ? new Date(metadata.lastUpdated) : new Date(),
      assetCounts: metadata.assetCounts || {},
      entries,
    };
  }

  public async searchAssets(options: CacheSearchOptions = {}): Promise<{
    assets: CacheEntry[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const masterCache = await this.getMasterCache();
    let allAssets: CacheEntry[] = [];

    // Collect assets from specified types or all types
    const types = options.types || Object.values(ASSET_TYPES);
    for (const type of types) {
      allAssets = allAssets.concat(masterCache.entries[type as AssetType] || []);
    }

    // Apply filters
    let filteredAssets = allAssets;

    if (options.query) {
      const query = options.query.toLowerCase();
      filteredAssets = filteredAssets.filter(
        (asset) =>
          asset.assetName.toLowerCase().includes(query) ||
          asset.assetId.toLowerCase().includes(query) ||
          asset.metadata?.description?.toLowerCase().includes(query) ||
          asset.arn?.toLowerCase().includes(query)
      );
    }

    if (options.status) {
      const statusFilter = options.status;
      filteredAssets = filteredAssets.filter((asset) => statusFilter.includes(asset.status));
    }

    if (options.tags) {
      const tagsFilter = options.tags;
      filteredAssets = filteredAssets.filter((asset) =>
        asset.tags.some((tag: { key: string; value: string }) =>
          tagsFilter.some(
            (searchTag) => tag.key.includes(searchTag) || tag.value.includes(searchTag)
          )
        )
      );
    }

    // Apply sorting
    if (options.sortBy) {
      const sortBy = options.sortBy;
      const sortOrder = options.sortOrder || 'asc';
      filteredAssets.sort((a, b) => {
        const aVal = this.getAssetSortValue(a, sortBy);
        const bVal = this.getAssetSortValue(b, sortBy);

        if (sortOrder === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    // Apply pagination
    const limit = options.limit || QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS;
    const offset = options.offset || 0;
    const page = Math.floor(offset / limit) + 1;
    const totalItems = filteredAssets.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedAssets = filteredAssets.slice(offset, offset + limit);

    return {
      assets: paginatedAssets,
      pagination: {
        page,
        pageSize: limit,
        totalItems,
        totalPages,
        hasMore: offset + limit < totalItems,
      },
    };
  }

  public async searchFields(options: {
    query?: string;
    assetTypes?: AssetType[];
    includeCalculated?: boolean;
    limit?: number;
  }): Promise<FieldInfo[]> {
    try {
      const fieldCache = await this.s3Adapter.getFieldCache();
      if (!fieldCache || !Array.isArray(fieldCache)) {
        return [];
      }

      let filteredFields = fieldCache;

      // Apply filters
      if (options.query) {
        const query = options.query.toLowerCase();
        filteredFields = filteredFields.filter(
          (field: FieldInfo) =>
            field.fieldName.toLowerCase().includes(query) ||
            field.displayName?.toLowerCase().includes(query) ||
            field.description?.toLowerCase().includes(query)
        );
      }

      if (options.assetTypes) {
        const assetTypes = options.assetTypes;
        filteredFields = filteredFields.filter((field: FieldInfo) =>
          assetTypes.includes(field.sourceAssetType as AssetType)
        );
      }

      if (options.includeCalculated === false) {
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

  private getAssetSortValue(asset: CacheEntry, sortBy: string): any {
    switch (sortBy) {
      case 'name':
        return asset.assetName;
      case 'lastModified':
        return asset.lastUpdatedTime;
      case 'created':
        return asset.createdTime;
      case 'type':
        return asset.assetType;
      default:
        return asset.assetName;
    }
  }

  /**
   * Internal method to get raw type entries without status filtering
   */
  private async getTypeEntries(assetType: AssetType): Promise<CacheEntry[]> {
    try {
      // Try memory cache first
      const memoryKey = `cache-${assetType}`;
      const cached = this.memoryAdapter.get<CacheEntry[]>(memoryKey);
      if (cached) {
        return cached;
      }

      // Try S3
      const entries = await this.s3Adapter.getTypeCache(assetType);
      if (entries) {
        this.memoryAdapter.set(memoryKey, entries); // Cache for 5 minutes
        return entries;
      }

      return [];
    } catch (error) {
      logger.error(`Failed to get entries for ${assetType}`, { error });
      return [];
    }
  }
}
