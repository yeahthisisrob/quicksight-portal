/**
 * Datasets that already read a table, before another one is made over it:
 * as the table itself, or inside a custom SQL query that names it. Judged
 * from the physical tables the catalog keeps for every dataset, the same
 * facts the SMUS link is derived from, so it works with or without SMUS.
 */
import type { CatalogEntry } from '../../models/asset.model';
import { extractSqlTableRefs } from '../parsing/DatasetParser';

export interface SimilarDataset {
  dataSetId: string;
  name: string;
  /** The table both read, as `schema.table`. */
  table: string;
  /** Read as the table itself, or inside a custom SQL query. */
  how: 'table' | 'sql';
}

const MAX_SIMILAR = 10;

/** `catalog.db.table` and `db.table` both read as `db.table`; a bare name stays bare. */
function tableKey(ref: string): string {
  const parts = ref.trim().toLowerCase().split('.').filter(Boolean);
  return parts.slice(-2).join('.');
}

/** The tables a physical table reads, as keys. */
export function tablesRead(table: {
  kind: 'RELATIONAL' | 'CUSTOM_SQL';
  name: string;
  schema?: string;
  sql?: string;
}): string[] {
  if (table.kind === 'RELATIONAL') {
    return [tableKey(table.schema ? `${table.schema}.${table.name}` : table.name)];
  }
  return extractSqlTableRefs(table.sql).map(tableKey);
}

export function similarDatasets(datasets: CatalogEntry[], reads: string[]): SimilarDataset[] {
  const wanted = new Set(reads.map(tableKey).filter(Boolean));
  if (wanted.size === 0) {
    return [];
  }
  const found: SimilarDataset[] = [];
  for (const dataset of datasets) {
    const tables: any[] = dataset.metadata?.lineageData?.physicalTables ?? [];
    for (const t of tables) {
      if (t?.type === 'RELATIONAL' && typeof t.name === 'string') {
        const key = tableKey(t.schema ? `${t.schema}.${t.name}` : t.name);
        if (wanted.has(key)) {
          found.push({
            dataSetId: dataset.assetId,
            name: dataset.assetName,
            table: key,
            how: 'table',
          });
          break;
        }
      }
      const refs: unknown[] = Array.isArray(t?.sqlTables) ? t.sqlTables : [];
      const hit = refs.map((r) => tableKey(String(r))).find((key) => wanted.has(key));
      if (hit) {
        found.push({ dataSetId: dataset.assetId, name: dataset.assetName, table: hit, how: 'sql' });
        break;
      }
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_SIMILAR);
}
