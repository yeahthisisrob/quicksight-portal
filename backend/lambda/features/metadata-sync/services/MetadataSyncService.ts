/**
 * MetadataSyncService - one pass over every table in scope: read the Glue
 * table and each of its assets, merge three ways against the table's
 * record, and either say what would change (a preview, which writes nothing
 * anywhere) or write it.
 *
 * A view that selects from exactly one table in scope is a pointer to it:
 * its asset is synced as one more asset of that table, limited to the
 * columns the view has, so text written on a pipeline table reaches the
 * view people browse. A view's own Glue text is never written; whoever
 * publishes the view recreates it from SQL.
 *
 * A place that is missing or cannot be read is left out of the merge for
 * that table and said so; it never fails the pass. A write that fails leaves
 * that place's baseline where it was, so the next pass tries again.
 */
import type { Table } from '@aws-sdk/client-glue';

import type { CatalogAsset, ProjectAsset } from '../../../adapters/aws/DataZoneAdapter';
import type { GlueAdapter } from '../../../adapters/aws/GlueAdapter';
import { errorMessage } from '../../../shared/utils/errorMessage';
import { logger } from '../../../shared/utils/logger';
import { glueShown, glueTableInput } from '../lib/glueText';
import { applyWrites, baselineAfter, emptyRecord, mergeTable } from '../lib/merge';
import { smusRevision, smusShown } from '../lib/smusText';
import { isView, referencedTables, viewSql } from '../lib/viewSql';
import {
  type FieldWrite,
  GLUE_SIDE,
  type Shown,
  type SideId,
  type SideResult,
  type SyncMode,
  type SyncReport,
  smusSide,
  TABLE_KEY,
  type TableResult,
} from '../types';
import type { SyncRecords } from './MetadataSyncStore';

/** Tables read at once: enough to finish a few hundred in minutes, few enough not to be throttled. */
const CONCURRENCY = 4;
/** Reads of a Glue table before giving up on a write a load keeps beating. */
const GLUE_ATTEMPTS = 3;

interface AssetWriter {
  getAsset(domainId: string, assetId: string): Promise<CatalogAsset | null>;
  reviseAsset(
    domainId: string,
    asset: Pick<CatalogAsset, 'assetId' | 'listingId'>,
    revision: ReturnType<typeof smusRevision>
  ): Promise<void>;
}

type TableReader = Pick<GlueAdapter, 'getTable' | 'updateTable'>;

interface PassInput {
  mode: SyncMode;
  /** Every asset in scope: the snapshot's listings and the chosen projects' own assets. */
  assets: readonly ProjectAsset[];
  snapshotAt: string;
  /** What could not be read while finding the scope, carried into the report. */
  problems?: string[];
  jobId?: string;
  startedBy?: string;
  progress?: (done: number, total: number) => Promise<void>;
}

/** An asset that is one more place a table's text goes, and the columns it may take. */
interface ScopedAsset {
  assetId: string;
  label: string;
  /** Set for a view's asset: only these columns exist there. */
  columns?: Set<string>;
}

interface TableScope {
  catalog?: string;
  database: string;
  table: string;
  assets: ScopedAsset[];
}

type GlueRead = { table: Table | null } | { error: string };

const tableKey = (database: string, table: string) => `${database}.${table}`.toLowerCase();

/** The tables the assets stand for; several assets of one table are that table's places. */
export function tablesInScope(assets: readonly ProjectAsset[]): TableScope[] {
  const byTable = new Map<string, TableScope>();
  const seen = new Set<string>();
  for (const asset of assets) {
    if (!asset.table?.database || !asset.table.name || !asset.assetId || seen.has(asset.assetId)) {
      continue;
    }
    seen.add(asset.assetId);
    const key = tableKey(asset.table.database, asset.table.name);
    const scope = byTable.get(key) ?? {
      catalog: asset.table.catalog,
      database: asset.table.database,
      table: asset.table.name,
      assets: [],
    };
    scope.catalog ??= asset.table.catalog;
    scope.assets.push({ assetId: asset.assetId, label: asset.name });
    byTable.set(key, scope);
  }
  return [...byTable.values()].sort((x, y) =>
    tableKey(x.database, x.table).localeCompare(tableKey(y.database, y.table))
  );
}

/**
 * Fold each pointer view into the table it reads: its assets become that
 * table's, limited to the view's columns, and the view is no longer a table
 * of its own. A view over no table in scope, or over several, stays as it
 * is: a join has no one table to take its words from.
 */
function foldViews(scopes: TableScope[], glue: Map<TableScope, GlueRead>): TableScope[] {
  const tables = scopes.filter((scope) => {
    const read = glue.get(scope);
    return !(read && 'table' in read && read.table && isView(read.table));
  });
  const byKey = new Map(tables.map((scope) => [tableKey(scope.database, scope.table), scope]));
  const databases = [...new Set(tables.map((scope) => scope.database))];
  const kept: TableScope[] = [...tables];
  for (const scope of scopes) {
    const read = glue.get(scope);
    const view = read && 'table' in read ? read.table : null;
    if (!view || !isView(view)) {
      continue;
    }
    const sql = viewSql(view);
    const reads = new Set<TableScope>();
    for (const database of databases) {
      for (const name of referencedTables(sql, database)) {
        const base = byKey.get(tableKey(database, name));
        if (base) reads.add(base);
      }
    }
    const [base] = [...reads];
    if (reads.size !== 1 || !base) {
      kept.push(scope);
      continue;
    }
    const columns = new Set(
      [...(view.StorageDescriptor?.Columns ?? []), ...(view.PartitionKeys ?? [])]
        .map((column) => column.Name)
        .filter((name): name is string => Boolean(name))
    );
    for (const asset of scope.assets) {
      base.assets.push({
        assetId: asset.assetId,
        label: `${asset.label} (view ${scope.database}.${scope.table})`,
        columns,
      });
    }
  }
  return kept;
}

export class MetadataSyncService {
  public constructor(
    private readonly glue: TableReader,
    private readonly dataZone: AssetWriter,
    private readonly records: SyncRecords,
    private readonly domainId: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async run(input: PassInput): Promise<SyncReport> {
    const startedAt = this.now().toISOString();
    const found = tablesInScope(input.assets);
    const glue = new Map<TableScope, GlueRead>();
    await this.pooled(found, async (scope) => {
      try {
        glue.set(scope, {
          table: await this.glue.getTable(scope.database, scope.table, scope.catalog),
        });
      } catch (error) {
        glue.set(scope, { error: errorMessage(error) });
      }
    });
    const scopes = foldViews(found, glue);
    const results: TableResult[] = [];
    let done = 0;
    await this.pooled(scopes, async (scope) => {
      results.push(await this.syncTable(scope, input.mode, glue.get(scope) ?? { table: null }));
      done += 1;
      await input.progress?.(done, scopes.length);
    });

    const tables = results
      .filter(
        (t) =>
          t.adoptions.length > 0 ||
          t.conflicts.length > 0 ||
          t.sides.some((s) => s.writes.length > 0 || s.outcome === 'failed')
      )
      .sort((a, b) => `${a.database}.${a.table}`.localeCompare(`${b.database}.${b.table}`));
    const sides = tables.flatMap((t) => t.sides);
    return {
      version: 1,
      mode: input.mode,
      ...(input.jobId ? { jobId: input.jobId } : {}),
      ...(input.startedBy ? { startedBy: input.startedBy } : {}),
      startedAt,
      finishedAt: this.now().toISOString(),
      snapshotAt: input.snapshotAt,
      ...(input.problems?.length ? { problems: input.problems } : {}),
      totals: {
        tables: scopes.length,
        adoptions: tables.reduce((n, t) => n + t.adoptions.length, 0),
        conflicts: tables.reduce((n, t) => n + t.conflicts.length, 0),
        writes: sides
          .filter((s) => s.outcome === 'written' || s.outcome === 'would-write')
          .reduce((n, s) => n + s.writes.length, 0),
        failed: sides.filter((s) => s.outcome === 'failed').length,
      },
      tables,
    };
  }

  /** Run `work` over every item, a few at a time. */
  private async pooled<T>(items: readonly T[], work: (item: T) => Promise<void>): Promise<void> {
    const queue = [...items];
    const worker = async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await work(item);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  }

  private async syncTable(scope: TableScope, mode: SyncMode, read: GlueRead): Promise<TableResult> {
    const { database, table } = scope;
    const now = this.now().toISOString();
    const sides: SideResult[] = [];
    const shown: Record<SideId, Shown> = {};
    const assets = new Map<SideId, CatalogAsset>();

    const glue: SideResult = {
      side: GLUE_SIDE,
      kind: 'glue',
      label: `${database}.${table}`,
      outcome: 'unchanged',
      writes: [],
    };
    sides.push(glue);
    if ('error' in read) {
      glue.outcome = 'failed';
      glue.error = read.error;
    } else if (!read.table) {
      glue.outcome = 'missing';
    } else if (isView(read.table)) {
      glue.outcome = 'skipped';
      glue.error = 'A view: its text belongs to whoever publishes it';
    } else {
      shown[GLUE_SIDE] = glueShown(read.table);
    }

    const limits = new Map<SideId, Set<string>>();
    for (const scoped of scope.assets) {
      const side = smusSide(scoped.assetId);
      if (scoped.columns) limits.set(side, scoped.columns);
      const result: SideResult = {
        side,
        kind: 'smus',
        label: scoped.label,
        outcome: 'unchanged',
        writes: [],
      };
      sides.push(result);
      try {
        const asset = await this.dataZone.getAsset(this.domainId, scoped.assetId);
        if (asset) {
          assets.set(side, asset);
          shown[side] = smusShown(asset, table);
        } else {
          result.outcome = 'missing';
        }
      } catch (error) {
        result.outcome = 'failed';
        result.error = errorMessage(error);
      }
    }

    const before =
      (await this.records.getRecord(database, table)) ?? emptyRecord(database, table, now);
    const merged = mergeTable(before, shown, now);
    const record = merged.record;

    for (const result of sides) {
      const limit = limits.get(result.side);
      // A view's asset takes the table's own text and only the columns the view has.
      const writes = merged.writes[result.side]?.filter(
        (write) => !limit || write.key === TABLE_KEY || limit.has(write.key)
      );
      const was = shown[result.side];
      if (!writes || !was) {
        continue;
      }
      result.writes = writes;
      if (mode === 'preview') {
        result.outcome = writes.length > 0 ? 'would-write' : 'unchanged';
        continue;
      }
      let after = was;
      if (writes.length > 0) {
        try {
          if (result.kind === 'glue') {
            await this.writeGlue(scope, writes);
          } else {
            const asset = assets.get(result.side) as CatalogAsset;
            await this.dataZone.reviseAsset(this.domainId, asset, smusRevision(asset, writes));
          }
          result.outcome = 'written';
          after = applyWrites(was, writes);
        } catch (error) {
          result.outcome = 'failed';
          result.error = errorMessage(error);
          logger.warn('Metadata sync write failed', { database, table, side: result.side, error });
          continue;
        }
      }
      record.left[result.side] = baselineAfter(
        before.left[result.side],
        after,
        merged.conflicts,
        result.side
      );
    }

    if (mode === 'run' && JSON.stringify(record) !== JSON.stringify(before)) {
      if (Object.keys(record.text).length > 0) {
        await this.records.putRecord({ ...record, updatedAt: now });
      }
    }
    return { database, table, adoptions: merged.adoptions, conflicts: merged.conflicts, sides };
  }

  /** Read, write at the version read, and read again when a load committed in between. */
  private async writeGlue(scope: TableScope, writes: readonly FieldWrite[]): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      const table = await this.glue.getTable(scope.database, scope.table, scope.catalog);
      if (!table) {
        throw new Error(`Glue table ${scope.database}.${scope.table} is gone`);
      }
      try {
        await this.glue.updateTable(
          scope.database,
          glueTableInput(table, writes),
          table.VersionId,
          scope.catalog
        );
        return;
      } catch (error) {
        if (
          (error as Error).name !== 'ConcurrentModificationException' ||
          attempt >= GLUE_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
