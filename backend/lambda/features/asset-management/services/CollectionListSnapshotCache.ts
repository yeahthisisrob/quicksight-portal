import { cacheService } from '../../../shared/services/cache/CacheService';
import { logger } from '../../../shared/utils/logger';
import { SingleFlight } from '../../../shared/utils/singleFlight';

export type CollectionSnapshotType = 'user' | 'group';

/**
 * Fully enriched collection list (pre-filter, pre-sort) plus any filter
 * options computed from it, tied to the cache version it was derived from.
 *
 * IMPORTANT: the items array and its objects are shared across requests —
 * treat them as frozen. Downstream list processing (filter/search/sort/
 * paginate) is non-mutating; anything new that touches these items must
 * copy first.
 */
export interface CollectionListSnapshot {
  version: string;
  items: any[];
  availableRoles?: any[];
  availableGroups?: any[];
}

/**
 * Storage port for persisted snapshots — defaults to the cacheService
 * singleton (S3 with ETag revalidation + per-key single-flight).
 */
interface SnapshotStorage {
  getWithEtag<T>(key: string): Promise<{ value: T | null; etag?: string }>;
  put<T>(key: string, data: T, options?: { compact?: boolean }): Promise<void>;
}

const SNAPSHOT_S3_KEYS: Record<CollectionSnapshotType, string> = {
  user: 'cache/derived/user-list-snapshot.json',
  group: 'cache/derived/group-list-snapshot.json',
};

/**
 * Snapshots are shared across every request a warm Lambda serves - an
 * accidental in-place sort or field write would corrupt all of them. Freeze
 * outside production so such a bug fails loudly in dev/test instead of
 * shipping; production skips the freeze cost on multi-thousand-item lists.
 */
function freezeSnapshot(snapshot: CollectionListSnapshot): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  Object.freeze(snapshot.items);
  for (const item of snapshot.items) {
    Object.freeze(item);
  }
  Object.freeze(snapshot);
}

/**
 * Memoizes enriched collection lists (users, groups) across requests.
 *
 * Two layers, checked in order:
 * 1. In-memory (per Lambda instance) — exact version match.
 * 2. S3 (`cache/derived/...`) — survives cold starts AND lets the worker
 *    Lambda precompute snapshots at cache-rebuild time that the API Lambda
 *    then adopts without recomputing (see collectionSnapshotWarmer).
 *
 * The version key derives from the S3 ETags of every cache the enrichment
 * reads, so a snapshot is reused iff none of the underlying data changed —
 * the same freshness bound the raw caches already have. Persist failures are
 * non-fatal: the computed snapshot is still served from memory.
 */
export class CollectionListSnapshotCache {
  private readonly singleFlight = new SingleFlight();
  private readonly snapshots = new Map<CollectionSnapshotType, CollectionListSnapshot>();

  constructor(private readonly storage?: SnapshotStorage) {}

  public getOrCompute(
    assetType: CollectionSnapshotType,
    version: string,
    compute: () => Promise<Omit<CollectionListSnapshot, 'version'>>
  ): Promise<CollectionListSnapshot> {
    const existing = this.snapshots.get(assetType);
    if (existing && existing.version === version) {
      return Promise.resolve(existing);
    }

    // Coalesce concurrent recomputes for the same (type, version)
    return this.singleFlight.run(`snapshot:${assetType}:${version}`, async () => {
      // A concurrent flight may have already stored this version
      const current = this.snapshots.get(assetType);
      if (current && current.version === version) {
        return current;
      }

      // Adopt a persisted snapshot (e.g. precomputed by the worker) if fresh
      const persisted = await this.readPersisted(assetType, version);
      if (persisted) {
        freezeSnapshot(persisted);
        this.snapshots.set(assetType, persisted);
        return persisted;
      }

      const started = Date.now();
      const computed = await compute();
      const snapshot: CollectionListSnapshot = { version, ...computed };
      freezeSnapshot(snapshot);
      this.snapshots.set(assetType, snapshot);
      logger.info('Recomputed collection list snapshot', {
        assetType,
        items: snapshot.items.length,
        durationMs: Date.now() - started,
      });
      // Fire-and-forget: persisting benefits the NEXT request/instance; the
      // user-facing request should not pay for a multi-MB S3 PUT. (If Lambda
      // freezes before the PUT completes, the worker's warmer still persists
      // snapshots at cache-rebuild time.)
      void this.persist(assetType, snapshot);
      return snapshot;
    });
  }

  private getStorage(): SnapshotStorage {
    // Lazy so tests can construct with a fake without touching the singleton
    return this.storage ?? cacheService;
  }

  private async persist(
    assetType: CollectionSnapshotType,
    snapshot: CollectionListSnapshot
  ): Promise<void> {
    try {
      // Compact JSON: derived multi-MB blob, never hand-inspected
      await this.getStorage().put(SNAPSHOT_S3_KEYS[assetType], snapshot, { compact: true });
    } catch (error) {
      // Non-fatal: the in-memory snapshot still serves this instance
      logger.warn('Failed to persist collection snapshot', { assetType, error });
    }
  }

  private async readPersisted(
    assetType: CollectionSnapshotType,
    version: string
  ): Promise<CollectionListSnapshot | null> {
    try {
      const { value } = await this.getStorage().getWithEtag<CollectionListSnapshot>(
        SNAPSHOT_S3_KEYS[assetType]
      );
      if (value && value.version === version && Array.isArray(value.items)) {
        logger.info('Adopted persisted collection list snapshot', {
          assetType,
          items: value.items.length,
        });
        return value;
      }
    } catch (error) {
      logger.warn('Failed to read persisted collection snapshot', { assetType, error });
    }
    return null;
  }
}

export const collectionListSnapshotCache = new CollectionListSnapshotCache();
