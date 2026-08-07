/**
 * MemoryCacheAdapter - In-memory caching for Lambda keep-warm
 * Part of VSA architecture - Adapter layer
 *
 * Two kinds of entries coexist:
 * - Plain entries (set/get): TTL-bounded convenience cache. Used for
 *   memory-authoritative data like the job index, where memory is the write
 *   buffer and MUST NOT be revalidated against S3.
 * - Validated entries (setValidated/getValidatedEntry): carry the S3 ETag of
 *   the object they were loaded from plus the time of the last successful
 *   revalidation. Freshness is enforced by the caller comparing ETags against
 *   S3 (see CacheService) — not by TTL guessing.
 */

export interface MemoryCacheOptions {
  maxSize: number;
  ttlMs: number;
  enableStats: boolean;
}

export interface MemoryCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

export interface ValidatedCacheEntry<T = any> {
  value: T;
  /** S3 ETag at load time. Undefined = unknown → next read must re-fetch. */
  etag?: string;
  /** Epoch ms of the last successful ETag validation against S3. */
  validatedAt: number;
}

interface InternalEntry {
  value: any;
  timestamp: number;
  etag?: string;
  validatedAt?: number;
}

/**
 * In-memory cache adapter for Lambda performance
 */
export class MemoryCacheAdapter {
  private readonly cache = new Map<string, InternalEntry>();
  private readonly stats: MemoryCacheStats;

  constructor(private readonly options: MemoryCacheOptions) {
    this.stats = { hits: 0, misses: 0, hitRate: 0 };
  }

  public clear(): void {
    this.cache.clear();
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public destroy(): void {
    this.cache.clear();
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.options.ttlMs) {
      this.cache.delete(key);
      this.recordMiss();
      return null;
    }

    this.touchLru(key, entry);
    this.recordHit();
    return entry.value;
  }

  public getStats(): MemoryCacheStats {
    return { ...this.stats };
  }

  /**
   * Get a validated (ETag-carrying) entry. No TTL check — freshness is the
   * caller's job via ETag comparison. Returns null if the key is absent or
   * was stored via plain set() (no validatedAt).
   */
  public getValidatedEntry<T>(key: string): ValidatedCacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry || entry.validatedAt === undefined) {
      this.recordMiss();
      return null;
    }
    this.touchLru(key, entry);
    this.recordHit();
    return { value: entry.value, etag: entry.etag, validatedAt: entry.validatedAt };
  }

  /** Record that the entry's ETag was just re-confirmed against S3. */
  public markValidated(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.validatedAt = Date.now();
    }
  }

  public set<T>(key: string, value: T): void {
    this.evictIfFull(key);
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /** Store a value together with the S3 ETag it was loaded/written with. */
  public setValidated<T>(key: string, value: T, etag: string | undefined): void {
    this.evictIfFull(key);
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      etag,
      validatedAt: Date.now(),
    });
  }

  private evictIfFull(key: string): void {
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }
  }

  private evictLeastRecentlyUsed(): void {
    // Map preserves insertion order; touchLru() re-inserts on read, so the
    // first key really is the least recently used.
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private recordHit(): void {
    this.stats.hits++;
    this.updateHitRate();
  }

  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  /** Move the entry to the end of the Map so eviction order is true LRU. */
  private touchLru(key: string, entry: InternalEntry): void {
    this.cache.delete(key);
    this.cache.set(key, entry);
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}
