import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InsightsService } from '../InsightsService';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('InsightsService', () => {
  const activity = { getAssetActivity: vi.fn() };
  const definitions = { loadDefinitionOutline: vi.fn() };
  const cloudWatch = { getDashboardHealth: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    activity.getAssetActivity.mockResolvedValue({
      totalViews: 120,
      uniqueViewers: 14,
      lastViewed: '2026-09-18T10:00:00Z',
      activities: [
        { timestamp: new Date(Date.now() - 2 * 86_400_000).toISOString() },
        { timestamp: new Date(Date.now() - 40 * 86_400_000).toISOString() },
      ],
    });
    definitions.loadDefinitionOutline.mockResolvedValue([
      {
        sheetId: 's1',
        name: 'Overview',
        layout: 'grid',
        elements: [
          { elementId: 'v1', kind: 'visual' },
          { elementId: 'c1', kind: 'filterControl' },
        ],
      },
    ]);
    cloudWatch.getDashboardHealth.mockResolvedValue({
      windowDays: 30,
      viewLoads: 90,
      viewLoadTimeP90Ms: 2100,
      visuals: [{ sheetId: 's1', visualId: 'v1', loadTimeP90Ms: 800, errors: 0 }],
    });
  });

  it('combines activity views with CloudWatch health for a dashboard', async () => {
    const service = new InsightsService(activity as any, definitions as any, cloudWatch as any);
    const insights = await service.get('dashboard', 'd1');
    expect(insights.views).toEqual({
      total: 120,
      last30d: 1,
      uniqueViewers: 14,
      lastViewedAt: '2026-09-18T10:00:00Z',
    });
    expect(cloudWatch.getDashboardHealth).toHaveBeenCalledWith(
      'd1',
      [{ sheetId: 's1', visualId: 'v1' }],
      30
    );
    expect(insights.health).toMatchObject({
      viewLoads: 90,
      viewLoadTimeP90Ms: 2100,
      visuals: [{ visualId: 'v1', loadTimeP90Ms: 800 }],
    });
  });

  it('skips health for analyses and survives missing activity or metrics', async () => {
    activity.getAssetActivity.mockRejectedValue(new Error('no cache'));
    cloudWatch.getDashboardHealth.mockRejectedValue(new Error('no metrics'));
    const service = new InsightsService(activity as any, definitions as any, cloudWatch as any);
    expect(await service.get('analysis', 'a1')).toEqual({
      assetType: 'analysis',
      assetId: 'a1',
      views: { total: 0, last30d: 0, uniqueViewers: 0, lastViewedAt: undefined },
    });
    const dash = await service.get('dashboard', 'd1');
    expect(dash.health).toBeUndefined();
    expect(cloudWatch.getDashboardHealth).toHaveBeenCalledTimes(1);
  });

  it('omits an all-empty health section', async () => {
    cloudWatch.getDashboardHealth.mockResolvedValue({
      windowDays: 30,
      viewLoads: 0,
      visuals: [{ sheetId: 's1', visualId: 'v1' }],
    });
    const service = new InsightsService(activity as any, definitions as any, cloudWatch as any);
    expect((await service.get('dashboard', 'd1')).health).toBeUndefined();
  });
});
