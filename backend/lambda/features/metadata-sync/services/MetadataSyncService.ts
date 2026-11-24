/**
 * MetadataSyncService - one pass over every table the SMUS snapshot knows:
 * read the Glue table and each of its assets, merge three ways against the
 * table's record, and either say what would change (a preview, which writes
 * nothing anywhere) or write it.
 *
 * A place that is missing or cannot be read is left out of the merge for
 * that table and said so; it never fails the pass. A write that fails leaves
 * that place's baseline where it was, so the next pass tries again.
 */
import type { CatalogAsset, CatalogListing } from '../../../adapters/aws/DataZoneAdapter';
import type { GlueAdapter } from '../../../adapters/aws/GlueAdapter';
import { errorMessage } from '../../../shared/utils/errorMessage';
import { logger } from '../../../shared/utils/logger';
import { glueShown, glueTableInput, isGlueView } from '../lib/glueText';
import { applyWrites, baselineAfter, emptyRecord, mergeTable } from '../lib/merge';
import { smusRevision, smusShown } from '../lib/smusText';
import {
  type FieldWrite,
  GLUE_SIDE,
  type Shown,
  type SideId,
  type SideResult,
  type SyncMode,
  type SyncReport,
  smusSide,
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
  listings: readonly CatalogListing[];
  snapshotAt: string;
  jobId?: string;
  startedBy?: string;
  progress?: (done: number, total: number) => Promise<void>;
}

interface TableScope {
  catalog?: string;
  database: string;
  table: string;
  listings: CatalogListing[];
}

/** The tables the listings stand for; several listings of one table are that table's assets. */
export function tablesInScope(listings: readonly CatalogListing[]): TableScope[] {
  const byTable = new Map<string, TableScope>();
  for (const listing of listings) {
    if (!listing.table?.database || !listing.table.name || !listing.assetId) {
      continue;
    }
    const key = `${listing.table.catalog ?? ''}/${listing.table.database}.${listing.table.name}`;
    const scope = byTable.get(key) ?? {
      catalog: listing.table.catalog,
      database: listing.table.database,
      table: listing.table.name,
      listings: [],
    };
    scope.listings.push(listing);
    byTable.set(key, scope);
  }
  return [...byTable.values()].sort((a, b) =>
    `${a.database}.${a.table}`.localeCompare(`${b.database}.${b.table}`)
  );
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
    const scopes = tablesInScope(input.listings);
    const results: TableResult[] = [];
    let done = 0;
    const queue = [...scopes];
    const worker = async () => {
      for (let scope = queue.shift(); scope; scope = queue.shift()) {
        results.push(await this.syncTable(scope, input.mode));
        done += 1;
        await input.progress?.(done, scopes.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, scopes.length) }, worker));

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

  private async syncTable(scope: TableScope, mode: SyncMode): Promise<TableResult> {
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
    try {
      const found = await this.glue.getTable(database, table, scope.catalog);
      if (!found) {
        glue.outcome = 'missing';
      } else if (isGlueView(found)) {
        glue.outcome = 'skipped';
        glue.error = 'A view: its text belongs to whoever publishes it';
      } else {
        shown[GLUE_SIDE] = glueShown(found);
      }
    } catch (error) {
      glue.outcome = 'failed';
      glue.error = errorMessage(error);
    }

    for (const listing of scope.listings) {
      const side = smusSide(listing.assetId);
      const result: SideResult = {
        side,
        kind: 'smus',
        label: listing.name,
        outcome: 'unchanged',
        writes: [],
      };
      sides.push(result);
      try {
        const asset = await this.dataZone.getAsset(this.domainId, listing.assetId);
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
      const writes = merged.writes[result.side];
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
