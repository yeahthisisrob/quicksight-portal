import { DEBUG_CONFIG, QUICKSIGHT_LIMITS } from '../../../shared/constants';
import { RETENTION_PERIODS } from '../../../shared/constants/timeConstants';
import { type CacheEntry } from '../../../shared/models/asset.model';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { LineageService } from '../../../shared/services/lineage';
import { type ActivityData } from '../../../shared/types/activityTypes';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import {
  ASSET_TYPES,
  COLLECTION_ASSET_TYPES,
  type AssetType,
  type CacheData,
} from '../../../shared/types/assetTypes';
import { type LineageData } from '../../../shared/types/lineage.types';
import { mapCacheEntryToAsset } from '../../../shared/utils/assetMapping';
import { findMatchingFlatFileDatasource } from '../../../shared/utils/flatFileDatasetMatcher';
import { logger } from '../../../shared/utils/logger';
import { processPaginatedData, type SortConfig } from '../../../shared/utils/paginationUtils';
import { principalMatchesGroup } from '../../../shared/utils/quicksightUtils';
import { ActivityService } from '../../activity/services/ActivityService';
import { GroupService } from '../../organization/services/GroupService';
import { TagService } from '../../organization/services/TagService';
import {
  type Asset,
  type AssetListRequest,
  type AssetListResponse,
  type ArchivedAssetsResponse,
  type ArchivedAssetItem,
  type MappedAsset,
} from '../types';

export class AssetService {
  private readonly activityService: ActivityService;
  private readonly groupService: GroupService;
  private readonly lineageService: LineageService;
  private readonly tagService: TagService;

  constructor(accountId: string) {
    this.tagService = new TagService(accountId);
    this.lineageService = new LineageService();
    this.groupService = new GroupService();
    this.activityService = new ActivityService(cacheService, null as any, this.groupService); // CloudTrail adapter not needed for reading
  }

  public async getArchivedAssetsPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    assetType?: AssetType;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    dateRange?: string;
  }): Promise<ArchivedAssetsResponse> {
    const { page, pageSize, search, assetType, sortBy, sortOrder, dateRange } = params;

    // Get archived assets using the new status filter pattern
    const archivedAssets = await cacheService.getAssetsByStatus(AssetStatusFilter.ARCHIVED, {
      assetType,
    });

    // Get activity persistence data for last activity dates
    let activityPersistence: any = null;
    try {
      activityPersistence = await cacheService.getActivityPersistence();
    } catch (error) {
      logger.warn('Failed to get activity persistence data', { error });
    }

    // Transform to match ArchivedAssetItem schema
    let transformedAssets: ArchivedAssetItem[] = archivedAssets.map((asset) =>
      this.transformArchivedAsset(asset, activityPersistence)
    );

    // Apply date range filter before pagination
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateRange) {
        case '24h':
          startDate = new Date(now.getTime() - RETENTION_PERIODS.ONE_DAY);
          break;
        case '7d':
          startDate = new Date(now.getTime() - RETENTION_PERIODS.ONE_WEEK);
          break;
        case '30d':
          startDate = new Date(now.getTime() - RETENTION_PERIODS.ONE_MONTH);
          break;
        case '90d':
          startDate = new Date(now.getTime() - RETENTION_PERIODS.THREE_MONTHS);
          break;
        default:
          startDate = new Date(0);
      }

      transformedAssets = transformedAssets.filter(
        (asset) => new Date(asset.archivedDate || 0) >= startDate
      );
    }

    // Define search fields
    const searchFields = [
      (item: any) => item.name,
      (item: any) => item.id,
      (item: any) => item.archiveReason,
      (item: any) => item.type,
    ];

    // Define sort configurations
    const sortConfigs: Record<string, SortConfig<any>> = {
      name: { field: 'name', getValue: (item) => item.name },
      type: { field: 'type', getValue: (item) => item.type },
      createdTime: {
        field: 'createdTime',
        getValue: (item) => new Date(item.createdTime).getTime(),
      },
      lastUpdatedTime: {
        field: 'lastUpdatedTime',
        getValue: (item) => new Date(item.lastUpdatedTime).getTime(),
      },
      lastExportTime: {
        field: 'lastExportTime',
        getValue: (item) => new Date(item.lastExportTime).getTime(),
      },
      archivedDate: {
        field: 'archivedDate',
        getValue: (item) => new Date(item.archivedDate || 0).getTime(),
      },
      archiveReason: { field: 'archiveReason', getValue: (item) => item.archiveReason },
      archivedBy: { field: 'archivedBy', getValue: (item) => item.archivedBy },
      lastActivity: {
        field: 'lastActivity',
        getValue: (item) => (item.lastActivity ? new Date(item.lastActivity).getTime() : 0),
      },
    };

    // Use the pagination utilities
    const result = processPaginatedData(
      transformedAssets,
      { page, pageSize, search, sortBy, sortOrder },
      searchFields,
      sortConfigs
    );

    return {
      items: result.items,
      nextToken: result.pagination.hasMore ? `${page + 1}` : undefined,
      totalCount: result.pagination.totalItems,
    };
  }

  public async getLiveTags(assetType: AssetType, assetId: string): Promise<any> {
    return await this.tagService.getResourceTags(assetType, assetId);
  }

  public async list(assetType: string, request: AssetListRequest): Promise<AssetListResponse> {
    try {
      // Use cached data - get only active assets by default (most common use case)
      const cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });

      if (!cache || !cache.entries) {
        logger.warn('No cached data found, returning empty results');
        return { items: [], nextToken: undefined };
      }

      // Check if this is a collection type (user, group, folder) - they need special handling
      if (COLLECTION_ASSET_TYPES.includes(assetType as AssetType)) {
        return this.listCollectionType(assetType as AssetType, request);
      }

      // Validate asset type for regular assets
      const validAssetTypes = [
        ASSET_TYPES.dashboard,
        ASSET_TYPES.dataset,
        ASSET_TYPES.analysis,
        ASSET_TYPES.datasource,
      ];
      if (!validAssetTypes.includes(assetType as any)) {
        throw new Error(`Unsupported asset type: ${assetType}`);
      }

      // Since assetType is always singular, we can directly access the cache
      const cachedAssets = cache.entries[assetType as keyof typeof cache.entries] || [];

      if (!Array.isArray(cachedAssets)) {
        logger.warn(`No cached data found for asset type: ${assetType}`);
        return { items: [], nextToken: undefined };
      }

      // No need to filter - cache already returns only active assets

      // Get lineage data for active assets
      const lineageMap = await this.lineageService.getLineageMapForAssets(
        assetType as Asset['type'],
        cachedAssets.map((a) => a.assetId)
      );

      // Fetch activity data for assets and related entities
      const activityMap = await this.collectActivityData(assetType, cachedAssets, lineageMap);

      // Build folder membership mapping
      const assetFolderMap = this.buildAssetFolderMap(cache, assetType);

      // Convert cached assets using the proper OpenAPI contract mappings
      const items: Asset[] = await Promise.all(
        cachedAssets.map((cacheEntry: CacheEntry) =>
          this.mapCacheEntryToEnrichedAsset(
            cacheEntry,
            assetType,
            cache,
            assetFolderMap,
            lineageMap,
            activityMap
          )
        )
      );

      // Get search fields and sort configurations for this asset type
      const searchFields = this.getSearchFieldsForAssetType(assetType);

      const sortConfigs = this.getSortConfigsForAssets();

      // Convert startIndex/maxResults to page/pageSize for pagination utils
      const startIndex = request.startIndex || 0;
      const maxResults = request.maxResults || QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS;
      const page = Math.floor(startIndex / maxResults) + 1;

      // Apply request filters to items
      const filteredItems = this.applyRequestFilters(items, request.filters);

      // Use the pagination utilities for search, sort, and pagination

      const result = processPaginatedData(
        filteredItems,
        {
          page,
          pageSize: maxResults,
          search: request.search,
          sortBy: request.sortBy,
          sortOrder: request.sortOrder?.toLowerCase() as 'asc' | 'desc',
        },
        searchFields,
        sortConfigs
      );

      return {
        items: result.items,
        nextToken: result.pagination.hasMore ? String(startIndex + maxResults) : undefined,
        totalCount: result.pagination.totalItems,
      };
    } catch (error) {
      logger.error('Failed to list assets', { assetType, error });
      throw error;
    }
  }

  /**
   * Add activity data to asset based on type
   */
  private addActivityData(
    mappedAsset: any,
    assetType: string,
    assetId: string,
    activityMap: Map<string, ActivityData>
  ): void {
    if (assetType === ASSET_TYPES.dashboard || assetType === ASSET_TYPES.analysis) {
      const activityData = activityMap.get(assetId);
      mappedAsset.activity = {
        totalViews: activityData?.totalViews || 0,
        uniqueViewers: activityData?.uniqueViewers || 0,
        lastViewed: activityData?.lastViewed || null,
      };
    } else if (assetType === ASSET_TYPES.user) {
      const activityData = activityMap.get(assetId);
      if (activityData) {
        mappedAsset.activity = {
          totalActivities: activityData.totalActivities || 0,
          lastActive: activityData.lastActive || null,
          dashboardCount: activityData.dashboardCount || 0,
          analysisCount: activityData.analysisCount || 0,
        };
      }
    }
  }

  /**
   * Add folder member count for folder assets
   */
  private addFolderMemberCount(
    mappedAsset: any,
    assetType: string,
    cacheEntry: CacheEntry,
    cache: any
  ): void {
    if (assetType === ASSET_TYPES.folder && cacheEntry.metadata?.members) {
      let activeMembers = 0;
      for (const member of cacheEntry.metadata.members) {
        const memberType = ('memberType' in member ? member.memberType : '').toLowerCase();
        const memberId = 'memberId' in member ? member.memberId : '';

        if (memberType && memberId) {
          const memberCache = cache.entries[memberType as keyof typeof cache.entries];
          if (memberCache) {
            const memberAsset = memberCache.find((a: any) => a.assetId === memberId);
            if (memberAsset && memberAsset.status !== 'archived') {
              activeMembers++;
            }
          }
        }
      }
      mappedAsset.memberCount = activeMembers;
    }
  }

  /**
   * Add folder membership data to asset
   */
  private addFolderMembership(
    mappedAsset: any,
    assetId: string,
    assetFolderMap: Map<string, Array<{ id: string; name: string; path: string }>>
  ): void {
    const folders = assetFolderMap.get(assetId) || [];
    mappedAsset.folders = folders;
    mappedAsset.folderCount = folders.length;
  }

  /**
   * Add group assets count for group assets
   */
  private addGroupAssetsCount(
    mappedAsset: any,
    assetType: string,
    cacheEntry: CacheEntry,
    cache: CacheData
  ): void {
    if (assetType !== ASSET_TYPES.group) {
      return;
    }

    const countedAssets = new Set<string>();
    const accessibleFolders = this.findAccessibleFolders(cacheEntry, cache, countedAssets);
    this.countDirectGroupAssets(cacheEntry, cache, accessibleFolders, countedAssets);

    mappedAsset.assetsCount = countedAssets.size;
  }

  /**
   * Add lineage data to asset
   */
  private addLineageData(
    mappedAsset: any,
    assetType: string,
    assetId: string,
    lineageMap: Map<string, LineageData>,
    activityMap: Map<string, ActivityData>
  ): void {
    const lineageKey = `${assetType}:${assetId}`;
    const assetLineage = lineageMap.get(lineageKey);

    if (!assetLineage && lineageMap.size > 0) {
      logger.debug(
        `No lineage found for key ${lineageKey}. Available keys:`,
        Array.from(lineageMap.keys()).slice(0, DEBUG_CONFIG.MAX_KEYS_TO_LOG)
      );
    }

    if (assetLineage?.relationships) {
      const allRelationships = this.transformLineageRelationships(
        assetLineage.relationships,
        activityMap
      );
      mappedAsset.relatedAssets = this.filterRelationshipsByAssetType(assetType, allRelationships);
    } else {
      mappedAsset.relatedAssets = [];
    }
  }

  /**
   * Add user groups data
   */
  private async addUserGroups(
    mappedAsset: any,
    assetType: string,
    cacheEntry: CacheEntry
  ): Promise<void> {
    if (assetType !== ASSET_TYPES.user) {
      return;
    }

    const userId = cacheEntry.assetId;
    const userGroups = await this.groupService.getUserGroups(userId);
    const groupNames = userGroups.map((g) => g.groupName);

    mappedAsset.groups = groupNames;
    mappedAsset.groupCount = groupNames.length;
  }

  /**
   * Apply request filters to items
   */
  private applyRequestFilters(items: Asset[], filters?: Record<string, any>): Asset[] {
    if (!filters || Object.keys(filters).length === 0) {
      return items;
    }

    const filteredItems = items.filter((item) => {
      return Object.entries(filters).every(([field, filterValue]) => {
        return this.itemMatchesFilter(item, field, filterValue);
      });
    });

    return filteredItems;
  }

  /**
   * Build asset folder membership map
   */
  private buildAssetFolderMap(
    cache: CacheData,
    assetType: string
  ): Map<string, Array<{ id: string; name: string; path: string }>> {
    // Cache already excludes archived folders, so no need to filter
    const folderEntries = cache.entries[ASSET_TYPES.folder] || [];
    const assetFolderMap = new Map<string, Array<{ id: string; name: string; path: string }>>();

    folderEntries.forEach((folderEntry: any) => {
      const folderData = folderEntry.metadata as any;
      const members = folderData.members || [];

      members.forEach((member: any) => {
        const memberId = member.memberId || member.MemberId;
        const memberType = member.memberType || member.MemberType;

        if (memberType && memberType.toLowerCase() === assetType.toLowerCase()) {
          if (!assetFolderMap.has(memberId)) {
            assetFolderMap.set(memberId, []);
          }
          const folders = assetFolderMap.get(memberId);
          if (folders) {
            folders.push({
              id: folderEntry.assetId,
              name: folderEntry.assetName,
              path: folderEntry.metadata.fullPath || `/${folderEntry.assetName}`,
            });
          }
        }
      });
    });

    return assetFolderMap;
  }

  /**
   * Check if an asset is a member of any accessible folder
   */
  private checkFolderMembership(
    entry: CacheEntry,
    accessibleFolders: CacheEntry[],
    countedAssets: Set<string>
  ): void {
    for (const folder of accessibleFolders) {
      const isMember = folder.metadata?.members?.some(
        (member: any) => member.MemberId === entry.assetId || member.MemberArn === entry.arn
      );

      if (isMember) {
        countedAssets.add(entry.assetId);
        break;
      }
    }
  }

  /**
   * Collect activity data for assets and related entities
   */
  private async collectActivityData(
    assetType: string,
    cachedAssets: CacheEntry[],
    lineageMap: Map<string, any>
  ): Promise<Map<string, any>> {
    const { dashboardIds, analysisIds } = this.collectAssetIds(assetType, cachedAssets, lineageMap);
    const activityMap = new Map<string, any>();

    try {
      await Promise.all([
        this.fetchDashboardActivity(dashboardIds, activityMap),
        this.fetchAnalysisActivity(analysisIds, activityMap),
        this.fetchUserActivity(assetType, cachedAssets, activityMap),
      ]);
    } catch (error) {
      logger.warn('Failed to fetch activity data:', error);
    }

    return activityMap;
  }

  /**
   * Collect dashboard and analysis IDs from assets and lineage
   */
  private collectAssetIds(
    assetType: string,
    cachedAssets: CacheEntry[],
    lineageMap: Map<string, any>
  ): { dashboardIds: Set<string>; analysisIds: Set<string> } {
    const dashboardIds = new Set<string>();
    const analysisIds = new Set<string>();

    // Add main assets if they are dashboards or analyses
    if (assetType === ASSET_TYPES.dashboard) {
      cachedAssets.forEach((a) => dashboardIds.add(a.assetId));
    } else if (assetType === ASSET_TYPES.analysis) {
      cachedAssets.forEach((a) => analysisIds.add(a.assetId));
    }

    // Add related dashboard/analysis IDs from lineage
    lineageMap.forEach((lineageData) => {
      if (lineageData.relationships) {
        lineageData.relationships.forEach((rel: any) => {
          if (rel.targetAssetType === 'dashboard') {
            dashboardIds.add(rel.targetAssetId);
          } else if (rel.targetAssetType === 'analysis') {
            analysisIds.add(rel.targetAssetId);
          }
        });
      }
    });

    return { dashboardIds, analysisIds };
  }

  /**
   * Count assets directly accessible to a group
   */
  private countDirectGroupAssets(
    cacheEntry: CacheEntry,
    cache: CacheData,
    accessibleFolders: CacheEntry[],
    countedAssets: Set<string>
  ): void {
    const groupArn = cacheEntry.arn;
    const groupName = cacheEntry.assetName;
    const assetTypesToCheck = ['dashboard', 'dataset', 'analysis', 'datasource'];

    for (const type of assetTypesToCheck) {
      const entries = cache.entries[type as keyof typeof cache.entries] || [];

      for (const entry of entries) {
        if (entry.status !== 'active' || countedAssets.has(entry.assetId)) {
          continue;
        }

        // Check direct permissions
        const hasDirectAccess = entry.permissions?.some((p: any) =>
          principalMatchesGroup(p.principal, groupArn, groupName)
        );

        if (hasDirectAccess) {
          countedAssets.add(entry.assetId);
          continue;
        }

        // Check folder membership
        this.checkFolderMembership(entry, accessibleFolders, countedAssets);
      }
    }
  }

  /**
   * Determine the source type based on datasource ARNs
   */
  private determineSourceType(
    datasourceArns: string[],
    datasourceEntries: CacheEntry[],
    cacheEntry: CacheEntry
  ): string {
    if (datasourceArns.length === 0) {
      return this.resolveFlatFileDatasetType(cacheEntry, datasourceEntries);
    }

    if (datasourceArns.length === 1) {
      const firstArn = datasourceArns[0];
      if (firstArn) {
        return this.resolveSingleDatasourceType(firstArn, datasourceEntries, cacheEntry);
      }
      return 'UNKNOWN';
    }

    return this.resolveMultipleDatasourcesType(datasourceArns, datasourceEntries);
  }

  /**
   * Fetch analysis activity data
   */
  private async fetchAnalysisActivity(
    analysisIds: Set<string>,
    activityMap: Map<string, any>
  ): Promise<void> {
    if (analysisIds.size > 0) {
      const analysisActivity = await this.activityService.getAssetActivityCounts(
        'analysis',
        Array.from(analysisIds)
      );
      analysisActivity.forEach((value, key) => activityMap.set(key, value));
    }
  }

  /**
   * Fetch dashboard activity data
   */
  private async fetchDashboardActivity(
    dashboardIds: Set<string>,
    activityMap: Map<string, any>
  ): Promise<void> {
    if (dashboardIds.size > 0) {
      const dashboardActivity = await this.activityService.getAssetActivityCounts(
        'dashboard',
        Array.from(dashboardIds)
      );
      dashboardActivity.forEach((value, key) => activityMap.set(key, value));
    }
  }

  /**
   * Fetch user activity data if applicable
   */
  private async fetchUserActivity(
    assetType: string,
    cachedAssets: CacheEntry[],
    activityMap: Map<string, any>
  ): Promise<void> {
    if (assetType === ASSET_TYPES.user) {
      const userNames = cachedAssets.map((asset: any) => asset.assetId);
      if (userNames.length > 0) {
        const userActivity = await this.activityService.getUserActivityCounts(userNames);
        userActivity.forEach((value, key) => activityMap.set(key, value));
      }
    }
  }

  /**
   * Filter relationships based on asset type
   */
  private filterRelationshipsByAssetType(
    assetType: string,
    relationships: LineageData['relationships']
  ): LineageData['relationships'] {
    if (!relationships) {
      return [];
    }
    if (assetType === ASSET_TYPES.datasource) {
      return relationships.filter((r) => r.relationshipType === 'used_by');
    } else if (assetType === ASSET_TYPES.dashboard) {
      return relationships.filter((r) => r.relationshipType === 'uses');
    }
    return relationships;
  }

  /**
   * Find folders accessible to a group
   */
  private findAccessibleFolders(
    cacheEntry: CacheEntry,
    cache: CacheData,
    countedAssets: Set<string>
  ): any[] {
    const groupArn = cacheEntry.arn;
    const groupName = cacheEntry.assetName;
    const accessibleFolders: any[] = [];
    const folders = cache.entries.folder || [];

    for (const folder of folders) {
      const hasAccess = folder.permissions?.some((p: any) =>
        principalMatchesGroup(p.principal, groupArn, groupName)
      );

      if (hasAccess) {
        accessibleFolders.push(folder);
        countedAssets.add(folder.assetId);
      }
    }

    return accessibleFolders;
  }

  /**
   * Get activity sort value based on asset type
   */
  private getActivitySortValue(asset: MappedAsset): number {
    if (asset.assetType === 'user') {
      return asset.activity?.totalActivities || 0;
    }
    return asset.viewStats?.totalViews || asset.activity?.totalViews || 0;
  }

  /**
   * Get array count sort value for various field types
   */
  private getArrayCountSortValue(asset: MappedAsset, sortField: string): number {
    switch (sortField) {
      case 'groups':
        return asset.groups?.length || 0;
      case 'tags':
        return asset.tags?.length || 0;
      case 'folders':
      case 'folderCount':
        return asset.folderCount || asset.folders?.length || 0;
      default:
        return 0;
    }
  }

  /**
   * Get date sort value with fallback to 0
   */
  private getDateSortValue(dateValue: Date | string | undefined): number {
    return dateValue ? new Date(dateValue).getTime() : 0;
  }

  /**
   * Get last activity for asset from activity persistence
   */
  private getLastActivityForAsset(asset: CacheEntry, activityPersistence: any): string | null {
    if (!activityPersistence || !['dashboard', 'analysis'].includes(asset.assetType)) {
      return null;
    }

    const activityMap =
      asset.assetType === 'dashboard'
        ? activityPersistence.dashboards
        : activityPersistence.analyses;

    return activityMap?.[asset.assetId] || null;
  }

  /**
   * Get refresh alert sort value
   */
  private getRefreshAlertSortValue(asset: any): number {
    const refreshProperties = asset.refreshProperties || asset.DataSetRefreshProperties;
    const emailAlert = refreshProperties?.RefreshConfiguration?.ScheduleRefreshOnEntity?.EmailAlert;
    const alertStatus = emailAlert?.alertStatus || emailAlert?.['AlertStatus'];
    return alertStatus === 'ENABLED' ? 1 : 0;
  }

  /**
   * Get relationship count for asset
   */
  private getRelationshipCount(relatedAssets: any, relationshipType: string): number {
    if (Array.isArray(relatedAssets)) {
      return relatedAssets.filter((r: any) => r.relationshipType === relationshipType).length;
    }
    return relatedAssets?.[relationshipType]?.length || 0;
  }

  /**
   * Get search fields for specific asset type
   */
  private getSearchFieldsForAssetType(assetType: string): Array<(item: any) => string> {
    const baseFields = [
      (item: any) => item.name,
      (item: any) => item.id,
      (item: any) => item.type,
      (item: any) => item.tags?.map((t: any) => t.key).join(' ') || '',
      (item: any) => item.tags?.map((t: any) => t.value).join(' ') || '',
    ];

    const typeSpecificFields = [];
    if (assetType === ASSET_TYPES.dataset) {
      typeSpecificFields.push(
        (item: any) => item.sourceType || '',
        (item: any) => item.importMode || ''
      );
    } else if (assetType === ASSET_TYPES.dashboard || assetType === ASSET_TYPES.analysis) {
      typeSpecificFields.push((item: any) => item.dashboardStatus || item.status || '');
    } else if (assetType === ASSET_TYPES.datasource) {
      typeSpecificFields.push((item: any) => item.datasourceType || item.sourceType || '');
    }

    return [...baseFields, ...typeSpecificFields];
  }

  /**
   * Get sort configurations for asset listing
   */
  private getSortConfigsForAssets(): Record<string, SortConfig<any>> {
    // Helper to create a sort config
    const sortConfig = (field: string): SortConfig<any> => ({
      field,
      getValue: (item: any) => this.getSortValue(item, field),
    });

    return {
      name: sortConfig('name'),
      lastModified: sortConfig('lastModified'),
      lastUpdatedTime: sortConfig('lastUpdatedTime'),
      createdTime: sortConfig('createdTime'),
      created: sortConfig('created'),
      viewCount: sortConfig('viewCount'),
      totalViews: sortConfig('totalViews'),
      uniqueViewers: sortConfig('uniqueViewers'),
      lastViewed: sortConfig('lastViewed'),
      lastViewedTime: sortConfig('lastViewedTime'),
      importMode: sortConfig('importMode'),
      sourceType: sortConfig('sourceType'),
      consumedSpiceCapacityInBytes: sortConfig('consumedSpiceCapacityInBytes'),
      spiceCapacity: sortConfig('spiceCapacity'),
      usedBy: sortConfig('usedBy'),
      uses: sortConfig('uses'),
      type: sortConfig('type'),
      memberCount: sortConfig('memberCount'),
      path: sortConfig('path'),
      errors: sortConfig('errors'),
      refreshAlerts: sortConfig('refreshAlerts'),
      activity: sortConfig('activity'),
      groups: sortConfig('groups'),
      tags: sortConfig('tags'),
      folders: sortConfig('folders'),
      folderCount: sortConfig('folderCount'),
    };
  }

  private getSortValue(asset: any, sortField: string): any {
    // Date fields mapping
    const dateFieldMap: Record<string, any> = {
      lastModified: asset.lastUpdatedTime,
      lastUpdatedTime: asset.lastUpdatedTime,
      createdTime: asset.createdTime,
      created: asset.createdTime,
      lastViewed: asset.activity?.lastViewed,
      lastViewedTime: asset.activity?.lastViewed,
    };

    if (sortField in dateFieldMap) {
      return this.getDateSortValue(dateFieldMap[sortField]);
    }

    // Activity and view fields
    if (['viewCount', 'totalViews'].includes(sortField)) {
      return this.getViewCountSortValue(asset);
    }
    if (sortField === 'activity') {
      return this.getActivitySortValue(asset);
    }

    // Relationship fields
    if (sortField === 'usedBy') {
      return this.getRelationshipCount(asset.relatedAssets, 'used_by');
    }
    if (sortField === 'uses') {
      return this.getRelationshipCount(asset.relatedAssets, 'uses');
    }

    // Array count fields
    if (['groups', 'tags', 'folders', 'folderCount'].includes(sortField)) {
      return this.getArrayCountSortValue(asset, sortField);
    }

    // All other fields
    return this.getSpecialFieldSortValue(asset, sortField);
  }

  /**
   * Get special field sort values
   */
  private getSpecialFieldSortValue(asset: any, sortField: string): any {
    const fieldMap: Record<string, any> = {
      name: asset.name,
      uniqueViewers: asset.activity?.uniqueViewers || 0,
      importMode: asset.importMode,
      sourceType: asset.sourceType,
      type: asset.type,
      memberCount: asset.memberCount || asset.Members?.length || 0,
      path: asset.path || asset.fullPath || asset.name || '',
      errors: asset.definitionErrors?.length || 0,
    };

    if (sortField === 'consumedSpiceCapacityInBytes' || sortField === 'spiceCapacity') {
      return asset.sizeInBytes || asset.consumedSpiceCapacityInBytes || 0;
    }

    if (sortField === 'refreshAlerts') {
      return this.getRefreshAlertSortValue(asset);
    }

    return fieldMap[sortField] ?? (asset[sortField] || asset.name);
  }

  /**
   * Get view count sort value with fallbacks
   */
  private getViewCountSortValue(asset: any): number {
    return (
      asset.activity?.totalViews ||
      asset.viewStats?.last30Days?.totalViews ||
      asset.viewStats?.totalViews ||
      0
    );
  }

  /**
   * Handle complex filter types (ranges, dates)
   */
  private handleComplexFilter(itemValue: any, filterValue: any): boolean {
    // Range filters
    if ('min' in filterValue || 'max' in filterValue) {
      const numValue = typeof itemValue === 'number' ? itemValue : parseFloat(itemValue);
      if (isNaN(numValue)) {
        return false;
      }
      if ('min' in filterValue && numValue < filterValue.min) {
        return false;
      }
      if ('max' in filterValue && numValue > filterValue.max) {
        return false;
      }
      return true;
    }

    // Date range filters
    if ('startDate' in filterValue || 'endDate' in filterValue) {
      const dateValue = new Date(itemValue);
      if (isNaN(dateValue.getTime())) {
        return false;
      }
      if ('startDate' in filterValue && dateValue < new Date(filterValue.startDate)) {
        return false;
      }
      if ('endDate' in filterValue && dateValue > new Date(filterValue.endDate)) {
        return false;
      }
      return true;
    }

    return true;
  }

  /**
   * Check if item matches a specific filter
   */
  private itemMatchesFilter(item: any, field: string, filterValue: any): boolean {
    // Special handling for tags field
    if (field === 'tags' && Array.isArray(item.tags)) {
      const searchStr = String(filterValue).toLowerCase();
      const hasMatch = item.tags.some(
        (tag: any) =>
          (tag.key && tag.key.toLowerCase().includes(searchStr)) ||
          (tag.value && tag.value.toLowerCase().includes(searchStr))
      );

      return hasMatch;
    }

    const itemValue = item[field];

    // Handle different filter types
    if (Array.isArray(filterValue)) {
      return filterValue.includes(itemValue);
    } else if (typeof filterValue === 'object' && filterValue !== null) {
      return this.handleComplexFilter(itemValue, filterValue);
    } else {
      return itemValue === filterValue;
    }
  }

  // Handle collection types (users, groups, folders) which are stored differently
  private async listCollectionType(
    assetType: AssetType,
    request: AssetListRequest
  ): Promise<AssetListResponse> {
    try {
      // Use CacheService with new filtering system instead of direct S3 access
      const cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });

      if (!cache || !cache.entries) {
        logger.warn('No cached data found for collection types');
        return { items: [], nextToken: undefined };
      }

      // Get collection assets from cache - already filtered to active only
      const items = cache.entries[assetType] || [];

      if (!Array.isArray(items)) {
        logger.warn(`Invalid cache data format for ${assetType}`);
        return { items: [], nextToken: undefined };
      }

      // Map items using the proper OpenAPI contract mappers
      let mappedItems = items.map((item) => mapCacheEntryToAsset(item));

      // Add group-specific data (assets count) if we're listing groups
      if (assetType === ASSET_TYPES.group) {
        mappedItems = mappedItems.map((item: any, index: number) => {
          const cacheEntry = items[index];
          if (cacheEntry) {
            this.addGroupAssetsCount(item, assetType, cacheEntry, cache);
          }
          return item;
        });
      }

      // Fetch user activity data and groups if we're listing users
      if (assetType === ASSET_TYPES.user) {
        try {
          // For users, the userName is the identifier, not the id
          const userNames = mappedItems.map((item: any) => item.name || item.userName || item.id);

          if (userNames.length > 0) {
            const userActivity = await this.activityService.getUserActivityCounts(userNames);

            logger.debug('User activity results for collection:', {
              activityMapSize: userActivity.size,
              sampleEntries: Array.from(userActivity.entries()).slice(
                0,
                DEBUG_CONFIG.SAMPLE_ENTRIES_TO_LOG
              ),
            });

            // Add activity data and groups to mapped items
            mappedItems = await Promise.all(
              mappedItems.map(async (item: any) => {
                // Look up by name/userName first, then fall back to id
                const lookupKey = item.name || item.userName || item.id;
                const activityData = userActivity.get(lookupKey);

                // Get user groups
                const userGroups = await this.groupService.getUserGroups(lookupKey);
                const groupNames = userGroups.map((g) => g.groupName);

                return {
                  ...item,
                  groups: groupNames,
                  groupCount: groupNames.length,
                  activity: activityData
                    ? {
                        totalActivities: activityData.totalActivities || 0,
                        lastActive: activityData.lastActive || null,
                        dashboardCount: activityData.dashboardCount || 0,
                        analysisCount: activityData.analysisCount || 0,
                      }
                    : item.activity,
                };
              })
            );
          }
        } catch (error) {
          logger.warn('Failed to fetch user activity data for collection:', error);
        }
      }

      // Define search fields for collection types
      const searchFields = [
        (item: any) => item.name || item.userName || item.groupName || '',
        (item: any) => item.id || item.userName || item.groupName || '',
        (item: any) => item.email || '',
        (item: any) => item.type || assetType,
        // For users, also search in their role
        (item: any) => (assetType === 'user' ? item.role || '' : ''),
      ];

      // Define sort configurations for collection types
      const sortConfigs: Record<string, SortConfig<any>> = {
        name: {
          field: 'name',
          getValue: (item: any) => item.name || item.userName || item.groupName || '',
        },
        lastModified: {
          field: 'lastModified',
          getValue: (item: any) => item.lastUpdatedTime || item.createdTime || '',
        },
        lastUpdatedTime: {
          field: 'lastUpdatedTime',
          getValue: (item: any) => item.lastUpdatedTime || item.createdTime || '',
        },
        createdTime: { field: 'createdTime', getValue: (item: any) => item.createdTime || '' },
        memberCount: { field: 'memberCount', getValue: (item: any) => item.memberCount || 0 },
        role: { field: 'role', getValue: (item: any) => item.role || item.metadata?.role || '' },
        active: {
          field: 'active',
          getValue: (item: any) => (item.active !== undefined ? item.active : true),
        },
        path: {
          field: 'path',
          getValue: (item: any) => item.path || item.fullPath || item.name || '',
        },
        activity: {
          field: 'activity',
          getValue: (item: any) => item.activity?.totalActivities || 0,
        },
        groups: { field: 'groups', getValue: (item: any) => item.groups?.length || 0 },
      };

      // Convert startIndex/maxResults to page/pageSize
      const startIndex = request.startIndex || 0;
      const maxResults = request.maxResults || QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS;
      const page = Math.floor(startIndex / maxResults) + 1;

      // Use pagination utilities with mapped items
      const result = processPaginatedData(
        mappedItems,
        {
          page,
          pageSize: maxResults,
          search: request.search,
          sortBy: request.sortBy,
          sortOrder: request.sortOrder?.toLowerCase() as 'asc' | 'desc',
        },
        searchFields,
        sortConfigs
      );

      return {
        items: result.items as any[], // Already mapped to API contract
        nextToken: result.pagination.hasMore ? String(result.pagination.page + 1) : undefined,
        totalCount: result.pagination.totalItems,
      };
    } catch (error) {
      logger.error(`Failed to list ${assetType}:`, error);
      throw error;
    }
  }

  /**
   * Map cache entry to enriched asset with all related data
   */
  private async mapCacheEntryToEnrichedAsset(
    cacheEntry: CacheEntry,
    assetType: string,
    cache: any,
    assetFolderMap: Map<string, Array<{ id: string; name: string; path: string }>>,
    lineageMap: Map<string, any>,
    activityMap: Map<string, any>
  ): Promise<any> {
    // For datasets, resolve sourceType before mapping
    let resolvedCacheEntry = cacheEntry;
    if (assetType === ASSET_TYPES.dataset) {
      resolvedCacheEntry = this.resolveDatasetSourceType(cacheEntry, cache);
    }

    // Use the appropriate mapping function based on asset type
    const mappedAsset = mapCacheEntryToAsset(resolvedCacheEntry);

    // Add folder-specific data
    this.addFolderMemberCount(mappedAsset, assetType, cacheEntry, cache);

    // Add group-specific data (assets count)
    this.addGroupAssetsCount(mappedAsset, assetType, cacheEntry, cache);

    // Add folder membership data
    this.addFolderMembership(mappedAsset, cacheEntry.assetId, assetFolderMap);

    // Add lineage data with activity
    this.addLineageData(mappedAsset, assetType, cacheEntry.assetId, lineageMap, activityMap);

    // Add activity data
    this.addActivityData(mappedAsset, assetType, cacheEntry.assetId, activityMap);

    // Add user groups data
    await this.addUserGroups(mappedAsset, assetType, cacheEntry);

    return mappedAsset;
  }

  /**
   * Resolve dataset source type from datasource ARNs
   */
  private resolveDatasetSourceType(cacheEntry: CacheEntry, cache: CacheData): CacheEntry {
    const datasourceArns = cacheEntry.metadata?.datasourceArns || [];
    const datasourceEntries = cache.entries[ASSET_TYPES.datasource] || [];

    const sourceType = this.determineSourceType(datasourceArns, datasourceEntries, cacheEntry);

    return {
      ...cacheEntry,
      metadata: {
        ...cacheEntry.metadata,
        sourceType,
      },
    };
  }

  /**
   * Resolve source type for datasets without datasource ARNs (flat file datasets)
   */
  private resolveFlatFileDatasetType(
    cacheEntry: CacheEntry,
    datasourceEntries: CacheEntry[]
  ): string {
    const matchResult = findMatchingFlatFileDatasource({
      datasetName: cacheEntry.assetName,
      datasetCreatedTime: cacheEntry.createdTime,
      datasetUpdatedTime: cacheEntry.lastUpdatedTime,
      datasources: datasourceEntries.map((ds: any) => ({
        id: ds.assetId,
        name: ds.assetName,
        type: ds.metadata?.sourceType || 'UNKNOWN',
        createdTime: ds.createdTime,
      })),
    });

    if (matchResult) {
      const datasource = datasourceEntries.find(
        (ds: any) => ds.assetId === matchResult.datasourceId
      );
      return datasource?.metadata?.sourceType || 'FILE';
    }

    return 'FILE'; // Default for datasets without datasources
  }

  /**
   * Resolve source type for multiple datasources
   */
  private resolveMultipleDatasourcesType(
    datasourceArns: string[],
    datasourceEntries: CacheEntry[]
  ): string {
    const datasourceTypes = new Set<string>();

    for (const arn of datasourceArns) {
      const datasourceId = arn.split(':datasource/')[1];
      if (datasourceId) {
        const datasource = datasourceEntries.find((ds: any) => ds.assetId === datasourceId);
        if (datasource?.metadata?.sourceType) {
          datasourceTypes.add(datasource.metadata.sourceType);
        }
      }
    }

    if (datasourceTypes.size > 1) {
      return 'COMPOSITE';
    }

    if (datasourceTypes.size === 1) {
      return Array.from(datasourceTypes)[0] || 'UNKNOWN';
    }

    return 'UNKNOWN';
  }

  /**
   * Resolve source type for single datasource
   */
  private resolveSingleDatasourceType(
    datasourceArn: string,
    datasourceEntries: CacheEntry[],
    cacheEntry: CacheEntry
  ): string {
    const datasourceId = datasourceArn.split(':datasource/')[1];

    logger.debug(`Resolving dataset ${cacheEntry.assetId} datasource`, {
      datasourceArn,
      datasourceId,
      datasetName: cacheEntry.assetName,
    });

    if (!datasourceId) {
      return 'UNKNOWN';
    }

    const datasource = datasourceEntries.find((ds: any) => ds.assetId === datasourceId);

    logger.debug(`Datasource lookup result`, {
      datasourceId,
      found: !!datasource,
      datasourceType: datasource?.metadata?.sourceType,
      availableDatasources: datasourceEntries
        .map((ds: any) => ({ id: ds.assetId, name: ds.assetName }))
        .slice(0, DEBUG_CONFIG.SAMPLE_ENTRIES_TO_LOG),
    });

    return datasource?.metadata?.sourceType || 'UNKNOWN';
  }

  /**
   * Transform archived asset to ArchivedAssetItem format
   */
  private transformArchivedAsset(
    asset: CacheEntry,
    activityPersistence: Record<string, any>
  ): ArchivedAssetItem {
    const archivedMetadata = (asset.metadata as any)?.archived || {};
    const lastActivity = this.getLastActivityForAsset(asset, activityPersistence);

    return {
      // AssetListItem fields
      id: asset.assetId,
      name: asset.assetName,
      type: asset.assetType,
      status: 'archived' as const,
      createdTime: asset.createdTime?.toISOString() || '',
      lastUpdatedTime: asset.lastUpdatedTime?.toISOString() || '',
      lastExportTime: asset.exportedAt?.toISOString() || '',
      enrichmentStatus: asset.enrichmentStatus || 'skeleton',
      enrichmentTimestamps: (asset.metadata as any)?.enrichmentTimestamps || {},
      tags: asset.tags || [],
      permissions: asset.permissions || [],
      // Archived-specific fields
      archivedDate: archivedMetadata.archivedAt || asset.lastUpdatedTime?.toISOString() || null,
      archivedBy: archivedMetadata.archivedBy || 'system',
      archiveReason: archivedMetadata.archiveReason || 'Asset archived',
      lastActivity,
      canRestore: true,
    };
  }

  /**
   * Transform lineage relationships to standard format with activity data
   */
  private transformLineageRelationships(
    relationships: any[],
    activityMap: Map<string, ActivityData>
  ): any[] {
    return relationships.map((rel: any) => {
      const transformed: any = {
        sourceAssetId: rel.sourceAssetId,
        sourceAssetType: rel.sourceAssetType,
        sourceAssetName: rel.sourceAssetName,
        sourceIsArchived: rel.sourceIsArchived || false,
        targetAssetId: rel.targetAssetId,
        targetAssetType: rel.targetAssetType,
        targetAssetName: rel.targetAssetName,
        targetIsArchived: rel.targetIsArchived || false,
        relationshipType: rel.relationshipType,
      };

      // Add activity data for dashboard and analysis targets
      if (rel.targetAssetType === 'dashboard' || rel.targetAssetType === 'analysis') {
        const activityData = activityMap.get(rel.targetAssetId);
        if (activityData) {
          transformed.activity = {
            totalViews: activityData.totalViews || 0,
            uniqueViewers: activityData.uniqueViewers || 0,
            lastViewed: activityData.lastViewed || null,
          };
        }
      }

      return transformed;
    });
  }
}
