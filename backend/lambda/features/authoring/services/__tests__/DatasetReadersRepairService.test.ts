import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatasetReadersRepairService } from '../DatasetReadersRepairService';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const quickSight = { describeDataset: vi.fn() };
vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => quickSight },
}));

const clean = {
  issues: [],
  summary: { fixable: 0, needsChoice: 0, unfixable: 0 },
  proposed: { repairs: [], rebinds: [] },
};
const fixable = {
  issues: [
    {
      id: 'column-missing:orders:promo_code',
      kind: 'column-missing',
      severity: 'error',
      message: 'promo_code is gone',
      alternatives: [],
      fix: { op: 'dropColumn', identifier: 'orders', columnName: 'promo_code' },
    },
  ],
  summary: { fixable: 1, needsChoice: 0, unfixable: 0 },
  proposed: {
    repairs: [{ op: 'dropColumn', identifier: 'orders', columnName: 'promo_code' }],
    rebinds: [],
  },
};
const needsChoice = {
  ...fixable,
  summary: { fixable: 1, needsChoice: 1, unfixable: 0 },
};

const rebind = {
  describeDatasets: vi.fn(async (_type: string, id: string) => ({
    name: `Reader ${id}`,
    datasets: [{ dataSetId: 'ds-1', identifier: 'orders', columns: [{ name: 'amt' }] }],
  })),
  repairPlan: vi.fn(async (_type: string, id: string) =>
    id === 'dash-1' ? fixable : id === 'an-2' ? needsChoice : clean
  ),
  apply: vi.fn(async (..._args: unknown[]) => ({ changes: [{ kind: 'dropColumn' }] })),
};
const lineage = {
  getLineageMapForAssets: vi.fn(
    async () =>
      new Map([
        [
          'dataset:ds-1',
          {
            relationships: ['dash-1', 'an-1', 'an-2'].map((id) => ({
              relationshipType: 'used_by',
              targetAssetType: id.startsWith('dash') ? 'dashboard' : 'analysis',
              targetAssetId: id,
              targetAssetName: `Reader ${id}`,
            })),
          },
        ],
      ])
  ),
};
const auth = { userId: 'u', accountId: '1', email: 'rob@example.com' };
const service = () => new DatasetReadersRepairService('1', rebind as any, lineage as any);

describe('DatasetReadersRepairService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quickSight.describeDataset.mockResolvedValue({ Name: 'orders_fact' });
  });

  it('previews each reader with its repair plan and counts the ones with fixes', async () => {
    const preview = await service().preview('ds-1');
    expect(preview.name).toBe('orders_fact');
    expect(preview.readers.map((r) => [r.assetId, r.plan.summary.fixable])).toEqual([
      ['dash-1', 1],
      ['an-1', 0],
      ['an-2', 1],
    ]);
    // an-2 needs a choice, so it does not count as repairable.
    expect(preview.toRepair).toBe(1);
  });

  it('applies the proposed fixes in place, leaves clean readers alone and names the ones a person must decide', async () => {
    const result = await service().repair('ds-1', auth);
    expect(rebind.apply).toHaveBeenCalledTimes(1);
    expect(rebind.apply.mock.calls[0]!.slice(0, 3)).toEqual([
      'dashboard',
      'dash-1',
      { mode: 'update', rebinds: [], repairs: fixable.proposed.repairs },
    ]);
    expect(result.results).toEqual([
      {
        assetType: 'dashboard',
        assetId: 'dash-1',
        name: 'Reader dash-1',
        outcome: 'repaired',
        changes: 1,
      },
      { assetType: 'analysis', assetId: 'an-1', name: 'Reader an-1', outcome: 'clean' },
      { assetType: 'analysis', assetId: 'an-2', name: 'Reader an-2', outcome: 'needsChoice' },
    ]);
  });

  it('reports a reader QuickSight refused without stopping the others', async () => {
    rebind.repairPlan.mockImplementation(async () => fixable);
    rebind.apply.mockRejectedValueOnce(new Error('definition locked'));
    const result = await service().repair('ds-1', auth);
    expect(result.results.map((r) => r.outcome)).toEqual(['failed', 'repaired', 'repaired']);
    expect(result.results[0]!.error).toBe('definition locked');
  });

  it('refuses a dataset QuickSight cannot describe', async () => {
    quickSight.describeDataset.mockRejectedValue(new Error('nope'));
    await expect(service().preview('ds-x')).rejects.toThrow('could not be read');
  });
});
