import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTestCatalog } from '../../../utils/testUtils/testCatalog';
import { catalog } from '../catalogStore';

const { createJob } = vi.hoisted(() => ({ createJob: vi.fn() }));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../jobs/JobFactory', () => ({ JobFactory: { getInstance: () => ({ createJob }) } }));

import { batchFreshness, keepCatalogFresh } from '../assetFreshness';

useTestCatalog();

describe('keepCatalogFresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    createJob.mockResolvedValue({ jobId: 'asset-refresh-1' });
  });

  it('records a named asset at once, then queues one refresh for it and its folder', async () => {
    await keepCatalogFresh(
      [
        { assetType: 'analysis', assetId: 'an-1', name: 'Margin', arn: 'arn:an-1' },
        { assetType: 'folder', assetId: 'f-1' },
      ],
      { accountId: '123', userId: 'u1' }
    );
    expect(await catalog.get('analysis', 'an-1')).toMatchObject({
      assetName: 'Margin',
      arn: 'arn:an-1',
      status: 'active',
    });
    expect(await catalog.get('folder', 'f-1')).toBeNull();
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'asset-refresh',
        accountId: '123',
        userId: 'u1',
        assets: [
          { assetType: 'analysis', assetId: 'an-1' },
          { assetType: 'folder', assetId: 'f-1' },
        ],
      })
    );
  });

  it('never fails the write it follows', async () => {
    vi.spyOn(catalog, 'patch').mockRejectedValue(new Error('catalog down'));
    createJob.mockRejectedValue(new Error('queue down'));
    await expect(
      keepCatalogFresh([{ assetType: 'dashboard', assetId: 'd-1', name: 'Sales' }])
    ).resolves.toBeUndefined();
    await keepCatalogFresh([]);
    expect(createJob).toHaveBeenCalledTimes(1);
  });

  it('inside a batch, gathers every write into one refresh at the end', async () => {
    const result = await batchFreshness(
      async () => {
        await keepCatalogFresh([{ assetType: 'dataset', assetId: 'a', name: 'A' }]);
        await Promise.all([
          keepCatalogFresh([{ assetType: 'dataset', assetId: 'b', name: 'B' }]),
          keepCatalogFresh([{ assetType: 'dataset', assetId: 'a', name: 'A' }]),
        ]);
        expect(createJob).not.toHaveBeenCalled();
        return 'done';
      },
      { accountId: '123' }
    );
    expect(result).toBe('done');
    expect((await catalog.list('dataset')).map((e) => e.assetId).sort()).toEqual(['a', 'b']);
    expect(createJob).toHaveBeenCalledTimes(1);
    expect(createJob.mock.calls[0]?.[0].assets).toEqual([
      { assetType: 'dataset', assetId: 'a' },
      { assetType: 'dataset', assetId: 'b' },
    ]);
  });

  it('still queues what was written when the batch throws', async () => {
    await expect(
      batchFreshness(async () => {
        await keepCatalogFresh([{ assetType: 'dataset', assetId: 'a' }]);
        throw new Error('half way');
      })
    ).rejects.toThrow('half way');
    expect(createJob).toHaveBeenCalledTimes(1);
  });
});
