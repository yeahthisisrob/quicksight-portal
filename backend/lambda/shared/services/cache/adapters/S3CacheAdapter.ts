/**
 * S3 Cache Adapter - Handles persistent cache storage
 * Part of VSA architecture - Adapter layer for S3 operations
 */
import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../../config/exportConfig';
import { FIELD_LIMITS } from '../../../constants';
import { type CacheEntry, type AssetType } from '../../../models/asset.model';
import { ASSET_TYPES_PLURAL } from '../../../types/assetTypes';
import { logger } from '../../../utils/logger';
import { type S3Service } from '../../aws/S3Service';

export interface CacheStorageOptions {
  partition?: string;
}

/**
 * S3-based cache adapter for persistent storage
 */
export class S3CacheAdapter {
  private bucketName: string | null = null;
  private readonly CACHE_BASE_PATH = 'cache';
  private readonly COLLECTION_ASSET_TYPES = ['user', 'group', 'folder'] as const;

  private readonly FIELD_CACHE_TTL = FIELD_LIMITS.CACHE_TTL_MS;
  // In-memory cache for field cache to avoid repeated S3 reads during single Lambda execution
  private fieldCacheMemory: { data: any | null; timestamp: number } | null = null;

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Clear all caches
   */
  public async clearAllCaches(): Promise<void> {
    const bucketName = await this.getBucket();

    // List all cache objects and delete them
    const cacheObjects = await this.s3Service.listObjects(bucketName, this.CACHE_BASE_PATH);

    const limit = pLimit(EXPORT_CONFIG.s3Operations.maxConcurrentDeletes);

    const deletePromises = cacheObjects.map((obj) =>
      limit(async () => await this.s3Service.deleteObject(bucketName, obj.key))
    );

    await Promise.allSettled(deletePromises);
    logger.info(`Cleared ${deletePromises.length} cache files`);
  }

  // =============================================================================
  // PER-TYPE CACHE OPERATIONS (NEW ARCHITECTURE)
  // =============================================================================

  /**
   * Clear field cache
   */
  public async clearFieldCache(): Promise<void> {
    try {
      const bucketName = await this.getBucket();
      await this.s3Service.deleteObject(bucketName, `${this.CACHE_BASE_PATH}/field-cache.json`);
      // Field cache cleared successfully
    } catch {
      // Field cache doesn't exist or already cleared - ignore
    }
  }

  /**
   * Get a specific asset
   */
  public async getAsset(assetType: AssetType, assetId: string): Promise<any> {
    try {
      const bucketName = await this.getBucket();

      // For collection assets, read from the collection file
      if (this.COLLECTION_ASSET_TYPES.includes(assetType as any)) {
        try {
          const collection = await this.s3Service.getObject(
            bucketName,
            `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
          );
          return collection?.[assetId] || null;
        } catch {
          return null;
        }
      }

      // For individual assets, read the specific file
      const assetData = await this.s3Service.getObject(
        bucketName,
        `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`
      );
      return assetData;
    } catch {
      logger.debug(`Asset not found assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`);
      return null;
    }
  }

  /**
   * Get cache metadata (counts and timestamps)
   */
  public async getCacheMetadata(): Promise<any | null> {
    try {
      const bucketName = await this.getBucket();
      return await this.s3Service.getObject(bucketName, `${this.CACHE_BASE_PATH}/metadata.json`);
    } catch {
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStatistics(): Promise<{
    totalSize: number;
    fileCount: number;
    lastModified: Date | null;
  }> {
    const bucketName = await this.getBucket();
    const cacheObjects = await this.s3Service.listObjects(bucketName, this.CACHE_BASE_PATH);

    const totalSize = cacheObjects.reduce((sum, obj) => sum + obj.size, 0);
    const lastModified =
      cacheObjects.length > 0
        ? new Date(Math.max(...cacheObjects.map((obj) => obj.lastModified.getTime())))
        : null;

    return {
      totalSize,
      fileCount: cacheObjects.length,
      lastModified,
    };
  }

  /**
   * Get field cache with in-memory caching to avoid repeated S3 reads
   */
  public async getFieldCache(): Promise<any | null> {
    const now = Date.now();

    // Return cached data if still valid
    if (this.fieldCacheMemory && now - this.fieldCacheMemory.timestamp < this.FIELD_CACHE_TTL) {
      return this.fieldCacheMemory.data;
    }

    try {
      const bucketName = await this.getBucket();
      const data = await this.s3Service.getObject(
        bucketName,
        `${this.CACHE_BASE_PATH}/field-cache.json`
      );

      // Cache the result
      this.fieldCacheMemory = { data, timestamp: now };
      return data;
    } catch {
      // Field cache doesn't exist yet - normal during initial setup
      // Cache the null result to avoid repeated failed reads
      this.fieldCacheMemory = { data: null, timestamp: now };
      return null;
    }
  }

  /**
   * Get cache for a specific asset type
   */
  public async getTypeCache(assetType: AssetType): Promise<CacheEntry[] | null> {
    try {
      const bucketName = await this.getBucket();
      const cacheKey = `${this.CACHE_BASE_PATH}/${assetType}.json`;
      const entries = await this.s3Service.getObject<CacheEntry[]>(bucketName, cacheKey);

      if (entries && Array.isArray(entries)) {
        // Deserialize date strings back to Date objects
        return entries.map((entry: any) => ({
          ...entry,
          createdTime: new Date(entry.createdTime),
          lastUpdatedTime: new Date(entry.lastUpdatedTime),
          exportedAt: new Date(entry.exportedAt),
        }));
      }

      return null;
    } catch {
      // Cache doesn't exist yet - this is normal
      return null;
    }
  }

  /**
   * List assets for a specific type
   */
  public async listAssets(assetType: AssetType): Promise<string[]> {
    try {
      const bucketName = await this.getBucket();

      // For collection assets, read the collection file and return the keys
      if (this.COLLECTION_ASSET_TYPES.includes(assetType as any)) {
        try {
          const collection = await this.s3Service.getObject(
            bucketName,
            `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
          );
          return collection ? Object.keys(collection) : [];
        } catch {
          // Collection doesn't exist yet
          return [];
        }
      }

      // For individual assets, list the directory
      const objects = await this.s3Service.listObjects(
        bucketName,
        `assets/${ASSET_TYPES_PLURAL[assetType]}/`
      );

      return objects
        .filter((obj) => obj.key.endsWith('.json'))
        .map((obj) => {
          const filename = obj.key.split('/').pop();
          return filename ? filename.replace('.json', '') : '';
        })
        .filter((id) => id !== '');
    } catch (error) {
      logger.warn(`Failed to list assets for type ${assetType}:`, error);
      return [];
    }
  }

  /**
   * Save cache metadata
   */
  public async saveCacheMetadata(metadata: any): Promise<void> {
    const bucketName = await this.getBucket();
    await this.s3Service.putObject(bucketName, `${this.CACHE_BASE_PATH}/metadata.json`, metadata);
  }

  /**
   * Save field cache
   */
  public async saveFieldCache(fieldCache: any): Promise<void> {
    const bucketName = await this.getBucket();
    await this.s3Service.putObject(
      bucketName,
      `${this.CACHE_BASE_PATH}/field-cache.json`,
      fieldCache
    );
  }

  /**
   * Save cache for a specific asset type
   */
  public async saveTypeCache(assetType: AssetType, entries: CacheEntry[]): Promise<void> {
    const bucketName = await this.getBucket();
    const cacheKey = `${this.CACHE_BASE_PATH}/${assetType}.json`;

    await this.s3Service.putObject(bucketName, cacheKey, entries);
  }

  /**
   * Get bucket name with caching
   */
  private async getBucket(): Promise<string> {
    if (!this.bucketName) {
      this.bucketName =
        process.env.BUCKET_NAME || `quicksight-metadata-bucket-${process.env.AWS_ACCOUNT_ID}`;
      await this.s3Service.ensureBucketExists(this.bucketName);
    }
    return this.bucketName;
  }
}
