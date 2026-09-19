import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
} from '@aws-sdk/client-cloudwatch';

import { logger } from '../../shared/utils/logger';

export interface DashboardHealth {
  windowDays: number;
  viewLoads: number;
  viewLoadTimeP90Ms?: number;
  visuals: Array<{ sheetId: string; visualId: string; loadTimeP90Ms?: number; errors?: number }>;
}

const NAMESPACE = 'AWS/QuickSight';
const SECONDS_PER_DAY = 86_400;
const MS_PER_SECOND = 1000;
/** GetMetricData accepts 500 queries; keep headroom for the two dashboard ones. */
const QUERIES_PER_CALL = 400;
const QUERIES_PER_VISUAL = 2;

/**
 * QuickSight publishes per-dashboard and per-visual metrics to CloudWatch
 * (Enterprise edition). One GetMetricData call per ~200 visuals gives view
 * counts, p90 load times and load errors over a window - enough to flag a
 * slow or failing visual before it gets cloned.
 */
export class CloudWatchAdapter {
  private readonly client: CloudWatchClient;

  public constructor(region: string, client?: CloudWatchClient) {
    this.client = client ?? new CloudWatchClient({ region });
  }

  /** Health for a page of dashboards or datasets in one batched read. */
  public async getAssetHealthBatch(
    kind: HealthKind,
    ids: string[],
    windowDays: number
  ): Promise<AssetHealth[]> {
    return await readAssetHealthBatch(this.client, kind, ids, windowDays);
  }

  public async getDashboardHealth(
    dashboardId: string,
    visuals: Array<{ sheetId: string; visualId: string }>,
    windowDays: number
  ): Promise<DashboardHealth> {
    const end = new Date();
    const start = new Date(end.getTime() - windowDays * SECONDS_PER_DAY * MS_PER_SECOND);
    const period = windowDays * SECONDS_PER_DAY;

    const queries: MetricDataQuery[] = [
      metric('dv', 'DashboardViewCount', { DashboardId: dashboardId }, 'Sum', period),
      metric('dl', 'DashboardViewLoadTime', { DashboardId: dashboardId }, 'p90', period),
    ];
    visuals.forEach((v, i) => {
      const dims = { DashboardId: dashboardId, SheetId: v.sheetId, VisualId: v.visualId };
      queries.push(metric(`vl${i}`, 'VisualLoadTime', dims, 'p90', period));
      queries.push(metric(`ve${i}`, 'VisualLoadErrorCount', dims, 'Sum', period));
    });

    const values = new Map<string, number>();
    for (let i = 0; i < queries.length; i += QUERIES_PER_CALL) {
      const response = await this.client.send(
        new GetMetricDataCommand({
          StartTime: start,
          EndTime: end,
          MetricDataQueries: queries.slice(i, i + QUERIES_PER_CALL),
        })
      );
      for (const result of response.MetricDataResults ?? []) {
        const value = result.Values?.[0];
        if (result.Id && typeof value === 'number') {
          values.set(result.Id, value);
        }
      }
    }
    logger.info('QuickSight CloudWatch health read', {
      dashboardId,
      visuals: visuals.length,
      queries: queries.length,
      calls: Math.ceil(queries.length / QUERIES_PER_CALL) || 1,
    });

    return {
      windowDays,
      viewLoads: values.get('dv') ?? 0,
      viewLoadTimeP90Ms: values.get('dl'),
      visuals: visuals.map((v, i) => ({
        sheetId: v.sheetId,
        visualId: v.visualId,
        loadTimeP90Ms: values.get(`vl${i}`),
        errors: values.get(`ve${i}`),
      })),
    };
  }
}

export type HealthKind = 'dashboard' | 'dataset';

export interface AssetHealth {
  id: string;
  viewLoads?: number;
  viewLoadTimeP90Ms?: number;
  visualErrors?: number;
  ingestionRuns?: number;
  ingestionLatencyP90Ms?: number;
  ingestionErrorRows?: number;
}

const QUERIES_PER_ASSET = 3;

/** Metric-math SEARCH over every visual of a dashboard, summed. */
function visualErrorSearch(dashboardId: string, period: number): string {
  const escaped = dashboardId.replace(/"/g, '\\"');
  return `SUM(SEARCH('{${NAMESPACE},DashboardId,SheetId,VisualId} MetricName="VisualLoadErrorCount" DashboardId="${escaped}"', 'Sum', ${period}))`;
}

/**
 * One batched read for a page of assets. Dashboards: views, p90 view load
 * time, and visual load errors summed across their visuals with a metric
 * search, so no outline is needed. Datasets: refresh runs, p90 ingestion
 * latency and error rows.
 */
export async function readAssetHealthBatch(
  client: CloudWatchClient,
  kind: HealthKind,
  ids: string[],
  windowDays: number
): Promise<AssetHealth[]> {
  if (ids.length === 0) {
    return [];
  }
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * SECONDS_PER_DAY * MS_PER_SECOND);
  const period = windowDays * SECONDS_PER_DAY;

  const queries: MetricDataQuery[] = [];
  ids.forEach((id, i) => {
    if (kind === 'dashboard') {
      queries.push(metric(`a${i}`, 'DashboardViewCount', { DashboardId: id }, 'Sum', period));
      queries.push(metric(`b${i}`, 'DashboardViewLoadTime', { DashboardId: id }, 'p90', period));
      queries.push({ Id: `c${i}`, Expression: visualErrorSearch(id, period), Period: period });
    } else {
      queries.push(metric(`a${i}`, 'IngestionInvocationCount', { DatasetId: id }, 'Sum', period));
      queries.push(metric(`b${i}`, 'IngestionLatency', { DatasetId: id }, 'p90', period));
      queries.push(metric(`c${i}`, 'IngestionErrorRowCount', { DatasetId: id }, 'Sum', period));
    }
  });

  const values = new Map<string, number>();
  const perCall = QUERIES_PER_CALL - (QUERIES_PER_CALL % QUERIES_PER_ASSET);
  for (let i = 0; i < queries.length; i += perCall) {
    const response = await client.send(
      new GetMetricDataCommand({
        StartTime: start,
        EndTime: end,
        MetricDataQueries: queries.slice(i, i + perCall),
      })
    );
    for (const result of response.MetricDataResults ?? []) {
      const value = result.Values?.[0];
      if (result.Id && typeof value === 'number') {
        values.set(result.Id, value);
      }
    }
  }

  return ids.map((id, i) => {
    const a = values.get(`a${i}`);
    const b = values.get(`b${i}`);
    const c = values.get(`c${i}`);
    return kind === 'dashboard'
      ? { id, viewLoads: a, viewLoadTimeP90Ms: b, visualErrors: c }
      : { id, ingestionRuns: a, ingestionLatencyP90Ms: b, ingestionErrorRows: c };
  });
}

function metric(
  id: string,
  name: string,
  dimensions: Record<string, string>,
  stat: string,
  period: number
): MetricDataQuery {
  return {
    Id: id,
    MetricStat: {
      Metric: {
        Namespace: NAMESPACE,
        MetricName: name,
        Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
      },
      Period: period,
      Stat: stat,
    },
  };
}

/** For sizing the queries list; two per visual. */
export const HEALTH_QUERIES_PER_VISUAL = QUERIES_PER_VISUAL;
