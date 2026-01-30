import { useState, useCallback, useMemo } from 'react';

import type { components } from '@shared/generated/types';

// Use OpenAPI generated types for consistency
type TagFilter = components['schemas']['TagFilter'];
type AssetFilter = components['schemas']['AssetFilter'];

/**
 * Options for the useFilters hook
 */
export interface UseFiltersOptions {
  /** Initial include tags */
  initialIncludeTags?: TagFilter[];
  /** Initial exclude tags */
  initialExcludeTags?: TagFilter[];
  /** Initial selected assets */
  initialSelectedAssets?: AssetFilter[];
}

/**
 * Return type for the useFilters hook
 */
export interface UseFiltersReturn {
  // State
  includeTags: TagFilter[];
  excludeTags: TagFilter[];
  selectedAssets: AssetFilter[];

  // Include tag operations
  addIncludeTag: (tag: TagFilter) => void;
  removeIncludeTag: (index: number) => void;
  setIncludeTags: (tags: TagFilter[]) => void;

  // Exclude tag operations
  addExcludeTag: (tag: TagFilter) => void;
  removeExcludeTag: (index: number) => void;
  setExcludeTags: (tags: TagFilter[]) => void;

  // Asset operations
  addAsset: (asset: AssetFilter) => void;
  removeAsset: (index: number) => void;
  setSelectedAssets: (assets: AssetFilter[]) => void;

  // Utility
  clearAll: () => void;
  hasFilters: boolean;
  totalFilters: number;

  // API query params
  toQueryParams: () => {
    includeTags?: string;
    excludeTags?: string;
    assetIds?: string;
  };

  // Get asset IDs array (useful for API calls)
  getAssetIds: () => string[];
}

/**
 * Hook for managing filter state with include/exclude tags and asset selection
 * Uses OpenAPI generated types for TagFilter and AssetFilter
 */
export function useFilters(options: UseFiltersOptions = {}): UseFiltersReturn {
  const [includeTags, setIncludeTagsState] = useState<TagFilter[]>(
    options.initialIncludeTags || []
  );
  const [excludeTags, setExcludeTagsState] = useState<TagFilter[]>(
    options.initialExcludeTags || []
  );
  const [selectedAssets, setSelectedAssetsState] = useState<AssetFilter[]>(
    options.initialSelectedAssets || []
  );

  // Include tag operations
  const addIncludeTag = useCallback((tag: TagFilter) => {
    setIncludeTagsState((prev) => {
      // Prevent duplicates
      if (prev.some((t) => t.key === tag.key && t.value === tag.value)) {
        return prev;
      }
      return [...prev, tag];
    });
  }, []);

  const removeIncludeTag = useCallback((index: number) => {
    setIncludeTagsState((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setIncludeTags = useCallback((tags: TagFilter[]) => {
    setIncludeTagsState(tags);
  }, []);

  // Exclude tag operations
  const addExcludeTag = useCallback((tag: TagFilter) => {
    setExcludeTagsState((prev) => {
      // Prevent duplicates
      if (prev.some((t) => t.key === tag.key && t.value === tag.value)) {
        return prev;
      }
      return [...prev, tag];
    });
  }, []);

  const removeExcludeTag = useCallback((index: number) => {
    setExcludeTagsState((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setExcludeTags = useCallback((tags: TagFilter[]) => {
    setExcludeTagsState(tags);
  }, []);

  // Asset operations
  const addAsset = useCallback((asset: AssetFilter) => {
    setSelectedAssetsState((prev) => {
      // Prevent duplicates
      if (prev.some((a) => a.id === asset.id)) {
        return prev;
      }
      return [...prev, asset];
    });
  }, []);

  const removeAsset = useCallback((index: number) => {
    setSelectedAssetsState((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const setSelectedAssets = useCallback((assets: AssetFilter[]) => {
    setSelectedAssetsState(assets);
  }, []);

  // Clear all filters
  const clearAll = useCallback(() => {
    setIncludeTagsState([]);
    setExcludeTagsState([]);
    setSelectedAssetsState([]);
  }, []);

  // Computed values
  const hasFilters = useMemo(
    () => includeTags.length > 0 || excludeTags.length > 0 || selectedAssets.length > 0,
    [includeTags.length, excludeTags.length, selectedAssets.length]
  );

  const totalFilters = useMemo(
    () => includeTags.length + excludeTags.length + selectedAssets.length,
    [includeTags.length, excludeTags.length, selectedAssets.length]
  );

  // Convert to API query params (JSON stringified)
  const toQueryParams = useCallback(() => {
    const params: {
      includeTags?: string;
      excludeTags?: string;
      assetIds?: string;
    } = {};

    if (includeTags.length > 0) {
      params.includeTags = JSON.stringify(includeTags);
    }
    if (excludeTags.length > 0) {
      params.excludeTags = JSON.stringify(excludeTags);
    }
    if (selectedAssets.length > 0) {
      params.assetIds = JSON.stringify(selectedAssets.map((a) => a.id));
    }

    return params;
  }, [includeTags, excludeTags, selectedAssets]);

  // Get asset IDs array
  const getAssetIds = useCallback(() => {
    return selectedAssets.map((a) => a.id);
  }, [selectedAssets]);

  return {
    // State
    includeTags,
    excludeTags,
    selectedAssets,

    // Include tag operations
    addIncludeTag,
    removeIncludeTag,
    setIncludeTags,

    // Exclude tag operations
    addExcludeTag,
    removeExcludeTag,
    setExcludeTags,

    // Asset operations
    addAsset,
    removeAsset,
    setSelectedAssets,

    // Utility
    clearAll,
    hasFilters,
    totalFilters,
    toQueryParams,
    getAssetIds,
  };
}

// Re-export types for convenience
export type { TagFilter, AssetFilter };
