import { afterEach, beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';

vi.mock('../../aws/S3Service', () => ({ S3Service: vi.fn() }));
vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { CACHE_CONFIG } from '../../../constants';
import { S3Service } from '../../aws/S3Service';
import { CacheService } from '../CacheService';

const KEY = 'cache/activity-cache.json';
const VALUE_V1 = { version: 1 };
const VALUE_V2 = { version: 2 };
const PAST_WINDOW = CACHE_CONFIG.REVALIDATE_WINDOW_MS + 1;

let cacheService: CacheService;
let s3: Mocked<Pick<S3Service, 'getObjectWithETag' | 'headObject' | 'putObject'>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  s3 = { getObjectWithETag: vi.fn(), headObject: vi.fn(), putObject: vi.fn() } as any;
  vi.mocked(S3Service).mockImplementation(function () {
    return s3 as any;
  });
  (CacheService as any).instance = undefined;
  cacheService = CacheService.getInstance();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CacheService.get / getWithEtag', () => {
  it('returns null when S3 has no document', async () => {
    s3.getObjectWithETag.mockResolvedValue(null as any);
    expect(await cacheService.getWithEtag(KEY)).toEqual({ value: null });
  });

  it('returns null when the S3 read fails', async () => {
    s3.getObjectWithETag.mockRejectedValue(new Error('AccessDenied'));
    expect(await cacheService.get(KEY)).toBeNull();
  });

  it('parses a document S3 returns as a string, and gives its ETag', async () => {
    s3.getObjectWithETag.mockResolvedValue({ data: JSON.stringify(VALUE_V1), etag: '"e1"' } as any);
    expect(await cacheService.getWithEtag(KEY)).toEqual({ value: VALUE_V1, etag: '"e1"' });
  });

  it('serves the memory copy without any S3 call within the revalidation window', async () => {
    s3.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"e1"' } as any);

    expect(await cacheService.get(KEY)).toEqual(VALUE_V1);
    expect(await cacheService.getWithEtag(KEY)).toEqual({ value: VALUE_V1, etag: '"e1"' });

    expect(s3.getObjectWithETag).toHaveBeenCalledTimes(1);
    expect(s3.headObject).not.toHaveBeenCalled();
  });

  it('shares one S3 read between concurrent readers of a key', async () => {
    s3.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"e1"' } as any);
    const reads = await Promise.all([cacheService.get(KEY), cacheService.get(KEY)]);
    expect(reads).toEqual([VALUE_V1, VALUE_V1]);
    expect(s3.getObjectWithETag).toHaveBeenCalledTimes(1);
  });

  it('revalidates by HEAD after the window and serves memory when the ETag matches', async () => {
    s3.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"e1"' } as any);
    s3.headObject.mockResolvedValue({ etag: '"e1"' } as any);

    await cacheService.get(KEY);
    vi.advanceTimersByTime(PAST_WINDOW);

    expect(await cacheService.get(KEY)).toEqual(VALUE_V1);
    expect(s3.headObject).toHaveBeenCalledTimes(1);
    expect(s3.getObjectWithETag).toHaveBeenCalledTimes(1);

    // A fresh HEAD restarts the window
    expect(await cacheService.get(KEY)).toEqual(VALUE_V1);
    expect(s3.headObject).toHaveBeenCalledTimes(1);
  });

  it('re-fetches when the S3 ETag has changed (another instance wrote)', async () => {
    s3.getObjectWithETag
      .mockResolvedValueOnce({ data: VALUE_V1, etag: '"e1"' } as any)
      .mockResolvedValueOnce({ data: VALUE_V2, etag: '"e2"' } as any);
    s3.headObject.mockResolvedValue({ etag: '"e2"' } as any);

    await cacheService.get(KEY);
    vi.advanceTimersByTime(PAST_WINDOW);

    expect(await cacheService.getWithEtag(KEY)).toEqual({ value: VALUE_V2, etag: '"e2"' });
    expect(s3.getObjectWithETag).toHaveBeenCalledTimes(2);
  });

  it('drops the memory copy when the object no longer exists in S3', async () => {
    s3.getObjectWithETag.mockResolvedValueOnce({ data: VALUE_V1, etag: '"e1"' } as any);
    s3.headObject.mockRejectedValue(Object.assign(new Error('NotFound'), { name: 'NotFound' }));

    await cacheService.get(KEY);
    vi.advanceTimersByTime(PAST_WINDOW);

    expect(await cacheService.get(KEY)).toBeNull();
    s3.getObjectWithETag.mockResolvedValue(null as any);
    expect(await cacheService.get(KEY)).toBeNull();
    expect(s3.getObjectWithETag).toHaveBeenCalledTimes(2);
  });

  it('treats a 404 status on the HEAD as missing', async () => {
    s3.getObjectWithETag.mockResolvedValueOnce({ data: VALUE_V1, etag: '"e1"' } as any);
    s3.headObject.mockRejectedValue({ $metadata: { httpStatusCode: 404 } });

    await cacheService.get(KEY);
    vi.advanceTimersByTime(PAST_WINDOW);

    expect(await cacheService.get(KEY)).toBeNull();
  });

  it('serves the memory copy when the HEAD fails transiently', async () => {
    s3.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"e1"' } as any);
    s3.headObject.mockRejectedValue(new Error('Timeout'));

    await cacheService.get(KEY);
    vi.advanceTimersByTime(PAST_WINDOW);

    expect(await cacheService.get(KEY)).toEqual(VALUE_V1);
    expect(s3.getObjectWithETag).toHaveBeenCalledTimes(1);
  });
});

describe('CacheService.put', () => {
  it('writes pretty JSON by default and compact on request', async () => {
    s3.putObject.mockResolvedValue('"e1"' as any);

    await cacheService.put('a.json', VALUE_V1);
    await cacheService.put('b.json', VALUE_V1, { compact: true });

    expect(s3.putObject).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      'a.json',
      JSON.stringify(VALUE_V1, null, 2)
    );
    expect(s3.putObject).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      'b.json',
      JSON.stringify(VALUE_V1)
    );
  });

  it('seeds memory with the new ETag so the writing instance reads its own write', async () => {
    s3.putObject.mockResolvedValue('"e-new"' as any);

    await cacheService.put(KEY, VALUE_V2);

    expect(await cacheService.getWithEtag(KEY)).toEqual({ value: VALUE_V2, etag: '"e-new"' });
    expect(s3.getObjectWithETag).not.toHaveBeenCalled();
  });

  it('does not seed memory when the S3 write fails', async () => {
    s3.putObject.mockRejectedValue(new Error('SlowDown'));
    await expect(cacheService.put(KEY, VALUE_V2)).rejects.toThrow('SlowDown');

    s3.getObjectWithETag.mockResolvedValue({ data: VALUE_V1, etag: '"e1"' } as any);
    expect(await cacheService.get(KEY)).toEqual(VALUE_V1);
  });
});

describe('CacheService document helpers', () => {
  beforeEach(() => {
    s3.putObject.mockResolvedValue('"e1"' as any);
  });

  it('activity cache round-trips on its key', async () => {
    await cacheService.putActivityCache(VALUE_V1);
    expect(s3.putObject).toHaveBeenCalledWith(
      expect.any(String),
      'cache/activity-cache.json',
      expect.any(String)
    );
    expect(await cacheService.getActivityCache()).toEqual(VALUE_V1);
    expect(await cacheService.getActivityCacheWithEtag()).toEqual({
      value: VALUE_V1,
      etag: '"e1"',
    });
  });

  it('activity persistence round-trips on its own key', async () => {
    await cacheService.putActivityPersistence(VALUE_V2);
    expect(s3.putObject).toHaveBeenCalledWith(
      expect.any(String),
      'cache/activity-persistence.json',
      expect.any(String)
    );
    expect(await cacheService.getActivityPersistence()).toEqual(VALUE_V2);
    expect(await cacheService.getActivityPersistenceWithEtag()).toEqual({
      value: VALUE_V2,
      etag: '"e1"',
    });
    expect(await cacheService.getActivityCache()).toBeNull();
  });

  it('ingestions are saved with their metadata and a timestamp', async () => {
    vi.setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
    await cacheService.saveIngestions([{ id: 'i1' }], { total: 1 });

    expect(s3.putObject).toHaveBeenCalledWith(
      expect.any(String),
      'cache/ingestions.json',
      expect.any(String)
    );
    expect(await cacheService.getIngestions()).toEqual({
      ingestions: [{ id: 'i1' }],
      metadata: { total: 1 },
      lastUpdated: '2026-09-28T12:00:00.000Z',
    });
  });
});
