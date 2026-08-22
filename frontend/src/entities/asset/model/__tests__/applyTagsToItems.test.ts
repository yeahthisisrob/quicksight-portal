import { describe, it, expect, vi } from 'vitest';

// AssetsContext transitively imports the runtime-injected APP_CONFIG; stub
// the api module so this pure-function test needs no window config
vi.mock('@/shared/api', () => ({ assetsApi: {} }));

import { applyTagsToItems } from '../AssetsContext';

const TAGS = [{ key: 'env', value: 'prod' }];

// Minimal AssetListItem-shaped fixture (AssetData is grounded in the schema)
const item = (id: string, name: string) => ({
  id,
  name,
  type: 'dashboard' as const,
  status: 'active' as const,
  createdTime: '',
  lastUpdatedTime: '',
  lastExportTime: '',
  enrichmentStatus: 'enriched' as const,
  permissions: [],
  tags: [],
});

describe('applyTagsToItems', () => {
  it('replaces tags on the matching item only, immutably', () => {
    const items = [item('a', 'A'), item('b', 'B')];

    const result = applyTagsToItems(items, 'a', TAGS);

    expect(result).not.toBe(items);
    expect(result?.[0]?.tags).toEqual(TAGS);
    expect(result?.[0]).not.toBe(items[0]);
    // Non-matching item is untouched (same reference)
    expect(result?.[1]).toBe(items[1]);
    // Source array unchanged
    expect(items[0]?.tags).toEqual([]);
  });

  it('returns the input unchanged when no item matches', () => {
    const items = [item('a', 'A')];
    const result = applyTagsToItems(items, 'missing', TAGS);
    expect(result).toEqual(items);
  });

  it('passes through undefined input', () => {
    expect(applyTagsToItems(undefined, 'a', TAGS)).toBeUndefined();
  });
});
