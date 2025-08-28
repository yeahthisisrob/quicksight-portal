import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import { MATH_CONSTANTS } from '../../../shared/constants';
import { logger } from '../../../shared/utils/logger';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

/**
 * Generic in-memory cache with TTL support
 */
export class ExportCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private hits = 0;
  private readonly maxSize: number;
  private misses = 0;
  private readonly ttl: number;

  constructor(
    private readonly name: string,
    ttl?: number,
    maxSize?: number
  ) {
    this.ttl = ttl || EXPORT_CONFIG.cache.metadataTTL;
    this.maxSize = maxSize || EXPORT_CONFIG.cache.maxSize;
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Delete a key from cache
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Get a value from cache
   */
  public get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Update hit count
    entry.hits++;
    this.hits++;
    return entry.value;
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    name: string;
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    maxSize: number;
    ttl: number;
  } {
    const total = this.hits + this.misses;
    return {
      name: this.name,
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * MATH_CONSTANTS.PERCENTAGE_MULTIPLIER : 0,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  /**
   * Check if key exists and is not expired
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Log cache statistics
   */
  public logStats(): void {
    const stats = this.getStats();
    logger.info(`Cache stats for ${this.name}:`, {
      ...stats,
      hitRate: `${stats.hitRate.toFixed(2)}%`,
    });
  }

  /**
   * Set a value in cache
   */
  public set(key: string, value: T): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Evict the oldest entry (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Singleton cache manager for the export system
 */
class ExportCacheManager {
  private static instance: ExportCacheManager;

  public static getInstance(): ExportCacheManager {
    if (!ExportCacheManager.instance) {
      ExportCacheManager.instance = new ExportCacheManager();
    }
    return ExportCacheManager.instance;
  }
  private readonly describedAssetsCache: ExportCache<any>;
  private readonly metadataCache: ExportCache<any>;
  private readonly permissionsCache: ExportCache<any>;

  private readonly tagsCache: ExportCache<any>;

  private constructor() {
    const config = EXPORT_CONFIG.cache;

    this.metadataCache = new ExportCache('metadata', config.metadataTTL);
    this.permissionsCache = new ExportCache('permissions', config.permissionsTTL);
    this.tagsCache = new ExportCache('tags', config.tagsTTL);
    this.describedAssetsCache = new ExportCache('describedAssets', config.metadataTTL);
  }

  /**
   * Clear all caches
   */
  public clearAll(): void {
    this.metadataCache.clear();
    this.permissionsCache.clear();
    this.tagsCache.clear();
    this.describedAssetsCache.clear();
  }

  public getDescribedAssetsCache(): ExportCache<any> {
    return this.describedAssetsCache;
  }

  public getMetadataCache(): ExportCache<any> {
    return this.metadataCache;
  }

  public getPermissionsCache(): ExportCache<any> {
    return this.permissionsCache;
  }

  public getTagsCache(): ExportCache<any> {
    return this.tagsCache;
  }

  /**
   * Log statistics for all caches
   */
  public logAllStats(): void {
    logger.info('Export cache statistics:');
    this.metadataCache.logStats();
    this.permissionsCache.logStats();
    this.tagsCache.logStats();
    this.describedAssetsCache.logStats();
  }
}

export const exportCacheManager = ExportCacheManager.getInstance();
