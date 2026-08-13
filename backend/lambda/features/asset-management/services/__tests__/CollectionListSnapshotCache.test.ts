import { vi } from 'vitest';

import { CollectionListSnapshotCache } from '../CollectionListSnapshotCache';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const USER_BODY = {
  items: [{ id: 'u1' }],
  availableRoles: [{ value: 'ADMIN', count: 1 }],
  availableGroups: [],
};
const GROUP_BODY = { items: [{ id: 'g1', assetsCount: 3 }] };

function fakeStorage(persisted: Record<string, any> = {}) {
  return {
    getWithEtag: vi.fn(async (key: string) => ({ value: persisted[key] ?? null })),
    put: vi.fn(async () => undefined),
  };
}

describe('CollectionListSnapshotCache', () => {
  it('computes once and reuses the snapshot for the same (type, version)', async () => {
    const storage = fakeStorage();
    const cache = new CollectionListSnapshotCache(storage);
    const compute = vi.fn().mockResolvedValue(USER_BODY);

    const first = await cache.getOrCompute('user', 'v1', compute);
    const second = await cache.getOrCompute('user', 'v1', compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(second.version).toBe('v1');
  });

  it('keeps user and group snapshots independent', async () => {
    const cache = new CollectionListSnapshotCache(fakeStorage());
    const userCompute = vi.fn().mockResolvedValue(USER_BODY);
    const groupCompute = vi.fn().mockResolvedValue(GROUP_BODY);

    await cache.getOrCompute('user', 'v1', userCompute);
    await cache.getOrCompute('group', 'v1', groupCompute);
    // Bumping the user version must not evict the group snapshot
    await cache.getOrCompute('user', 'v2', userCompute);
    await cache.getOrCompute('group', 'v1', groupCompute);

    expect(userCompute).toHaveBeenCalledTimes(2);
    expect(groupCompute).toHaveBeenCalledTimes(1);
  });

  it('recomputes when the version changes', async () => {
    const cache = new CollectionListSnapshotCache(fakeStorage());
    const compute = vi.fn().mockResolvedValue(GROUP_BODY);

    await cache.getOrCompute('group', 'v1', compute);
    const updated = await cache.getOrCompute('group', 'v2', compute);

    expect(compute).toHaveBeenCalledTimes(2);
    expect(updated.version).toBe('v2');
  });

  it('adopts a persisted snapshot with a matching version without computing', async () => {
    const persisted = {
      'cache/derived/user-list-snapshot.json': { version: 'v1', items: [{ id: 'warm' }] },
    };
    const storage = fakeStorage(persisted);
    const cache = new CollectionListSnapshotCache(storage);
    const compute = vi.fn().mockResolvedValue(USER_BODY);

    const result = await cache.getOrCompute('user', 'v1', compute);

    expect(compute).not.toHaveBeenCalled();
    expect(result.items).toEqual([{ id: 'warm' }]);
    expect(storage.getWithEtag).toHaveBeenCalledWith('cache/derived/user-list-snapshot.json');

    // Subsequent call is a memory hit — no more S3 reads
    await cache.getOrCompute('user', 'v1', compute);
    expect(storage.getWithEtag).toHaveBeenCalledTimes(1);
  });

  it('ignores a persisted snapshot with a stale version and persists the fresh one', async () => {
    const persisted = {
      'cache/derived/group-list-snapshot.json': { version: 'old', items: [{ id: 'stale' }] },
    };
    const storage = fakeStorage(persisted);
    const cache = new CollectionListSnapshotCache(storage);
    const compute = vi.fn().mockResolvedValue(GROUP_BODY);

    const result = await cache.getOrCompute('group', 'v2', compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual(GROUP_BODY.items);
    expect(storage.put).toHaveBeenCalledWith('cache/derived/group-list-snapshot.json', {
      version: 'v2',
      items: GROUP_BODY.items,
    });
  });

  it('still returns the computed snapshot when persisting fails', async () => {
    const storage = fakeStorage();
    storage.put.mockRejectedValue(new Error('s3 down'));
    const cache = new CollectionListSnapshotCache(storage);

    const result = await cache.getOrCompute('user', 'v1', async () => USER_BODY);

    expect(result.version).toBe('v1');
    expect(result.items).toEqual(USER_BODY.items);
  });

  it('computes when the S3 read fails', async () => {
    const storage = fakeStorage();
    storage.getWithEtag.mockRejectedValue(new Error('s3 read failed'));
    const cache = new CollectionListSnapshotCache(storage);
    const compute = vi.fn().mockResolvedValue(USER_BODY);

    const result = await cache.getOrCompute('user', 'v1', compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(result.version).toBe('v1');
  });

  it('coalesces concurrent recomputes of the same (type, version)', async () => {
    const cache = new CollectionListSnapshotCache(fakeStorage());
    let executions = 0;
    let release: () => void = () => {};
    const compute = () => {
      executions++;
      return new Promise<typeof GROUP_BODY>((resolve) => {
        release = () => resolve(GROUP_BODY);
      });
    };

    const first = cache.getOrCompute('group', 'v1', compute);
    const second = cache.getOrCompute('group', 'v1', compute);
    // compute starts only after the async persisted-snapshot read resolves
    await vi.waitFor(() => {
      expect(executions).toBe(1);
    });
    release();

    const [a, b] = await Promise.all([first, second]);
    expect(executions).toBe(1);
    expect(b).toBe(a);
  });

  it('does not store a snapshot when compute fails, and retries next call', async () => {
    const cache = new CollectionListSnapshotCache(fakeStorage());
    const failing = vi.fn().mockRejectedValue(new Error('enrichment failed'));

    await expect(cache.getOrCompute('user', 'v1', failing)).rejects.toThrow('enrichment failed');

    const working = vi.fn().mockResolvedValue(USER_BODY);
    const result = await cache.getOrCompute('user', 'v1', working);
    expect(result.version).toBe('v1');
    expect(working).toHaveBeenCalledTimes(1);
  });
});
