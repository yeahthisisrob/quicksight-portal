/**
 * The asset catalog: one item per asset, live or archived, in the portal
 * table. Readers get a type's entries (or all of them); writers change one
 * entry at a time.
 *
 * Every change to an entry is a pure function of the entry as it stands,
 * applied only if the entry is still the revision it was read at, and
 * retried on the newer one if not. Two changes to one asset both land, and
 * changes to different assets never touch each other.
 *
 * A Lambda keeps each type's entries in memory with the type's version and
 * serves them while the version in the table is unchanged; every write
 * bumps it, so a read never serves what another Lambda has since changed.
 */
import { randomUUID } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

import pLimit from 'p-limit';

import type { AssetType, CatalogEntry, CatalogSnapshot } from '../../models/asset.model';
import type { ArchiveRecord } from '../../types/archiveTypes';
import {
  type AssetStatusFilter,
  DEFAULT_STATUS_FILTER,
  matchesStatusFilter,
} from '../../types/assetFilterTypes';
import { ASSET_TYPES } from '../../types/assetTypes';
import { SingleFlight } from '../../utils/singleFlight';
import {
  type CatalogEntryRow,
  isConditionFailed,
  portal,
  portalService,
} from '../store/portalTable';
import { type EntryState, exportFilePath } from './catalogEntry';

/** A type's entries are spread over this many partitions (write throughput; see the entity). */
const CATALOG_SHARDS = 8;
const UPDATE_ATTEMPTS = 8;
const CONFLICT_BACKOFF_MS = 25;
const PARALLEL_WRITES = 16;

const ALL_TYPES = Object.values(ASSET_TYPES) as AssetType[];

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/** Which of the type's partitions an asset lives in: a stable hash (FNV-1a) of its id. */
export function shardOf(assetId: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < assetId.length; i++) {
    hash ^= assetId.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return (hash >>> 0) % CATALOG_SHARDS;
}

const stateOf = (entry: Pick<CatalogEntry, 'status'>): EntryState =>
  entry.status === 'archived' ? 'archived' : 'live';

const iso = (value: Date | string | undefined) =>
  value === undefined ? undefined : new Date(value).toISOString();

function toRow(entry: CatalogEntry): CatalogEntryRow {
  const timestamps = entry.enrichmentTimestamps
    ? Object.fromEntries(
        Object.entries(entry.enrichmentTimestamps)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, iso(value as Date)])
      )
    : undefined;
  return {
    assetType: entry.assetType,
    shard: shardOf(entry.assetId),
    state: stateOf(entry),
    assetId: entry.assetId,
    assetName: entry.assetName || entry.assetId,
    arn: entry.arn,
    status: entry.status,
    enrichmentStatus: entry.enrichmentStatus,
    createdTime: iso(entry.createdTime),
    lastUpdatedTime: iso(entry.lastUpdatedTime),
    exportedAt: iso(entry.exportedAt),
    enrichedAt: iso(entry.enrichedAt),
    enrichmentTimestamps: timestamps,
    exportFilePath: entry.exportFilePath,
    storageType: entry.storageType,
    tags: entry.tags ?? [],
    permissions: entry.permissions ?? [],
    metadataGz: gzipSync(JSON.stringify(entry.metadata ?? {})).toString('base64'),
    rev: randomUUID(),
  } as CatalogEntryRow;
}

function fromRow(row: CatalogEntryRow): CatalogEntry {
  const date = (value: string | undefined) => (value ? new Date(value) : new Date(0));
  return {
    assetId: row.assetId,
    assetType: row.assetType as AssetType,
    assetName: row.assetName,
    arn: row.arn ?? '',
    status: row.status as CatalogEntry['status'],
    enrichmentStatus: row.enrichmentStatus as CatalogEntry['enrichmentStatus'],
    createdTime: date(row.createdTime),
    lastUpdatedTime: date(row.lastUpdatedTime),
    exportedAt: date(row.exportedAt),
    ...(row.enrichedAt ? { enrichedAt: new Date(row.enrichedAt) } : {}),
    ...(row.enrichmentTimestamps
      ? {
          enrichmentTimestamps: Object.fromEntries(
            Object.entries(row.enrichmentTimestamps as Record<string, string>).map(([k, v]) => [
              k,
              new Date(v),
            ])
          ),
        }
      : {}),
    exportFilePath: row.exportFilePath,
    storageType: row.storageType as CatalogEntry['storageType'],
    tags: (row.tags as CatalogEntry['tags']) ?? [],
    permissions: (row.permissions as CatalogEntry['permissions']) ?? [],
    metadata: row.metadataGz
      ? JSON.parse(gunzipSync(Buffer.from(row.metadataGz, 'base64')).toString('utf8'))
      : {},
  };
}

const keysOf = (assetType: AssetType, assetId: string, state: EntryState) => ({
  assetType,
  shard: shardOf(assetId),
  state,
  assetId,
});

/** A new live entry for an asset the catalog has not seen, from the fields a change gives. */
function skeleton(
  assetType: AssetType,
  assetId: string,
  fields: Partial<CatalogEntry>
): CatalogEntry {
  const now = new Date();
  return {
    assetId,
    assetType,
    assetName: fields.assetName || assetId,
    arn: '',
    status: 'active',
    enrichmentStatus: 'skeleton',
    createdTime: now,
    lastUpdatedTime: now,
    exportedAt: now,
    exportFilePath: exportFilePath(assetType, assetId, 'live'),
    storageType: 'individual',
    tags: [],
    permissions: [],
    metadata: {},
    ...fields,
  } as CatalogEntry;
}

/** A partial change as a function: fields replace, `metadata` and `enrichmentTimestamps` merge. */
function merging(updates: Partial<CatalogEntry>) {
  return (entry: CatalogEntry): CatalogEntry => ({
    ...entry,
    ...updates,
    ...(updates.metadata ? { metadata: { ...entry.metadata, ...updates.metadata } } : {}),
    ...(updates.enrichmentTimestamps
      ? { enrichmentTimestamps: { ...entry.enrichmentTimestamps, ...updates.enrichmentTimestamps } }
      : {}),
  });
}

export interface ArchiveRequest {
  assetType: AssetType;
  assetId: string;
  archiveReason?: string;
  archivedBy?: string;
}

export class CatalogStore {
  private readonly memory = new Map<AssetType, { version: number; entries: CatalogEntry[] }>();
  private readonly flights = new SingleFlight();

  // ── reads ────────────────────────────────────────────────────────────────

  /** A type's entries with this status (active by default). */
  public async list(
    assetType: AssetType,
    status: AssetStatusFilter = DEFAULT_STATUS_FILTER
  ): Promise<CatalogEntry[]> {
    const { entries } = await this.current(assetType);
    return entries.filter((entry) => matchesStatusFilter(entry.status, status));
  }

  /** Every type's entries with this status, and a version for memoizing what is derived from them. */
  public async snapshot(
    status: AssetStatusFilter = DEFAULT_STATUS_FILTER
  ): Promise<CatalogSnapshot> {
    const loaded = await Promise.all(
      ALL_TYPES.map(async (t) => [t, await this.current(t)] as const)
    );
    return {
      entries: Object.fromEntries(
        loaded.map(([t, { entries }]) => [
          t,
          entries.filter((entry) => matchesStatusFilter(entry.status, status)),
        ])
      ) as CatalogSnapshot['entries'],
      version: loaded.map(([t, { version }]) => `${t}:${version}`).join('|'),
    };
  }

  /** Every entry of every type with this status, as one list. */
  public async all(status: AssetStatusFilter = DEFAULT_STATUS_FILTER): Promise<CatalogEntry[]> {
    return Object.values((await this.snapshot(status)).entries).flat();
  }

  /** One asset: its live entry, or its archived one when it has no live entry. */
  public async get(assetType: AssetType, assetId: string): Promise<CatalogEntry | null> {
    for (const state of ['live', 'archived'] as const) {
      const { data } = await portal()
        .catalogEntry.get(keysOf(assetType, assetId, state))
        .go({ consistent: true });
      if (data) return fromRow(data);
    }
    return null;
  }

  /** How many entries each type has, with this status. */
  public async counts(
    status: AssetStatusFilter = DEFAULT_STATUS_FILTER
  ): Promise<Record<AssetType, number>> {
    const { entries } = await this.snapshot(status);
    return Object.fromEntries(
      Object.entries(entries).map(([t, list]) => [t, list.length])
    ) as Record<AssetType, number>;
  }

  /** When a type last changed, or null when the catalog has never held it. */
  public async updatedAt(assetType: AssetType): Promise<string | null> {
    const { data } = await portal().catalogVersion.get({ assetType }).go({ consistent: true });
    return data?.updatedAt ?? null;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  /** Write these entries as they are (an export's result). */
  public async put(entries: CatalogEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const { unprocessed } = await portal()
      .catalogEntry.put(entries.map(toRow))
      .go({ concurrent: PARALLEL_WRITES });
    if (unprocessed.length > 0) {
      throw new Error(`${unprocessed.length} catalog entries could not be written`);
    }
    await this.bump([...new Set(entries.map((e) => e.assetType))]);
  }

  /**
   * A type's entries become exactly these (a rebuild from the export):
   * each is written, and any entry the type had that is not among them is
   * removed.
   */
  public async replaceType(assetType: AssetType, entries: CatalogEntry[]): Promise<void> {
    const keep = new Set(entries.map((e) => `${stateOf(e)}#${e.assetId}`));
    const existing = await this.readType(assetType);
    const gone = existing.filter((e) => !keep.has(`${stateOf(e)}#${e.assetId}`));
    if (entries.length) {
      const { unprocessed } = await portal()
        .catalogEntry.put(entries.map(toRow))
        .go({ concurrent: PARALLEL_WRITES });
      if (unprocessed.length > 0) {
        throw new Error(`${unprocessed.length} ${assetType} entries could not be written`);
      }
    }
    if (gone.length) {
      await portal()
        .catalogEntry.delete(gone.map((e) => keysOf(assetType, e.assetId, stateOf(e))))
        .go({ concurrent: PARALLEL_WRITES });
    }
    await this.bump([assetType]);
  }

  /**
   * Change one entry by a pure function of it as it stands. The write
   * applies only if the entry is still the revision `change` saw; if another
   * write came first, `change` runs again on the newer entry. `change` gets
   * null for an asset with no entry, and returns null to leave it alone.
   */
  public async update(
    assetType: AssetType,
    assetId: string,
    change: (entry: CatalogEntry | null) => CatalogEntry | null,
    state: EntryState = 'live'
  ): Promise<CatalogEntry | null> {
    for (let attempt = 1; ; attempt++) {
      const { data } = await portal()
        .catalogEntry.get(keysOf(assetType, assetId, state))
        .go({ consistent: true });
      const next = change(data ? fromRow(data) : null);
      if (!next) return null;
      try {
        const write = portal().catalogEntry.put(toRow(next));
        await (data
          ? write.where(({ rev }, { eq }) => eq(rev, data.rev))
          : write.where(({ rev }, { notExists }) => notExists(rev))
        ).go();
        await this.bump([assetType]);
        return next;
      } catch (error) {
        if (!isConditionFailed(error) || attempt >= UPDATE_ATTEMPTS) throw error;
        await new Promise((r) => setTimeout(r, Math.random() * CONFLICT_BACKOFF_MS * attempt));
      }
    }
  }

  /**
   * Patch a live entry: fields replace, metadata and enrichment timestamps
   * merge. An asset the catalog has not seen gets a skeleton entry.
   */
  public async patch(
    assetType: AssetType,
    assetId: string,
    updates: Partial<CatalogEntry>
  ): Promise<CatalogEntry | null> {
    return await this.update(assetType, assetId, (entry) =>
      merging(updates)(entry ?? skeleton(assetType, assetId, {}))
    );
  }

  /** Patch many live entries of one type at once (each its own conditional write). */
  public async patchMany(
    assetType: AssetType,
    assetIds: string[],
    updates: Partial<CatalogEntry>
  ): Promise<void> {
    const limit = pLimit(PARALLEL_WRITES);
    await Promise.all(assetIds.map((id) => limit(() => this.patch(assetType, id, updates))));
  }

  /** Merge fields into an archived entry's archive record (a restore recorded against it). */
  public async patchArchived(
    assetType: AssetType,
    assetId: string,
    patch: Partial<ArchiveRecord>
  ): Promise<void> {
    await this.update(
      assetType,
      assetId,
      (entry) =>
        entry && {
          ...entry,
          metadata: {
            ...entry.metadata,
            archived: {
              archivedAt: entry.metadata?.archived?.archivedAt ?? new Date().toISOString(),
              ...entry.metadata?.archived,
              ...patch,
            },
          },
        },
      'archived'
    );
  }

  /**
   * Archive assets: each live entry becomes its archived entry in one
   * transaction (the live row goes, the archived row replaces any earlier
   * one), so a reader never sees it as both or as neither. An asset with no
   * live entry gets an archived entry all the same, so the archive shows it.
   */
  public async archive(requests: ArchiveRequest[]): Promise<void> {
    const limit = pLimit(PARALLEL_WRITES);
    await Promise.all(requests.map((request) => limit(() => this.archiveOne(request))));
  }

  /** Remove an asset's live entry. Returns whether there was one. */
  public async remove(assetType: AssetType, assetId: string): Promise<boolean> {
    try {
      await portal()
        .catalogEntry.remove(keysOf(assetType, assetId, 'live'))
        .go();
    } catch (error) {
      if (isConditionFailed(error)) return false;
      throw error;
    }
    await this.bump([assetType]);
    return true;
  }

  /** Empty the catalog, every type (a rebuild of the index starts from nothing). */
  public async clear(): Promise<void> {
    await Promise.all(ALL_TYPES.map((assetType) => this.replaceType(assetType, [])));
  }

  /** Forget this Lambda's copies (tests; the version check makes it unnecessary otherwise). */
  public forget(): void {
    this.memory.clear();
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async archiveOne({ assetType, assetId, archiveReason, archivedBy }: ArchiveRequest) {
    for (let attempt = 1; ; attempt++) {
      const [{ data: live }, { data: earlier }] = await Promise.all([
        portal()
          .catalogEntry.get(keysOf(assetType, assetId, 'live'))
          .go({ consistent: true }),
        portal()
          .catalogEntry.get(keysOf(assetType, assetId, 'archived'))
          .go({ consistent: true }),
      ]);
      const now = new Date();
      const base = live
        ? fromRow(live)
        : earlier
          ? fromRow(earlier)
          : skeleton(assetType, assetId, {});
      const archived: CatalogEntry = {
        ...base,
        status: 'archived',
        lastUpdatedTime: now,
        exportFilePath: exportFilePath(assetType, assetId, 'archived'),
        metadata: {
          ...base.metadata,
          archived: {
            archivedAt: now.toISOString(),
            archiveReason: archiveReason || 'Deleted via portal',
            archivedBy: archivedBy || 'system',
          },
        },
      };
      const { canceled } = await portalService()
        .transaction.write(({ catalogEntry }) => [
          ...(live
            ? [
                catalogEntry
                  .delete(keysOf(assetType, assetId, 'live'))
                  .where(({ rev }, { eq }) => eq(rev, live.rev))
                  .commit(),
              ]
            : []),
          catalogEntry.put(toRow(archived)).commit(),
        ])
        .go();
      if (!canceled) break;
      if (attempt >= UPDATE_ATTEMPTS) {
        throw new Error(`Could not archive ${assetType}/${assetId}: it kept changing`);
      }
      await new Promise((r) => setTimeout(r, Math.random() * CONFLICT_BACKOFF_MS * attempt));
    }
    await this.bump([assetType]);
  }

  /** Every row of a type, from its shards. */
  private async readType(assetType: AssetType): Promise<CatalogEntry[]> {
    const shards = await Promise.all(
      Array.from({ length: CATALOG_SHARDS }, (_, shard) =>
        portal().catalogEntry.query.byType({ assetType, shard }).go({ pages: 'all' })
      )
    );
    return shards.flatMap(({ data }) => data.map(fromRow));
  }

  /** A type's entries as the table has them now: this Lambda's copy while the version holds. */
  private current(assetType: AssetType): Promise<{ version: number; entries: CatalogEntry[] }> {
    return this.flights.run(assetType, async () => {
      const { data } = await portal().catalogVersion.get({ assetType }).go({ consistent: true });
      const version = data?.version ?? 0;
      const held = this.memory.get(assetType);
      if (held && held.version === version) return held;
      const loaded = { version, entries: await this.readType(assetType) };
      this.memory.set(assetType, loaded);
      return loaded;
    });
  }

  /** Tell every Lambda these types changed. */
  private async bump(assetTypes: AssetType[]): Promise<void> {
    const updatedAt = new Date().toISOString();
    await Promise.all(
      assetTypes.map((assetType) =>
        portal().catalogVersion.update({ assetType }).add({ version: 1 }).set({ updatedAt }).go()
      )
    );
  }
}

export const catalog = new CatalogStore();
