/**
 * Strictly typed asset types - always singular
 * Use these constants instead of string literals to prevent typos and enable refactoring
 */
export const ASSET_TYPES = {
  dashboard: 'dashboard',
  analysis: 'analysis',
  dataset: 'dataset',
  datasource: 'datasource',
  folder: 'folder',
  user: 'user',
  group: 'group',
} as const;

export type AssetType = (typeof ASSET_TYPES)[keyof typeof ASSET_TYPES];

/**
 * Plural forms for S3 paths and API endpoints
 */
export const ASSET_TYPES_PLURAL = {
  dashboard: 'dashboards',
  analysis: 'analyses',
  dataset: 'datasets',
  datasource: 'datasources',
  folder: 'folders',
  user: 'users',
  group: 'groups',
} as const;

type AssetTypePlural = (typeof ASSET_TYPES_PLURAL)[keyof typeof ASSET_TYPES_PLURAL];

/**
 * Asset types that have field data
 */
export const ASSET_TYPES_WITH_FIELDS: readonly AssetType[] = [
  ASSET_TYPES.dashboard,
  ASSET_TYPES.analysis,
  ASSET_TYPES.dataset,
] as const;

/**
 * Asset types stored as collections
 */
export const COLLECTION_ASSET_TYPES: readonly AssetType[] = [
  ASSET_TYPES.user,
  ASSET_TYPES.group,
  ASSET_TYPES.folder,
] as const;

/**
 * Type guard to check if a string is a valid AssetType
 */
function isAssetType(value: string): value is AssetType {
  return Object.values(ASSET_TYPES).includes(value as AssetType);
}

/**
 * Type guard to check if an asset type is a collection type
 */
export function isCollectionType(assetType: AssetType): boolean {
  return COLLECTION_ASSET_TYPES.includes(assetType);
}

/**
 * Get the plural form for an asset type
 */
export function getPluralForm(assetType: AssetType): AssetTypePlural {
  return ASSET_TYPES_PLURAL[assetType];
}

/**
 * Get the singular form from either singular or plural asset type
 * Handles both "dashboard" and "dashboards" -> "dashboard"
 */
export function getSingularForm(assetTypeOrPlural: string): AssetType | undefined {
  // Check if it's already a singular form
  if (isAssetType(assetTypeOrPlural)) {
    return assetTypeOrPlural;
  }

  // Try to find it in the plural mapping
  const entry = Object.entries(ASSET_TYPES_PLURAL).find(
    ([_, plural]) => plural === assetTypeOrPlural
  );
  return entry ? (entry[0] as AssetType) : undefined;
}

/**
 * Folder information for assets
 */
export interface FolderInfo {
  id: string;
  name: string;
  path: string;
}

/**
 * Cache data structure for assets
 */
export interface CacheData {
  entries: Record<AssetType, any[]>;
}
