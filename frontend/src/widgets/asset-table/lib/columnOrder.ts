/**
 * The column order of every asset table, stated once per type instead of
 * spliced together. Identity first (name, id), then dates, then who can see
 * it and how it is filed (permissions, tags, folders), then what it is
 * connected to (used by, uses), then how it is used and whether it works
 * (activity, health), then the type's own facts. Columns that are off by
 * default sit last so the visible ones read left to right.
 */
import type { ColumnConfig } from '@/features/asset-management';

const IDENTITY = ['actions', 'name', 'id'] as const;
const DATES = ['lastModified', 'createdTime'] as const;
const GOVERNANCE = ['permissions', 'tags', 'folders'] as const;
const HEALTH = ['healthCount', 'healthLoad', 'healthErrors'] as const;
const HIDDEN_LAST = ['status', 'enrichmentStatus'] as const;

export const PREFERRED_COLUMN_ORDER: Record<string, readonly string[]> = {
  dashboard: [
    ...IDENTITY,
    ...DATES,
    ...GOVERNANCE,
    'uses',
    'activity',
    ...HEALTH,
    'sheetCount',
    'visualCount',
    'errors',
    ...HIDDEN_LAST,
  ],
  analysis: [
    ...IDENTITY,
    ...DATES,
    ...GOVERNANCE,
    'usedBy',
    'uses',
    'activity',
    'sheetCount',
    'visualCount',
    'errors',
    ...HIDDEN_LAST,
  ],
  dataset: [
    ...IDENTITY,
    ...DATES,
    ...GOVERNANCE,
    'usedBy',
    'uses',
    'activity',
    ...HEALTH,
    'sourceType',
    'importMode',
    'schemas',
    'spiceCapacity',
    'refreshAlerts',
    'refreshSchedule',
    ...HIDDEN_LAST,
  ],
  datasource: [...IDENTITY, ...DATES, ...GOVERNANCE, 'usedBy', 'sourceType', ...HIDDEN_LAST],
  folder: [...IDENTITY, ...DATES, 'permissions', 'tags', 'path', 'memberCount', ...HIDDEN_LAST],
  user: [...IDENTITY, 'email', 'activity', 'permissions', 'groups', 'role', 'tags', ...HIDDEN_LAST],
  group: ['actions', 'name', 'description', 'tags', 'memberCount', 'assetsCount', ...HIDDEN_LAST],
};

/**
 * Sort columns by the type's preferred order. Ids the order does not name
 * keep their relative order and follow the named ones, so a new column
 * shows up at the end rather than disappearing.
 */
export function orderColumns(assetType: string, columns: ColumnConfig[]): ColumnConfig[] {
  const preferred = PREFERRED_COLUMN_ORDER[assetType];
  if (!preferred) {
    return columns;
  }
  const rank = new Map(preferred.map((id, index) => [id, index]));
  const known = columns
    .filter((c) => rank.has(c.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const unknown = columns.filter((c) => !rank.has(c.id));
  return [...known, ...unknown];
}
