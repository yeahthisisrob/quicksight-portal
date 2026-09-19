/**
 * Cross-dataset filters apply by column name: a filter group scoped to
 * ALL_DATASETS filters every dataset that has a column with that name and
 * silently skips the ones that do not. So a rename in one dataset, or a
 * rebind to a dataset that spells the column differently, splits the
 * filter without any error from QuickSight. This says so before the write.
 */
import { isColumnIdentifier } from './definitionColumns';

interface FilterColumn {
  groupId: string;
  identifier: string;
  columnName: string;
}

function filterColumns(filter: unknown, out: FilterColumn[], groupId: string): void {
  if (Array.isArray(filter)) {
    filter.forEach((f) => filterColumns(f, out, groupId));
    return;
  }
  if (typeof filter !== 'object' || filter === null) {
    return;
  }
  if (isColumnIdentifier(filter)) {
    out.push({ groupId, identifier: filter.DataSetIdentifier, columnName: filter.ColumnName });
    return;
  }
  for (const value of Object.values(filter as Record<string, unknown>)) {
    filterColumns(value, out, groupId);
  }
}

/** The columns every ALL_DATASETS filter group filters on. */
export function crossDatasetFilterColumns(definition: Record<string, any>): FilterColumn[] {
  const out: FilterColumn[] = [];
  for (const group of definition.FilterGroups ?? []) {
    if (group?.CrossDataset !== 'ALL_DATASETS') {
      continue;
    }
    filterColumns(group.Filters ?? [], out, group.FilterGroupId ?? '');
  }
  return out;
}

/**
 * One warning per cross-dataset filter column and dataset that lacks it.
 * `columnsByIdentifier` is what each declared dataset actually has, after
 * any rebind.
 */
export function crossDatasetFilterWarnings(
  definition: Record<string, any>,
  columnsByIdentifier: Map<string, Set<string>>
): string[] {
  const warnings = new Set<string>();
  for (const filter of crossDatasetFilterColumns(definition)) {
    for (const [identifier, columns] of columnsByIdentifier) {
      if (identifier === filter.identifier || columns.has(filter.columnName)) {
        continue;
      }
      warnings.add(
        `The filter on ${filter.columnName} (${filter.identifier}) applies to every dataset by column name, but '${identifier}' has no column '${filter.columnName}', so it will not be filtered.`
      );
    }
  }
  return [...warnings];
}
