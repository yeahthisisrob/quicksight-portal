/**
 * Shared filter types for data catalog and asset filtering
 * These types match the OpenAPI schema definitions
 */

/**
 * Filter for tags with key-value pairs
 * Used for include/exclude tag filtering in data catalog
 */
export interface TagFilter {
  key: string;
  value: string;
}

/**
 * Check if an asset matches the include tags filter (OR logic)
 * Asset must have at least one of the include tags
 */
export function matchesIncludeTags(assetTags: TagFilter[], includeTags: TagFilter[]): boolean {
  if (!includeTags || includeTags.length === 0) {
    return true; // No filter means include all
  }

  return includeTags.some((includeTag) =>
    assetTags.some((tag) => tag.key === includeTag.key && tag.value === includeTag.value)
  );
}

/**
 * Check if an asset matches the exclude tags filter (AND NOT logic)
 * Asset must not have any of the exclude tags
 */
export function matchesExcludeTags(assetTags: TagFilter[], excludeTags: TagFilter[]): boolean {
  if (!excludeTags || excludeTags.length === 0) {
    return true; // No filter means exclude none
  }

  return !excludeTags.some((excludeTag) =>
    assetTags.some((tag) => tag.key === excludeTag.key && tag.value === excludeTag.value)
  );
}

/**
 * Check if an asset ID is in the allowed asset IDs list
 */
export function matchesAssetIds(assetId: string, assetIds?: string[]): boolean {
  if (!assetIds || assetIds.length === 0) {
    return true; // No filter means include all
  }

  return assetIds.includes(assetId);
}
