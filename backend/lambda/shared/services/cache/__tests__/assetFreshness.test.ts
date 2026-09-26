import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateAsset, createJob } = vi.hoisted(() => ({ updateAsset: vi.fn(), createJob: vi.fn() }));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../CacheService', () => ({ cacheService: { updateAsset } }));
vi.mock('../../jobs/JobFactory', () => ({ JobFactory: { getInstance: () => ({ createJob }) } }));

import { keepCacheFresh } from '../assetFreshness';

describe('keepCacheFresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateAsset.mockResolvedValue(undefined);
    createJob.mockResolvedValue({ jobId: 'asset-refresh-1' });
  });

  it('records a named asset at once, then queues one refresh for it and its folder', async () => {
    await keepCacheFresh(
      [
        { assetType: 'analysis', assetId: 'an-1', name: 'Margin', arn: 'arn:an-1' },
        { assetType: 'folder', assetId: 'f-1' },
      ],
      { accountId: '123', userId: 'u1' }
    );
    expect(updateAsset).toHaveBeenCalledTimes(1);
    expect(updateAsset).toHaveBeenCalledWith(
      'analysis',
      'an-1',
      expect.objectContaining({ assetName: 'Margin', arn: 'arn:an-1', status: 'active' })
    );
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
    updateAsset.mockRejectedValue(new Error('cache down'));
    createJob.mockRejectedValue(new Error('queue down'));
    await expect(
      keepCacheFresh([{ assetType: 'dashboard', assetId: 'd-1', name: 'Sales' }])
    ).resolves.toBeUndefined();
    await keepCacheFresh([]);
    expect(createJob).toHaveBeenCalledTimes(1);
  });
});
