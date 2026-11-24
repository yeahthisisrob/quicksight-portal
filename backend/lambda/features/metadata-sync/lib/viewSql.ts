/**
 * What a Glue view reads. A view that selects from one table is a pointer
 * to it: it shows that table's data under another name, so its SMUS asset
 * should carry that table's descriptions. The pointer is read from the
 * view's own SQL, never from a naming convention.
 */
import type { Table } from '@aws-sdk/client-glue';

const PRESTO_VIEW = /\/\* Presto View: ([A-Za-z0-9+/=]+) \*\//;

/** The SQL a view was defined with: an Athena view's Presto JSON, or a Data Catalog view's representations. */
export function viewSql(table: Table): string {
  const parts: string[] = [];
  for (const text of [table.ViewOriginalText, table.ViewExpandedText]) {
    if (!text) continue;
    const presto = PRESTO_VIEW.exec(text);
    if (presto?.[1]) {
      try {
        const decoded = JSON.parse(Buffer.from(presto[1], 'base64').toString('utf8'));
        parts.push(String(decoded.originalSql ?? ''));
        continue;
      } catch {
        // Not Presto JSON after all; keep the raw text.
      }
    }
    parts.push(text);
  }
  for (const representation of table.ViewDefinition?.Representations ?? []) {
    if (representation.ViewOriginalText) parts.push(representation.ViewOriginalText);
    if (representation.ViewExpandedText) parts.push(representation.ViewExpandedText);
  }
  return parts.join('\n');
}

/** True for an Athena view as well as a Data Catalog view. */
export function isView(table: Table): boolean {
  return Boolean(table.ViewDefinition) || table.TableType === 'VIRTUAL_VIEW';
}

/** The tables of one database a SQL text names, lowercased: `db.table`, quoted or not. */
export function referencedTables(sql: string, database: string): string[] {
  const db = database.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`["\`]?\\b${db}["\`]?\\s*\\.\\s*["\`]?([A-Za-z0-9_]+)["\`]?`, 'gi');
  const found = new Set<string>();
  for (const match of sql.matchAll(pattern)) {
    if (match[1]) found.add(match[1].toLowerCase());
  }
  return [...found];
}
