import { logger } from '../../../shared/utils/logger';
import { SingleFlight } from '../../../shared/utils/singleFlight';

/**
 * Fully enriched user list (pre-filter, pre-sort) plus the filter options
 * computed from it, tied to the cache version it was derived from.
 *
 * IMPORTANT: the items array and its objects are shared across requests —
 * treat them as frozen. Downstream list processing (filter/search/sort/
 * paginate) is non-mutating; anything new that touches these items must
 * copy first.
 */
export interface EnrichedUserListSnapshot {
  version: string;
  items: any[];
  availableRoles: any[];
  availableGroups: any[];
}

/**
 * Memoizes the enriched user list across requests in a warm Lambda.
 *
 * The version key is derived from the S3 ETags of every cache the enrichment
 * reads (type caches + activity cache + activity persistence), so a snapshot
 * is reused iff none of the underlying data changed — the same freshness
 * bound the raw caches already have. Page changes, sorts, and searches then
 * cost an in-memory filter/slice instead of a full re-enrichment.
 */
export class UserListEnrichmentCache {
  private readonly singleFlight = new SingleFlight();
  private snapshot: EnrichedUserListSnapshot | null = null;

  public getOrCompute(
    version: string,
    compute: () => Promise<Omit<EnrichedUserListSnapshot, 'version'>>
  ): Promise<EnrichedUserListSnapshot> {
    const existing = this.snapshot;
    if (existing && existing.version === version) {
      return Promise.resolve(existing);
    }

    // Coalesce concurrent recomputes for the same version
    return this.singleFlight.run(`enrich:${version}`, async () => {
      // A concurrent flight may have already stored this version
      const current = this.snapshot;
      if (current && current.version === version) {
        return current;
      }

      const started = Date.now();
      const computed = await compute();
      const snapshot: EnrichedUserListSnapshot = { version, ...computed };
      this.snapshot = snapshot;
      logger.info('Recomputed user list enrichment snapshot', {
        users: snapshot.items.length,
        durationMs: Date.now() - started,
      });
      return snapshot;
    });
  }
}

export const userListEnrichmentCache = new UserListEnrichmentCache();
