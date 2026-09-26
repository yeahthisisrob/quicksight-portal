import { describe, expect, it, vi } from 'vitest';

import { ALL_ASSET_TYPES, announceAssetChanges, onAssetChanges } from '../assetChanges';

describe('asset changes', () => {
  it('tells every listener which kinds changed, once each', () => {
    const heard = vi.fn();
    const stop = onAssetChanges(heard);

    announceAssetChanges(['folder', 'dashboard', 'folder']);
    expect(heard).toHaveBeenCalledWith(['folder', 'dashboard']);

    announceAssetChanges();
    expect(heard).toHaveBeenLastCalledWith(ALL_ASSET_TYPES);

    stop();
    announceAssetChanges(['user']);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
