/**
 * Asset filtering types for consistent filtering across services
 */

/**
 * Asset status filter options
 */
export enum AssetStatusFilter {
  ALL = 'all', // Include all assets (active + archived)
  ACTIVE = 'active', // Only active assets (status !== 'archived') - MOST COMMON
  ARCHIVED = 'archived', // Only archived assets (status === 'archived')
}

/**
 * Standard cache options with consistent filtering
 */
export interface CacheFilterOptions {
  statusFilter?: AssetStatusFilter;
  assetType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Helper function to determine if an asset matches the status filter
 */
export function matchesStatusFilter(assetStatus: string, filter: AssetStatusFilter): boolean {
  switch (filter) {
    case AssetStatusFilter.ALL:
      return true;
    case AssetStatusFilter.ACTIVE:
      return assetStatus !== 'archived';
    case AssetStatusFilter.ARCHIVED:
      return assetStatus === 'archived';
    default:
      return true;
  }
}

/**
 * Default filter for most operations - active assets only
 */
export const DEFAULT_STATUS_FILTER = AssetStatusFilter.ACTIVE;
