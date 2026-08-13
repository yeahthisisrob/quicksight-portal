import { vi } from 'vitest';

import { UserListEnrichmentCache } from '../UserListEnrichmentCache';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SNAPSHOT_BODY = {
  items: [{ id: 'u1' }],
  availableRoles: [{ value: 'ADMIN', count: 1 }],
  availableGroups: [],
};

describe('UserListEnrichmentCache', () => {
  it('computes once and reuses the snapshot for the same version', async () => {
    const cache = new UserListEnrichmentCache();
    const compute = vi.fn().mockResolvedValue(SNAPSHOT_BODY);

    const first = await cache.getOrCompute('v1', compute);
    const second = await cache.getOrCompute('v1', compute);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(second.items).toEqual([{ id: 'u1' }]);
    expect(second.version).toBe('v1');
  });

  it('recomputes when the version changes', async () => {
    const cache = new UserListEnrichmentCache();
    const compute = vi.fn().mockResolvedValue(SNAPSHOT_BODY);

    await cache.getOrCompute('v1', compute);
    const updated = await cache.getOrCompute('v2', compute);

    expect(compute).toHaveBeenCalledTimes(2);
    expect(updated.version).toBe('v2');
  });

  it('coalesces concurrent recomputes of the same version', async () => {
    const cache = new UserListEnrichmentCache();
    let executions = 0;
    let release: () => void = () => {};
    const compute = () => {
      executions++;
      return new Promise<typeof SNAPSHOT_BODY>((resolve) => {
        release = () => resolve(SNAPSHOT_BODY);
      });
    };

    const first = cache.getOrCompute('v1', compute);
    const second = cache.getOrCompute('v1', compute);
    release();

    const [a, b] = await Promise.all([first, second]);
    expect(executions).toBe(1);
    expect(b).toBe(a);
  });

  it('does not store a snapshot when compute fails, and retries next call', async () => {
    const cache = new UserListEnrichmentCache();
    const failing = vi.fn().mockRejectedValue(new Error('enrichment failed'));

    await expect(cache.getOrCompute('v1', failing)).rejects.toThrow('enrichment failed');

    const working = vi.fn().mockResolvedValue(SNAPSHOT_BODY);
    const result = await cache.getOrCompute('v1', working);
    expect(result.version).toBe('v1');
    expect(working).toHaveBeenCalledTimes(1);
  });
});
