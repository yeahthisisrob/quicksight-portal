import { describe, expect, it, vi } from 'vitest';

import { CloudWatchAdapter } from '../CloudWatchAdapter';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CloudWatchAdapter', () => {
  it('reads dashboard and visual metrics in one call and maps them back by id', async () => {
    const client = {
      send: vi.fn().mockResolvedValue({
        MetricDataResults: [
          { Id: 'dv', Values: [42] },
          { Id: 'dl', Values: [1800] },
          { Id: 'vl0', Values: [900] },
          { Id: 've0', Values: [3] },
        ],
      }),
    };
    const adapter = new CloudWatchAdapter('us-east-1', client as any);
    const health = await adapter.getDashboardHealth(
      'd1',
      [
        { sheetId: 's1', visualId: 'v1' },
        { sheetId: 's1', visualId: 'v2' },
      ],
      30
    );

    expect(client.send).toHaveBeenCalledTimes(1);
    const input = client.send.mock.calls[0]![0].input;
    expect(input.MetricDataQueries).toHaveLength(6);
    expect(input.MetricDataQueries[0].MetricStat.Metric.MetricName).toBe('DashboardViewCount');
    expect(input.MetricDataQueries[2].MetricStat.Metric.Dimensions).toEqual([
      { Name: 'DashboardId', Value: 'd1' },
      { Name: 'SheetId', Value: 's1' },
      { Name: 'VisualId', Value: 'v1' },
    ]);
    expect(health).toEqual({
      windowDays: 30,
      viewLoads: 42,
      viewLoadTimeP90Ms: 1800,
      visuals: [
        { sheetId: 's1', visualId: 'v1', loadTimeP90Ms: 900, errors: 3 },
        { sheetId: 's1', visualId: 'v2', loadTimeP90Ms: undefined, errors: undefined },
      ],
    });
  });

  it('batches a page of dashboards with a metric search for visual errors, and datasets with ingestion metrics', async () => {
    const client = {
      send: vi.fn().mockResolvedValue({
        MetricDataResults: [
          { Id: 'a0', Values: [10] },
          { Id: 'b0', Values: [2500] },
          { Id: 'c0', Values: [1] },
        ],
      }),
    };
    const adapter = new CloudWatchAdapter('us-east-1', client as any);

    const dashboards = await adapter.getAssetHealthBatch('dashboard', ['d1', 'd2'], 30);
    const queries = client.send.mock.calls[0]![0].input.MetricDataQueries;
    expect(queries).toHaveLength(6);
    expect(queries[2].Expression).toContain('VisualLoadErrorCount');
    expect(queries[2].Expression).toContain('DashboardId="d1"');
    expect(dashboards).toEqual([
      { id: 'd1', viewLoads: 10, viewLoadTimeP90Ms: 2500, visualErrors: 1 },
      { id: 'd2', viewLoads: undefined, viewLoadTimeP90Ms: undefined, visualErrors: undefined },
    ]);

    const datasets = await adapter.getAssetHealthBatch('dataset', ['ds1'], 30);
    const dsQueries = client.send.mock.calls[1]![0].input.MetricDataQueries;
    expect(dsQueries.map((q: any) => q.MetricStat.Metric.MetricName)).toEqual([
      'IngestionInvocationCount',
      'IngestionLatency',
      'IngestionErrorRowCount',
    ]);
    expect(datasets[0]).toEqual({
      id: 'ds1',
      ingestionRuns: 10,
      ingestionLatencyP90Ms: 2500,
      ingestionErrorRows: 1,
    });
  });

  it('returns nothing for no ids without calling CloudWatch', async () => {
    const client = { send: vi.fn() };
    expect(
      await new CloudWatchAdapter('us-east-1', client as any).getAssetHealthBatch('dataset', [], 30)
    ).toEqual([]);
    expect(client.send).not.toHaveBeenCalled();
  });
});
