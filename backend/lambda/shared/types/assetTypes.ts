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

export type AssetTypePlural = (typeof ASSET_TYPES_PLURAL)[keyof typeof ASSET_TYPES_PLURAL];

/**
 * Asset types that have field data
 */
export const ASSET_TYPES_WITH_FIELDS: readonly AssetType[] = [
  ASSET_TYPES.dashboard,
  ASSET_TYPES.analysis,
  ASSET_TYPES.dataset,
] as const;

/**
 * Asset types that support definition operations (DescribeDefinition APIs)
 */
export const ASSET_TYPES_WITH_DEFINITIONS: readonly AssetType[] = [
  ASSET_TYPES.dashboard,
  ASSET_TYPES.analysis,
] as const;

/**
 * Asset types that support permissions
 */
export const ASSET_TYPES_WITH_PERMISSIONS: readonly AssetType[] = [
  ASSET_TYPES.dashboard,
  ASSET_TYPES.analysis,
  ASSET_TYPES.dataset,
  ASSET_TYPES.datasource,
  ASSET_TYPES.folder,
] as const;

/**
 * Asset types that support tags
 */
export const ASSET_TYPES_WITH_TAGS: readonly AssetType[] = [
  ASSET_TYPES.dashboard,
  ASSET_TYPES.analysis,
  ASSET_TYPES.dataset,
  ASSET_TYPES.datasource,
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
export function isAssetType(value: string): value is AssetType {
  return Object.values(ASSET_TYPES).includes(value as AssetType);
}

/**
 * Type guard to check if an asset type has fields
 */
export function hasFields(assetType: AssetType): boolean {
  return ASSET_TYPES_WITH_FIELDS.includes(assetType);
}

/**
 * Type guard to check if an asset type supports definitions
 */
export function hasDefinitions(assetType: AssetType): boolean {
  return ASSET_TYPES_WITH_DEFINITIONS.includes(assetType);
}

/**
 * Type guard to check if an asset type supports permissions
 */
export function hasPermissions(assetType: AssetType): boolean {
  return ASSET_TYPES_WITH_PERMISSIONS.includes(assetType);
}

/**
 * Type guard to check if an asset type supports tags
 */
export function hasTags(assetType: AssetType): boolean {
  return ASSET_TYPES_WITH_TAGS.includes(assetType);
}

/**
 * Type guard to check if an asset type is a collection type
 */
export function isCollectionType(assetType: AssetType): boolean {
  return COLLECTION_ASSET_TYPES.includes(assetType);
}

/**
 * Asset capabilities interface
 */
export interface AssetCapabilities {
  hasDefinition: boolean;
  hasPermissions: boolean;
  hasTags: boolean;
  hasFields: boolean;
  isCollection: boolean;
}

/**
 * Get all capabilities for an asset type
 */
export function getAssetCapabilities(assetType: AssetType): AssetCapabilities {
  return {
    hasDefinition: hasDefinitions(assetType),
    hasPermissions: hasPermissions(assetType),
    hasTags: hasTags(assetType),
    hasFields: hasFields(assetType),
    isCollection: isCollectionType(assetType),
  };
}

/**
 * Type-safe asset type that prevents accidental plural usage
 * This will cause compile errors if you try to pass a plural string
 */
export type StrictAssetType = AssetType & { readonly __brand: 'AssetType' };

/**
 * Convert and validate asset type
 */
export function strictAssetType(value: string): StrictAssetType {
  if (!isAssetType(value)) {
    throw new Error(
      `Invalid asset type: ${value}. Must be one of: ${Object.values(ASSET_TYPES).join(', ')}`
    );
  }
  return value as StrictAssetType;
}

/**
 * Get the plural form for an asset type
 */
export function getPluralForm(assetType: AssetType): AssetTypePlural {
  return ASSET_TYPES_PLURAL[assetType];
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
