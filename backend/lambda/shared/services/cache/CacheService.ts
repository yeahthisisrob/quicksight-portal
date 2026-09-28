/**
 * A cache of documents derived from other data and stored in S3 - the
 * activity cache, ingestions, the field cache, the SMUS snapshot. Each has
 * one writer (the job that computes it) and many readers.
 *
 * Reads are memory-first: a copy is served as-is within a short window, and
 * after it a cheap HEAD compares its ETag with S3's - matching serves
 * memory, differing re-fetches. Every Lambda is therefore as fresh as S3
 * with no invalidation. (The catalog is not here: many writers change it,
 * so it lives in DynamoDB - see shared/services/catalog.)
 */
import { metadataBucketName } from '../../config/metadataBucket';
import { CACHE_CONFIG, STATUS_CODES } from '../../constants';
import { logger } from '../../utils/logger';
import { SingleFlight } from '../../utils/singleFlight';
import { S3Service } from '../aws/S3Service';
import { MemoryCacheAdapter } from './adapters/MemoryCacheAdapter';

const ACTIVITY_CACHE_KEY = 'cache/activity-cache.json';
const ACTIVITY_PERSISTENCE_KEY = 'cache/activity-persistence.json';
const INGESTIONS_KEY = 'cache/ingestions.json';

export class CacheService {
  private static instance: CacheService;

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private readonly bucketName = metadataBucketName(process.env.AWS_ACCOUNT_ID || '');
  private readonly s3Service = new S3Service(process.env.AWS_ACCOUNT_ID || '');
  private readonly memory = new MemoryCacheAdapter({
    maxSize: memoryCacheSize(),
    ttlMs: CACHE_CONFIG.MEMORY_TTL_MS,
    enableStats: true,
  });
  // Concurrent readers of one key share one S3 HEAD/GET
  private readonly flights = new SingleFlight();

  /** A document, or null when there is none. */
  public async get<T = any>(key: string): Promise<T | null> {
    return (await this.getWithEtag<T>(key)).value;
  }

  /** A document and the S3 ETag it was validated against (a cheap version for memoizing). */
  public getWithEtag<T = any>(key: string): Promise<{ value: T | null; etag?: string }> {
    return this.flights.run(key, async () => {
      try {
        const cached = this.memory.getValidatedEntry<T>(key);
        if (cached) {
          if (Date.now() - cached.validatedAt < CACHE_CONFIG.REVALIDATE_WINDOW_MS) {
            return { value: cached.value, etag: cached.etag };
          }
          const verdict = await this.revalidate(key, cached.etag);
          if (verdict === 'fresh') {
            this.memory.markValidated(key);
            return { value: cached.value, etag: cached.etag };
          }
          if (verdict === 'missing') {
            this.memory.delete(key);
            return { value: null };
          }
          if (verdict === 'unknown') {
            // A HEAD that failed: serve the copy rather than fail the read.
            return { value: cached.value, etag: cached.etag };
          }
        }
        const result = await this.s3Service
          .getObjectWithETag<T>(this.bucketName, key)
          .catch(() => null);
        if (!result || result.data === null || result.data === undefined) {
          return { value: null };
        }
        const data = typeof result.data === 'string' ? (JSON.parse(result.data) as T) : result.data;
        this.memory.setValidated(key, data, result.etag);
        return { value: data, etag: result.etag };
      } catch (error) {
        logger.error('Failed to get cache item', { key, error });
        return { value: null };
      }
    });
  }

  /** Write a document (pretty by default for reading by hand; compact for large ones). */
  public async put<T = any>(key: string, data: T, options?: { compact?: boolean }): Promise<void> {
    const etag = await this.s3Service.putObject(
      this.bucketName,
      key,
      options?.compact ? JSON.stringify(data) : JSON.stringify(data, null, 2)
    );
    this.memory.setValidated(key, data, etag);
  }

  public getActivityCache(): Promise<any | null> {
    return this.get(ACTIVITY_CACHE_KEY);
  }

  public getActivityCacheWithEtag(): Promise<{ value: any | null; etag?: string }> {
    return this.getWithEtag(ACTIVITY_CACHE_KEY);
  }

  public putActivityCache(data: any): Promise<void> {
    return this.put(ACTIVITY_CACHE_KEY, data);
  }

  /** Activity's historical dates. */
  public getActivityPersistence(): Promise<any | null> {
    return this.get(ACTIVITY_PERSISTENCE_KEY);
  }

  public getActivityPersistenceWithEtag(): Promise<{ value: any | null; etag?: string }> {
    return this.getWithEtag(ACTIVITY_PERSISTENCE_KEY);
  }

  public putActivityPersistence(data: any): Promise<void> {
    return this.put(ACTIVITY_PERSISTENCE_KEY, data);
  }

  public async getIngestions(): Promise<{ ingestions: any[]; metadata: any } | null> {
    return await this.get(INGESTIONS_KEY);
  }

  public async saveIngestions(ingestions: any[], metadata: any): Promise<void> {
    await this.put(INGESTIONS_KEY, { ingestions, metadata, lastUpdated: new Date().toISOString() });
  }

  /** Compare the memory copy's ETag with S3's, by HEAD. */
  private async revalidate(
    key: string,
    etag: string | undefined
  ): Promise<'fresh' | 'stale' | 'missing' | 'unknown'> {
    try {
      const head = await this.s3Service.headObject(this.bucketName, key);
      return head.etag && etag && head.etag === etag ? 'fresh' : 'stale';
    } catch (error: any) {
      if (
        error?.name === 'NotFound' ||
        error?.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND
      ) {
        return 'missing';
      }
      return 'unknown';
    }
  }
}

/** How many documents to hold, by the Lambda's memory. */
function memoryCacheSize(): number {
  const mb = parseInt(
    process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || CACHE_CONFIG.DEFAULT_LAMBDA_MEMORY_MB.toString(),
    10
  );
  if (mb >= CACHE_CONFIG.LARGE_LAMBDA_MEMORY_MB) return CACHE_CONFIG.LARGE_LAMBDA_CACHE_SIZE;
  if (mb >= CACHE_CONFIG.MEDIUM_LAMBDA_MEMORY_MB) return CACHE_CONFIG.MEDIUM_LAMBDA_CACHE_SIZE;
  return CACHE_CONFIG.SMALL_LAMBDA_CACHE_SIZE;
}

export const cacheService = CacheService.getInstance();
