/**
 * The one shape of custom SQL whose columns are known without running it:
 * a plain projection of one table, `SELECT a, b AS c FROM db.table ...`.
 * When that table is a published listing, the columns and their types are
 * in the listing's forms, so the dataset needs no Athena read and no Lake
 * Formation grant. Anything else (a function, an aggregate, a join, a
 * subquery) is left to the engine or to declared columns: guessing would
 * create a dataset QuickSight later refuses to query.
 */

export interface SimpleSelect {
  /** The table as written, lower-cased, without quotes: `db.table` or `catalog.db.table`. */
  table: string;
  /** `*`, or each selected column with the name the dataset will show. */
  columns: '*' | Array<{ source: string; name: string }>;
}

const IDENTIFIER = String.raw`(?:"[^"]+"|` + '`[^`]+`' + String.raw`|[A-Za-z_][\w-]*)`;
const TABLE = `${IDENTIFIER}(?:\\.${IDENTIFIER}){1,2}`;
const SELECT = new RegExp(
  String.raw`^\s*select\s+(?:distinct\s+)?(?<projection>.+?)\s+from\s+(?<table>` +
    TABLE +
    String.raw`)(?:\s+(?:as\s+)?[A-Za-z_]\w*)?(?<rest>\s+(?:where|order\s+by|limit)\b[\s\S]*)?\s*;?\s*$`,
  'i'
);
const COLUMN = new RegExp(
  String.raw`^(?:(?<qualifier>[A-Za-z_]\w*)\.)?(?<column>` +
    IDENTIFIER +
    String.raw`)(?:\s+(?:as\s+)?(?<alias>` +
    IDENTIFIER +
    String.raw`))?$`,
  'i'
);

function unquote(identifier: string): string {
  return identifier.replace(/^["`]|["`]$/g, '');
}

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** The projection and table of a plain single-table select, or undefined for anything else. */
export function parseSimpleSelect(sql: string): SimpleSelect | undefined {
  const match = SELECT.exec(stripComments(sql));
  const projection = match?.groups?.projection;
  const table = match?.groups?.table;
  const rest = match?.groups?.rest ?? '';
  if (!projection || !table || /[()]/.test(rest) || /\bjoin\b|\bunion\b/i.test(rest)) {
    return undefined;
  }
  const tableKey = table.split('.').map(unquote).join('.').toLowerCase();
  if (projection.trim() === '*') {
    return { table: tableKey, columns: '*' };
  }
  if (/[()]/.test(projection)) {
    return undefined;
  }
  const columns: Array<{ source: string; name: string }> = [];
  for (const item of projection.split(',')) {
    const column = COLUMN.exec(item.trim());
    const source = column?.groups?.column;
    if (!source) {
      return undefined;
    }
    const name = unquote(column.groups?.alias ?? source);
    columns.push({ source: unquote(source), name });
  }
  return { table: tableKey, columns };
}
