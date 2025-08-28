/**
 * Clean asset mapping utilities
 * Maps from lightweight cache entries to API response models
 */

import type { components } from '@shared/generated/types';

import { type CacheEntry } from '../models/asset.model';
import { ASSET_TYPES } from '../types/assetTypes';

type AssetListItem = components['schemas']['AssetListItem'];
type FolderListItem = components['schemas']['FolderListItem'];
type DashboardListItem = components['schemas']['DashboardListItem'];
type DatasetListItem = components['schemas']['DatasetListItem'];
type UserListItem = components['schemas']['UserListItem'];

/**
 * Base mapping for all asset types from cache entry
 */
function mapBaseAssetFields(entry: CacheEntry): AssetListItem & { arn: string } {
  return {
    id: entry.assetId,
    name: entry.assetName,
    type: entry.assetType,
    arn: entry.arn,
    status: entry.status,

    // QuickSight timestamps - handle both Date objects and strings
    createdTime:
      typeof entry.createdTime === 'string' ? entry.createdTime : entry.createdTime.toISOString(),
    lastUpdatedTime:
      typeof entry.lastUpdatedTime === 'string'
        ? entry.lastUpdatedTime
        : entry.lastUpdatedTime.toISOString(),

    // Portal metadata
    lastExportTime:
      typeof entry.exportedAt === 'string' ? entry.exportedAt : entry.exportedAt.toISOString(),
    enrichmentStatus: entry.enrichmentStatus as any,

    // Fast access
    tags: entry.tags || [],
    permissions: entry.permissions || [],
  };
}

/**
 * Map folder cache entry to folder list item
 */
export function mapFolderFromCache(entry: CacheEntry): FolderListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    path: entry.metadata?.fullPath || (entry.assetName ? `/${entry.assetName}` : '/Unknown'),
    memberCount: entry.metadata?.memberCount || 0,
    parentId: entry.metadata?.parentId,
  };
}

/**
 * Map dashboard cache entry to dashboard list item
 */
export function mapDashboardFromCache(entry: CacheEntry): DashboardListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    dashboardStatus: (entry.metadata.status as string) || 'CREATION_SUCCESSFUL',
    visualCount: entry.metadata.visualCount || 0,
    sheetCount: entry.metadata.sheetCount || 0,
    datasetCount: entry.metadata.datasetCount || 0,
    activity: entry.metadata.activity || undefined,
    definitionErrors: entry.metadata.definitionErrors || undefined,
  };
}

/**
 * Map analysis cache entry to analysis list item
 */
export function mapAnalysisFromCache(entry: CacheEntry): DashboardListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    dashboardStatus: (entry.metadata.status as string) || 'CREATION_SUCCESSFUL',
    visualCount: entry.metadata.visualCount || 0,
    sheetCount: entry.metadata.sheetCount || 0,
    datasetCount: entry.metadata.datasetCount || 0,
    activity: entry.metadata.activity || undefined,
    definitionErrors: entry.metadata.definitionErrors || undefined,
  };
}

/**
 * Map dataset cache entry to dataset list item
 */
export function mapDatasetFromCache(entry: CacheEntry): DatasetListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  // Extract refresh data from the correct location
  const metadata = entry.metadata as any;
  const refreshData = metadata.refreshData || {};

  return {
    ...base,
    importMode: metadata.importMode || 'SPICE',
    fieldCount: metadata.fieldCount || 0,
    sourceType: metadata.sourceType || 'UNKNOWN',
    sizeInBytes: metadata.consumedSpiceCapacityInBytes || metadata.sizeInBytes || 0,
    hasRefreshProperties:
      refreshData.hasRefreshProperties || metadata.hasRefreshProperties || false,
    refreshScheduleCount: refreshData.refreshScheduleCount || metadata.refreshScheduleCount || 0,
    refreshSchedules: refreshData.refreshSchedules || metadata.refreshSchedules || [],
    dataSetRefreshProperties:
      refreshData.dataSetRefreshProperties || metadata.dataSetRefreshProperties || undefined,
  };
}

/**
 * Map datasource cache entry to datasource list item
 */
export function mapDatasourceFromCache(entry: CacheEntry): AssetListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    sourceType: entry.metadata.sourceType || entry.metadata.datasourceType || 'UNKNOWN',
    connectionMode: entry.metadata.connectionMode || 'UNKNOWN',
  } as any;
}

/**
 * Map user cache entry to user list item
 */
export function mapUserFromCache(entry: CacheEntry): UserListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    email: entry.metadata.email || '',
    role: entry.metadata.role || 'READER',
    active: entry.metadata.active !== false,
    groupCount: 0,
    groups: [],
  };
}

/**
 * Map group cache entry to asset list item
 */
export function mapGroupFromCache(entry: CacheEntry): AssetListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    description: entry.metadata?.description || '',
    memberCount: entry.metadata?.memberCount || 0,
    members: entry.metadata?.members || [],
  } as any;
}

/**
 * Asset type to mapper function mapping
 */
const ASSET_MAPPERS: Record<string, (entry: CacheEntry) => AssetListItem & { arn: string }> = {
  [ASSET_TYPES.folder]: mapFolderFromCache,
  [ASSET_TYPES.dashboard]: mapDashboardFromCache,
  [ASSET_TYPES.analysis]: mapAnalysisFromCache,
  [ASSET_TYPES.dataset]: mapDatasetFromCache,
  [ASSET_TYPES.datasource]: mapDatasourceFromCache,
  [ASSET_TYPES.user]: mapUserFromCache,
  [ASSET_TYPES.group]: mapGroupFromCache,
};

/**
 * Main mapping function - routes to appropriate mapper based on asset type
 */
export function mapCacheEntryToAsset(entry: CacheEntry): AssetListItem & { arn: string } {
  const mapper = ASSET_MAPPERS[entry.assetType];
  return mapper ? mapper(entry) : mapBaseAssetFields(entry);
}
