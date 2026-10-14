/**
 * QuickSight's InputColumn vocabulary, and how a source engine's types map
 * onto it. One home: the columns a SMUS listing declares, the schema Athena
 * reports for a query, and columns a caller declares all come through here.
 */

const QUICKSIGHT_COLUMN_TYPES = [
  'STRING',
  'INTEGER',
  'DECIMAL',
  'DATETIME',
  'BIT',
  'BOOLEAN',
  'JSON',
] as const;

export type QuickSightColumnType = (typeof QUICKSIGHT_COLUMN_TYPES)[number];

export function isQuickSightColumnType(value: unknown): value is QuickSightColumnType {
  return (
    typeof value === 'string' && (QUICKSIGHT_COLUMN_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Glue/Athena source types to the QuickSight InputColumn vocabulary. A type
 * QuickSight has no number or date for (varchar, array, map, row, json) is
 * read as a string, which every engine can hand over.
 */
export function toQuickSightColumnType(sourceType: string): QuickSightColumnType {
  const t = sourceType.trim().toLowerCase();
  if (/^(tinyint|smallint|int|integer|bigint)$/.test(t)) {
    return 'INTEGER';
  }
  if (/^(float|double|real|decimal|numeric)/.test(t)) {
    return 'DECIMAL';
  }
  if (t === 'boolean') {
    return 'BOOLEAN';
  }
  if (/^(timestamp|date|datetime)/.test(t)) {
    return 'DATETIME';
  }
  return 'STRING';
}
