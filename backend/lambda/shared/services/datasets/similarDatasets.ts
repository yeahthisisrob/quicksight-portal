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

/** The tables a catalogued dataset reads, as keys: its relational tables and the tables its queries name. */
export function tablesReadByEntry(dataset: CatalogEntry): string[] {
  const tables: any[] = dataset.metadata?.lineageData?.physicalTables ?? [];
  const keys = new Set<string>();
  for (const t of tables) {
    if (t?.type === 'RELATIONAL' && typeof t.name === 'string') {
      keys.add(tableKey(t.schema ? `${t.schema}.${t.name}` : t.name));
    }
    for (const ref of Array.isArray(t?.sqlTables) ? t.sqlTables : []) {
      keys.add(tableKey(String(ref)));
    }
  }
  keys.delete('');
  return [...keys];
}

/**
 * For every dataset, the other datasets that read one of the same tables.
 * One pass over the catalog: datasets are grouped by table, then each
 * dataset collects the members of its tables' groups.
 */
export function duplicateGroups(datasets: CatalogEntry[]): Map<string, SimilarDataset[]> {
  const byTable = new Map<string, Array<{ dataset: CatalogEntry; how: 'table' | 'sql' }>>();
  for (const dataset of datasets) {
    const tables: any[] = dataset.metadata?.lineageData?.physicalTables ?? [];
    const seen = new Set<string>();
    for (const t of tables) {
      const reads: Array<[string, 'table' | 'sql']> = [];
      if (t?.type === 'RELATIONAL' && typeof t.name === 'string') {
        reads.push([tableKey(t.schema ? `${t.schema}.${t.name}` : t.name), 'table']);
      }
      for (const ref of Array.isArray(t?.sqlTables) ? t.sqlTables : []) {
        reads.push([tableKey(String(ref)), 'sql']);
      }
      for (const [key, how] of reads) {
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const group = byTable.get(key) ?? [];
        group.push({ dataset, how });
        byTable.set(key, group);
      }
    }
  }
  const result = new Map<string, SimilarDataset[]>();
  for (const [table, members] of byTable) {
    if (members.length < 2) continue;
    for (const { dataset } of members) {
      const others = result.get(dataset.assetId) ?? [];
      for (const other of members) {
        if (other.dataset.assetId === dataset.assetId) continue;
        if (others.some((o) => o.dataSetId === other.dataset.assetId)) continue;
        others.push({
          dataSetId: other.dataset.assetId,
          name: other.dataset.assetName,
          table,
          how: other.how,
        });
      }
      result.set(dataset.assetId, others);
    }
  }
  for (const others of result.values()) {
    others.sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}

/**
 * The datasets reading any of `reads`. `limit` caps the answer for a
 * preview; a page listing every one passes `Number.POSITIVE_INFINITY`.
 */
export function similarDatasets(
  datasets: CatalogEntry[],
  reads: string[],
  limit = MAX_SIMILAR
): SimilarDataset[] {
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
  return found.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
}
