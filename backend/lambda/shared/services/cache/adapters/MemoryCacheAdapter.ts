/**
 * MemoryCacheAdapter - In-memory caching for Lambda keep-warm
 * Part of VSA architecture - Adapter layer
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

/**
 * In-memory cache adapter for Lambda performance
 */
export class MemoryCacheAdapter {
  private readonly cache = new Map<string, { value: any; timestamp: number }>();
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
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.options.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();
    return entry.value;
  }

  public getStats(): MemoryCacheStats {
    return { ...this.stats };
  }

  public set<T>(key: string, value: T): void {
    // Evict if cache is full
    if (this.cache.size >= this.options.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  private evictLeastRecentlyUsed(): void {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}
