/**
 * Shared filter utilities for computing available filter options and resolving source types.
 * Used by AssetService, IngestionHandler, and IngestionProcessor.
 */

export interface FilterOption {
  value: string;
  count: number;
}

type SortOrder = 'alpha' | 'count';

/**
 * Count occurrences of values extracted from items.
 * Generic utility that replaces duplicate computeAvailableRoles/Groups/SourceTypes patterns.
 *
 * @param items - Array of items to count
 * @param extractor - Function to extract value(s) from each item. Return string for single, string[] for multi.
 * @param sort - Sort order: 'alpha' for alphabetical, 'count' for descending count (default: 'count')
 */
export function countByField(
  items: any[],
  extractor: (item: any) => string | string[] | undefined,
  sort: SortOrder = 'count'
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const values = extractor(item);
    if (!values) {
      continue;
    }
    const arr = Array.isArray(values) ? values : [values];
    for (const v of arr) {
      if (v) {
        counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
  }
  const result = Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
  return sort === 'alpha'
    ? result.sort((a, b) => a.value.localeCompare(b.value))
    : result.sort((a, b) => b.count - a.count);
}

/**
 * Resolve datasource type from datasource ARNs by looking up cached datasource entries.
 * Shared between IngestionHandler (list enrichment) and IngestionProcessor (export enrichment).
 */
export function resolveSourceTypeFromArns(
  datasourceArns: string[],
  datasourceEntries: any[]
): string {
  if (datasourceArns.length === 0) {
    return 'FILE';
  }

  const types = new Set<string>();
  for (const arn of datasourceArns) {
    const datasourceId = arn.split(':datasource/')[1];
    if (datasourceId) {
      const ds = datasourceEntries.find((d: any) => d.assetId === datasourceId);
      if (ds?.metadata?.sourceType) {
        types.add(ds.metadata.sourceType);
      }
    }
  }

  if (types.size === 0) {
    return 'UNKNOWN';
  }
  if (types.size > 1) {
    return 'COMPOSITE';
  }
  return Array.from(types)[0] || 'UNKNOWN';
}
