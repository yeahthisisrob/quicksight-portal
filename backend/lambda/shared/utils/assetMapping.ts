/**
 * Clean asset mapping utilities
 * Maps from lightweight cache entries to API response models
 */

import type { components } from '@shared/generated/types';

import type { CatalogEntry } from '../models/asset.model';
import { ASSET_TYPES } from '../types/assetTypes';

type AssetListItem = components['schemas']['AssetListItem'];
type FolderListItem = components['schemas']['FolderListItem'];
type DashboardListItem = components['schemas']['DashboardListItem'];
type DatasetListItem = components['schemas']['DatasetListItem'];
type UserListItem = components['schemas']['UserListItem'];
type AnalysisListItem = components['schemas']['AnalysisListItem'];
type DatasourceListItem = components['schemas']['DatasourceListItem'];
type GroupListItem = components['schemas']['GroupListItem'];
type ThemeListItem = components['schemas']['ThemeListItem'];

/**
 * Base mapping for all asset types from cache entry
 */
function mapBaseAssetFields(entry: CatalogEntry): AssetListItem & { arn: string } {
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
export function mapFolderFromCache(entry: CatalogEntry): FolderListItem & { arn: string } {
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
function mapDashboardFromCache(entry: CatalogEntry): DashboardListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    dashboardStatus: (entry.metadata.status as string) || 'CREATION_SUCCESSFUL',
    visualCount: entry.metadata.visualCount || 0,
    sheetCount: entry.metadata.sheetCount || 0,
    datasetCount: entry.metadata.datasetCount || 0,
    activity: entry.metadata.activity || undefined,
    definitionErrors: entry.metadata.definitionErrors || undefined,
    ...(entry.metadata.themeArn ? { themeArn: String(entry.metadata.themeArn) } : {}),
  };
}

/**
 * Map analysis cache entry to analysis list item
 */
function mapAnalysisFromCache(entry: CatalogEntry): AnalysisListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    dashboardStatus: (entry.metadata.status as string) || 'CREATION_SUCCESSFUL',
    visualCount: entry.metadata.visualCount || 0,
    sheetCount: entry.metadata.sheetCount || 0,
    datasetCount: entry.metadata.datasetCount || 0,
    activity: entry.metadata.activity || undefined,
    definitionErrors: entry.metadata.definitionErrors || undefined,
    ...(entry.metadata.themeArn ? { themeArn: String(entry.metadata.themeArn) } : {}),
  };
}

/**
 * Distinct source schemas (databases) for a dataset, from the RelationalTable
 * entries captured in lineage at export time. Schema is the database for
 * Athena sources and the schema for Redshift and other relational engines.
 */
function extractDatasetSchemas(metadata: any): string[] {
  const physicalTables: any[] = metadata?.lineageData?.physicalTables || [];
  const schemas = new Set<string>();
  for (const table of physicalTables) {
    if (table?.schema) {
      schemas.add(table.schema);
    }
    // Custom-SQL tables (common for Athena) carry no RelationalTable schema;
    // derive it from the parsed db.table / catalog.db.table refs instead.
    for (const ref of table?.sqlTables || []) {
      const parts = String(ref).split('.');
      const db = parts.length >= 2 ? parts[parts.length - 2] : undefined;
      if (db) {
        schemas.add(db);
      }
    }
  }
  return Array.from(schemas).sort();
}

/**
 * Map dataset cache entry to dataset list item
 */
function mapDatasetFromCache(entry: CatalogEntry): DatasetListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  // Extract refresh data from the correct location
  const metadata = entry.metadata as any;
  const refreshData = metadata.refreshData || {};

  return {
    ...base,
    importMode: metadata.importMode || 'SPICE',
    fieldCount: metadata.fieldCount || 0,
    sourceType: metadata.sourceType || 'UNKNOWN',
    schemas: extractDatasetSchemas(metadata),
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
function mapDatasourceFromCache(entry: CatalogEntry): DatasourceListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    sourceType: entry.metadata.sourceType || entry.metadata.datasourceType || 'UNKNOWN',
    connectionMode: entry.metadata.connectionMode || 'UNKNOWN',
  };
}

/**
 * Map user cache entry to user list item
 */
function mapUserFromCache(entry: CatalogEntry): UserListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    email: entry.metadata.email || '',
    role: entry.metadata.role || 'READER',
    active: entry.metadata.active !== false,
    groupCount: 0,
    assetAccessCount: 0,
    groups: [],
  };
}

/**
 * Map group cache entry to asset list item
 */
function mapGroupFromCache(entry: CatalogEntry): GroupListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);

  return {
    ...base,
    description: entry.metadata?.description || '',
    memberCount: entry.metadata?.memberCount || 0,
    // The parser writes `arn`; older cache entries may say `memberArn`.
    members: ((entry.metadata?.members ?? []) as Array<Record<string, string | undefined>>)
      .filter((m) => m.memberName)
      .map((m) => ({
        memberName: String(m.memberName),
        arn: String(m.arn ?? m.memberArn ?? ''),
        ...(m.email ? { email: m.email } : {}),
      })),
  };
}

/**
 * Map theme cache entry to theme list item. How many dashboards and
 * analyses use it is counted over the whole cache (see AssetService).
 */
function mapThemeFromCache(entry: CatalogEntry): ThemeListItem & { arn: string } {
  const base = mapBaseAssetFields(entry);
  const metadata = entry.metadata as Record<string, any>;
  return {
    ...base,
    baseThemeId: metadata.baseThemeId || 'CLASSIC',
    ...(typeof metadata.versionNumber === 'number'
      ? { versionNumber: metadata.versionNumber }
      : {}),
    dataColors: Array.isArray(metadata.dataColors) ? metadata.dataColors : [],
    uiColors: metadata.uiColors && typeof metadata.uiColors === 'object' ? metadata.uiColors : {},
    ...(metadata.fontFamily ? { fontFamily: metadata.fontFamily } : {}),
    usedBy: { dashboards: 0, analyses: 0 },
  };
}

/**
 * Asset type to mapper function mapping
 */
const ASSET_MAPPERS: Record<string, (entry: CatalogEntry) => AssetListItem & { arn: string }> = {
  [ASSET_TYPES.folder]: mapFolderFromCache,
  [ASSET_TYPES.dashboard]: mapDashboardFromCache,
  [ASSET_TYPES.analysis]: mapAnalysisFromCache,
  [ASSET_TYPES.dataset]: mapDatasetFromCache,
  [ASSET_TYPES.datasource]: mapDatasourceFromCache,
  [ASSET_TYPES.user]: mapUserFromCache,
  [ASSET_TYPES.group]: mapGroupFromCache,
  [ASSET_TYPES.theme]: mapThemeFromCache,
};

/**
 * Main mapping function - routes to appropriate mapper based on asset type
 */
export function mapCacheEntryToAsset(entry: CatalogEntry): AssetListItem & { arn: string } {
  const mapper = ASSET_MAPPERS[entry.assetType];
  return mapper ? mapper(entry) : mapBaseAssetFields(entry);
}
