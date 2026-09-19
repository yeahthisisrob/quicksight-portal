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
