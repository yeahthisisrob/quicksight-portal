/**
 * API stubs for the Export tab: the cache summary, the job list, one job
 * with its log, a start that queues a job, and the activity timeline.
 */
import type { MockRoute } from '../../../../../.storybook/mocks/api';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const JOB_ID = 'export-story-job';

export interface ExportStubOptions {
  /** A job in flight when the page opens. */
  running?: boolean;
  /** The last job failed on some assets. */
  withErrors?: boolean;
  /** Nothing cached yet. */
  emptyCache?: boolean;
}

const LOGS = (withErrors: boolean) => {
  const now = Date.now();
  return [
    {
      timestamp: new Date(now - 4 * MINUTE_MS).toISOString(),
      level: 'info',
      message: 'Export started',
    },
    {
      timestamp: new Date(now - 3 * MINUTE_MS).toISOString(),
      level: 'info',
      message: 'Listed 125 dashboards',
      details: { assetType: 'dashboard', apiCalls: 3 },
    },
    {
      timestamp: new Date(now - 2 * MINUTE_MS).toISOString(),
      level: withErrors ? 'error' : 'info',
      message: withErrors
        ? 'Failed to describe dataset orders_silver: AccessDenied'
        : 'Enriched 89 datasets',
      details: { assetType: 'dataset', assetId: 'orders-silver', apiCalls: 89 },
    },
    {
      timestamp: new Date(now - MINUTE_MS).toISOString(),
      level: withErrors ? 'warn' : 'info',
      message: withErrors ? 'Completed with 1 failure' : 'Export completed in 3m 12s',
      details: { apiCalls: 412 },
    },
  ];
};

export function exportRoutes(options: ExportStubOptions = {}): MockRoute[] {
  const now = Date.now();
  const job = {
    jobId: JOB_ID,
    jobType: 'export',
    status: options.running ? 'processing' : options.withErrors ? 'completed' : 'completed',
    progress: options.running ? 42 : 100,
    message: options.running
      ? 'Enriching datasets (batch 3 of 7)'
      : options.withErrors
        ? 'Completed with 1 failure'
        : 'Export completed',
    startTime: new Date(now - 5 * MINUTE_MS).toISOString(),
    lastUpdatedTime: new Date(now - 20_000).toISOString(),
    endTime: options.running ? undefined : new Date(now - MINUTE_MS).toISOString(),
    duration: options.running ? undefined : 4 * MINUTE_MS,
    stats: {
      totalAssets: 684,
      processedAssets: options.running ? 290 : 684,
      failedAssets: options.withErrors ? 1 : 0,
      apiCalls: 412,
      operations: { 'api.dashboard.describe': 125, 'api.dataset.describe': 287 },
    },
    checkpoint: {
      completedAssetTypes: options.running
        ? ['dashboards']
        : ['dashboards', 'datasets', 'analyses'],
    },
  };
  const history = [
    job,
    {
      ...job,
      jobId: 'export-yesterday',
      status: 'completed',
      progress: 100,
      message: 'Export completed',
      startTime: new Date(now - DAY_MS).toISOString(),
      endTime: new Date(now - DAY_MS + 3 * MINUTE_MS).toISOString(),
      duration: 3 * MINUTE_MS,
      stats: { ...job.stats, failedAssets: 0 },
    },
    {
      jobId: 'activity-refresh-1',
      jobType: 'activity-refresh',
      status: 'completed',
      progress: 100,
      message: 'Activity refresh completed',
      startTime: new Date(now - 2 * DAY_MS).toISOString(),
      duration: 90_000,
    },
    {
      jobId: 'smus-export-1',
      jobType: 'smus-export',
      status: 'completed',
      progress: 100,
      message: 'SMUS export completed: 3 projects, 42 listings',
      startTime: new Date(now - 2 * DAY_MS).toISOString(),
      duration: 25_000,
    },
  ];

  return [
    {
      method: 'get',
      url: '/export/summary',
      respond: () => ({
        body: {
          success: true,
          data: options.emptyCache
            ? {
                totalAssets: 0,
                lastExportDate: null,
                archivedAssetCounts: { total: 0 },
                fieldStatistics: null,
              }
            : {
                totalAssets: 684,
                exportedAssets: 684,
                lastExportDate: new Date(now - MINUTE_MS).toISOString(),
                archivedAssetCounts: { total: 3 },
                fieldStatistics: {
                  totalFields: 3456,
                  totalCalculatedFields: 789,
                  totalUniqueFields: 2667,
                },
              },
        },
      }),
    },
    {
      method: 'get',
      url: /\/jobs\/[^/]+\/logs$/,
      respond: () => ({
        body: { success: true, data: { jobId: JOB_ID, logs: LOGS(Boolean(options.withErrors)) } },
      }),
    },
    {
      method: 'post',
      url: /\/jobs\/[^/]+\/stop$/,
      respond: () => ({ body: { success: true, data: { ...job, status: 'stopped' } } }),
    },
    {
      method: 'get',
      url: /\/jobs\/[^/?]+$/,
      respond: () => ({ body: { success: true, data: job } }),
    },
    {
      method: 'get',
      url: /\/jobs(\?|$)/,
      respond: () => ({
        body: { success: true, data: options.emptyCache ? [] : history },
      }),
    },
    {
      method: 'post',
      url: /\/export$/,
      respond: () => ({
        status: 202,
        body: {
          success: true,
          data: { jobId: JOB_ID, status: 'queued', message: 'Export queued' },
        },
      }),
    },
    {
      method: 'get',
      url: '/activity/timeline',
      respond: () => ({
        body: { success: true, data: { items: [], nextCursor: null, hasMore: false } },
      }),
    },
  ];
}
