/**
 * A tag to filter by. Lists take these JSON-encoded in `includeTags` /
 * `excludeTags` (see encodeTagFilters).
 */
interface TagFilter {
  key: string;
  value: string;
}

/** An asset picked in the filter bar: UI state, never sent as such. */
interface AssetFilter {
  id: string;
  name: string;
  /** dashboard, analysis, dataset, ... */
  type: string;
}

// Re-export types for convenience
export type { AssetFilter, TagFilter };
