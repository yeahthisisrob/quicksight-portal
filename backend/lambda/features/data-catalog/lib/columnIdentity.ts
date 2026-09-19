/**
 * Tying a QuickSight column back to the SMUS listing column it came from.
 *
 * The two catalogs are the same table seen twice, but the names rarely match
 * byte for byte: Glue says `customer_id`, a QuickSight dataset may expose it as
 * `Customer ID` after a rename, and a custom SQL alias may write `CustomerId`.
 * Matching on the exact lowercase name misses all three, which reads in the UI
 * as "this column is not in SMUS" when it plainly is.
 *
 * So identity is the same idea the dataset-to-listing matcher uses: case,
 * separators and camel-case humps carry no meaning, everything else does.
 */

/** `Customer ID`, `customer-id` and `CustomerId` all normalize to `customer_id`. */
export function normalizeColumnName(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

/** How a QuickSight column found its listing column. */
export type ColumnMatchKind = 'exact' | 'normalized' | 'listing-only';

export interface ListingColumn {
  name: string;
  type?: string;
  description?: string;
}

export interface ColumnMatch {
  column: ListingColumn;
  match: Exclude<ColumnMatchKind, 'listing-only'>;
}

/**
 * The listing column a QuickSight column refers to, by exact name first so an
 * exact hit always beats a normalized one, whatever order the columns arrive in.
 */
export function matchListingColumn(
  columnName: string,
  columns: readonly ListingColumn[] | undefined
): ColumnMatch | undefined {
  if (!columnName || !columns?.length) {
    return undefined;
  }
  const named = columns.filter((c) => c.name);
  const exact = named.find((c) => c.name === columnName);
  if (exact) {
    return { column: exact, match: 'exact' };
  }
  const needle = normalizeColumnName(columnName);
  const loose = named.find((c) => normalizeColumnName(c.name) === needle);
  return loose ? { column: loose, match: 'normalized' } : undefined;
}
