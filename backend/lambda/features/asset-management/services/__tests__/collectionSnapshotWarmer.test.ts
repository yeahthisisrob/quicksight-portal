import { vi } from 'vitest';

import { AssetService } from '../AssetService';
import { warmCollectionSnapshots } from '../collectionSnapshotWarmer';

vi.mock('../AssetService');
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('warmCollectionSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to AssetService.warmCollectionSnapshots', async () => {
    const warmSpy = vi.fn().mockResolvedValue(undefined);
    (AssetService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      warmCollectionSnapshots: warmSpy,
    }));

    await warmCollectionSnapshots();

    expect(warmSpy).toHaveBeenCalledTimes(1);
  });

  it('never propagates errors — warming must not fail jobs', async () => {
    (AssetService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      warmCollectionSnapshots: vi.fn().mockRejectedValue(new Error('enrichment exploded')),
    }));

    await expect(warmCollectionSnapshots()).resolves.toBeUndefined();
  });

  it('never propagates constructor failures', async () => {
    (AssetService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('constructor exploded');
    });

    await expect(warmCollectionSnapshots()).resolves.toBeUndefined();
  });
});
