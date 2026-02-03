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
import {
  type TagFilter,
  matchesIncludeTags,
  matchesExcludeTags,
  matchesAssetIds,
} from '../../types/filterTypes';
import { logger } from '../../utils/logger';

/**
 * Search match reason types - must match OpenAPI SearchMatchReason enum
 */
type SearchMatchReason =
  | 'name'
  | 'id'
  | 'description'
  | 'arn'
  | 'tag_key'
  | 'tag_value'
  | 'permission'
  | 'dependency_dataset'
  | 'dependency_datasource'
  | 'dependency_analysis';

/**
 * Cache entry with optional search match reasons (populated during search)
 */
export type CacheEntryWithSearchReasons = CacheEntry & {
  searchMatchReasons?: SearchMatchReason[];
};

/**
 * Check lineage data for matches and return applicable reasons
 */
function getLineageMatchReasons(
  lineage: CacheEntry['metadata']['lineageData'],
  query: string
): SearchMatchReason[] {
  if (!lineage) {
    return [];
  }

  const reasons: SearchMatchReason[] = [];

  // Check dataset IDs and enriched dataset names
  const datasetIdMatch = lineage.datasetIds?.some((id) => id.toLowerCase().includes(query));
  const datasetNameMatch = lineage.datasets?.some((ds) => ds.name.toLowerCase().includes(query));
  if (datasetIdMatch || datasetNameMatch) {
    reasons.push('dependency_dataset');
  }

  // Check datasource IDs and enriched datasource names
  const datasourceIdMatch = lineage.datasourceIds?.some((id) => id.toLowerCase().includes(query));
  const datasourceNameMatch = lineage.datasources?.some((ds) =>
    ds.name.toLowerCase().includes(query)
  );
  if (datasourceIdMatch || datasourceNameMatch) {
    reasons.push('dependency_datasource');
  }

  if (lineage.sourceAnalysisArn?.toLowerCase().includes(query)) {
    reasons.push('dependency_analysis');
  }

  return reasons;
}

/**
 * Get all match reasons for an asset against a search query
 * Returns empty array if no match, or array of reasons if matched
 */
function getMatchReasons(asset: CacheEntry, query: string): SearchMatchReason[] {
  const reasons: SearchMatchReason[] = [];

  // Check basic fields
  if (asset.assetName.toLowerCase().includes(query)) {
    reasons.push('name');
  }
  if (asset.assetId.toLowerCase().includes(query)) {
    reasons.push('id');
  }
  if (asset.metadata?.description?.toLowerCase().includes(query)) {
    reasons.push('description');
  }
  if (asset.arn?.toLowerCase().includes(query)) {
    reasons.push('arn');
  }

  // Check tags
  if (asset.tags?.some((tag) => tag.key.toLowerCase().includes(query))) {
    reasons.push('tag_key');
  }
  if (asset.tags?.some((tag) => tag.value.toLowerCase().includes(query))) {
    reasons.push('tag_value');
  }

  // Check permissions (user/group names)
  if (asset.permissions?.some((perm) => perm.principal.toLowerCase().includes(query))) {
    reasons.push('permission');
  }

  // Check lineage data (ID matches and enriched name matches)
  reasons.push(...getLineageMatchReasons(asset.metadata?.lineageData, query));

  return reasons;
}

/**
 * Apply lineage-aware search filter to assets
 * Returns assets with match reasons attached
 */
function applySearchFilter(
  assets: CacheEntry[],
  query: string,
  allAssets: CacheEntry[]
): CacheEntryWithSearchReasons[] {
  // Phase 1: Find directly matching assets for relationship lookup
  const directMatches = new Map<string, CacheEntry>();
  for (const asset of allAssets) {
    const reasons = getMatchReasons(asset, query);
    if (reasons.length > 0) {
      directMatches.set(asset.assetId, asset);
    }
  }

  // Phase 2: Filter and annotate assets with match reasons
  const matchedAssets: CacheEntryWithSearchReasons[] = [];

  for (const asset of assets) {
    const reasons: SearchMatchReason[] = [];

    // Get direct match reasons (name, id, description, arn, tags, permissions)
    reasons.push(...getMatchReasons(asset, query));

    // Check if this asset depends on a directly matched asset (relationship match)
    const lineage = asset.metadata?.lineageData;
    if (lineage) {
      if (lineage.datasetIds?.some((id) => directMatches.has(id))) {
        reasons.push('dependency_dataset');
      }
      if (lineage.datasourceIds?.some((id) => directMatches.has(id))) {
        reasons.push('dependency_datasource');
      }
      if (lineage.sourceAnalysisArn) {
        const analysisId = lineage.sourceAnalysisArn.split('/').pop();
        if (analysisId && directMatches.has(analysisId)) {
          reasons.push('dependency_analysis');
        }
      }
    }

    // Dedupe reasons and add to results if matched
    const uniqueReasons = [...new Set(reasons)];
    if (uniqueReasons.length > 0) {
      matchedAssets.push({ ...asset, searchMatchReasons: uniqueReasons });
    }
  }

  return matchedAssets;
}

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
    assets: CacheEntryWithSearchReasons[];
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
    let typeAssets: CacheEntryWithSearchReasons[] = cache.entries[assetType] || [];

    // Apply search filter if provided (includes lineage-aware search with match reasons)
    if (options?.search) {
      const allCacheAssets = await this.getCacheEntries({ statusFilter });
      typeAssets = applySearchFilter(typeAssets, options.search.toLowerCase(), allCacheAssets);
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

  /**
   * Search assets with tag filtering at the cache level
   * This avoids loading all assets and then filtering in JavaScript
   *
   * @param options.includeTags - Tags to include (OR logic: asset has at least one)
   * @param options.excludeTags - Tags to exclude (AND NOT logic: asset has none)
   * @param options.assetIds - Specific asset IDs to include (whitelist)
   * @param options.statusFilter - Filter by asset status (default: ACTIVE)
   * @param options.search - Text search on name/id/description
   * @param options.types - Asset types to include
   * @param options.page - Page number (1-indexed)
   * @param options.pageSize - Number of items per page
   * @param options.sortBy - Field to sort by
   * @param options.sortOrder - Sort order (asc/desc)
   */
  public async searchAssetsWithFilters(options: {
    includeTags?: TagFilter[];
    excludeTags?: TagFilter[];
    assetIds?: string[];
    statusFilter?: AssetStatusFilter;
    search?: string;
    types?: AssetType[];
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    assets: CacheEntryWithSearchReasons[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS;
    const offset = (page - 1) * pageSize;
    const statusFilter = options.statusFilter || DEFAULT_STATUS_FILTER;

    // Get assets from cache with status filtering
    const masterCache = await this.getMasterCache({ statusFilter });
    let allAssets: CacheEntryWithSearchReasons[] = [];

    // Collect assets from specified types or all types
    const types = options.types || Object.values(ASSET_TYPES);
    for (const type of types) {
      allAssets = allAssets.concat(masterCache.entries[type as AssetType] || []);
    }

    // Apply tag and asset ID filters at the cache level
    const hasTagFilters =
      (options.includeTags && options.includeTags.length > 0) ||
      (options.excludeTags && options.excludeTags.length > 0) ||
      (options.assetIds && options.assetIds.length > 0);

    if (hasTagFilters) {
      allAssets = allAssets.filter((asset) => {
        const assetTags: TagFilter[] = (asset.tags || []).map(
          (t: { key: string; value: string }) => ({
            key: t.key,
            value: t.value,
          })
        );

        // Check asset ID filter (whitelist)
        if (!matchesAssetIds(asset.assetId, options.assetIds)) {
          return false;
        }

        // Check include tags (OR logic)
        if (!matchesIncludeTags(assetTags, options.includeTags || [])) {
          return false;
        }

        // Check exclude tags (AND NOT logic)
        if (!matchesExcludeTags(assetTags, options.excludeTags || [])) {
          return false;
        }

        return true;
      });

      logger.debug('Tag filtering applied', {
        includeTags: options.includeTags?.length || 0,
        excludeTags: options.excludeTags?.length || 0,
        assetIds: options.assetIds?.length || 0,
        remainingAssets: allAssets.length,
      });
    }

    // Apply text search filter (includes lineage-aware search with match reasons)
    if (options.search) {
      allAssets = applySearchFilter(allAssets, options.search.toLowerCase(), allAssets);
    }

    // Apply sorting
    if (options.sortBy) {
      const sortBy = options.sortBy;
      const sortOrder = options.sortOrder || 'asc';
      allAssets.sort((a, b) => {
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
    const totalItems = allAssets.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedAssets = allAssets.slice(offset, offset + pageSize);

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
   * Search fields with cache-level filtering
   * Supports query, asset type, data type, calculated field filtering, and pagination
   */
  public async searchFields(options: {
    query?: string;
    assetTypes?: AssetType[];
    dataType?: string;
    isCalculated?: boolean;
    includeCalculated?: boolean; // Deprecated: use isCalculated instead
    limit?: number;
    page?: number;
    pageSize?: number;
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

      // Apply limit (for non-paginated calls)
      if (options.limit && !options.page) {
        filteredFields = filteredFields.slice(0, options.limit);
      }

      return filteredFields;
    } catch (error) {
      logger.error('Failed to search fields', { error });
      return [];
    }
  }

  /**
   * Search fields with pagination support - returns paginated results
   * This is the preferred method for paginated field queries
   */
  public async searchFieldsPaginated(options: {
    query?: string;
    assetTypes?: AssetType[];
    dataType?: string;
    isCalculated?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    fields: FieldInfo[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const page = options.page || 1;
    const pageSize = options.pageSize || QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS;
    const offset = (page - 1) * pageSize;

    // Get filtered fields using cache-level filtering
    const filteredFields = await this.searchFields({
      query: options.query,
      assetTypes: options.assetTypes,
      dataType: options.dataType,
      isCalculated: options.isCalculated,
    });

    // Apply pagination
    const totalItems = filteredFields.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedFields = filteredFields.slice(offset, offset + pageSize);

    return {
      fields: paginatedFields,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: offset + pageSize < totalItems,
      },
    };
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
