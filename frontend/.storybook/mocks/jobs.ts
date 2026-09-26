/**
 * A realistic week of jobs for stories - a running export, a finished SMUS
 * export with phases, a bulk operation with item failures, a failed export,
 * the assistant and the planner - and the routes that answer the jobs API
 * the way the server does: filtered by type, status and start date, with
 * logs that honour the `after` cursor.
 */
import type { JobLog, JobMetadata } from '../../src/shared/api/modules/jobs';
import type { MockRoute } from './api';

const MIN_MS = 60 * 1000;
const ago = (minutes: number) => new Date(Date.now() - minutes * MIN_MS).toISOString();

export const RUNNING_EXPORT_ID = 'export-7f3a';

const JOBS: JobMetadata[] = [
  {
    jobId: RUNNING_EXPORT_ID,
    jobType: 'export',
    status: 'processing',
    progress: 62,
    message: 'Exporting datasets: 214 of 340',
    startTime: ago(6),
    lastUpdatedTime: ago(0),
    userId: '4f1c8a2e-9b3d-4e5f-8a6b-7c8d9e0f1a2b',
    startedBy: 'rob@example.com',
    startedByPerson: {
      label: 'rob@example.com',
      kind: 'person',
      email: 'rob@example.com',
      quickSightUserName: 'rob',
      quickSightUserArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/rob',
    },
    stats: {
      totalAssets: 1200,
      processedAssets: 744,
      failedAssets: 2,
      operations: {
        'api.dashboard.describe': 312,
        'api.dataset.describe': 214,
        'api.list': 18,
        's3.put': 530,
      },
    },
  },
  {
    jobId: 'smus-2c91',
    jobType: 'smus-export',
    status: 'completed',
    progress: 100,
    message: 'Swept 2 projects: 84 published listings, 61 linked to datasets',
    startTime: ago(95),
    endTime: ago(93),
    userId: '4f1c8a2e-9b3d-4e5f-8a6b-7c8d9e0f1a2b',
    startedBy: 'rob@example.com',
    startedByPerson: {
      label: 'rob@example.com',
      kind: 'person',
      email: 'rob@example.com',
      quickSightUserName: 'rob',
      quickSightUserArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/rob',
    },
    phases: [
      { key: 'list-projects', status: 'completed', message: '2 projects' },
      {
        key: 'search-listings',
        status: 'completed',
        message: '84 listings',
        counts: { processed: 84, total: 84 },
      },
      { key: 'link-datasets', status: 'completed', message: '61 of 84 linked' },
    ],
  },
  {
    jobId: 'bulk-91de',
    jobType: 'bulk-operation',
    status: 'completed',
    progress: 100,
    message: 'Tagged 38 of 40 dashboards',
    error: 'AccessDeniedException',
    startTime: ago(240),
    endTime: ago(238),
    userId: '9a2b7c1d-0e3f-4a5b-8c6d-1e2f3a4b5c6d',
    startedBy: 'analyst@example.com',
    startedByPerson: { label: 'analyst@example.com', kind: 'person', email: 'analyst@example.com' },
    stats: { totalAssets: 40, processedAssets: 40, failedAssets: 2 },
    failures: [
      { item: 'Finance close', error: 'AccessDeniedException: not an owner of this dashboard' },
      { item: 'Board pack', error: 'AccessDeniedException: not an owner of this dashboard' },
    ],
  },
  {
    jobId: 'export-11b0',
    jobType: 'export',
    status: 'failed',
    message: 'Export failed',
    error: 'ThrottlingException: Rate exceeded (DescribeDashboardDefinition)',
    startTime: ago(60 * 26),
    endTime: ago(60 * 26 - 4),
    userId: '4f1c8a2e-9b3d-4e5f-8a6b-7c8d9e0f1a2b',
    startedBy: 'rob@example.com',
    startedByPerson: {
      label: 'rob@example.com',
      kind: 'person',
      email: 'rob@example.com',
      quickSightUserName: 'rob',
      quickSightUserArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/rob',
    },
    stats: { totalAssets: 1200, processedAssets: 380, failedAssets: 1 },
  },
  {
    jobId: 'assistant-5e2a',
    jobType: 'assistant',
    status: 'completed',
    progress: 100,
    message: 'Answered with a plan and a wireframe',
    startTime: ago(60 * 30),
    endTime: ago(60 * 30 - 1),
    userId: '4f1c8a2e-9b3d-4e5f-8a6b-7c8d9e0f1a2b',
    startedBy: 'rob@example.com',
    startedByPerson: {
      label: 'rob@example.com',
      kind: 'person',
      email: 'rob@example.com',
      quickSightUserName: 'rob',
      quickSightUserArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/rob',
    },
  },
  {
    jobId: 'planner-77c1',
    jobType: 'planner',
    status: 'stopped',
    message: 'Stopped by rob@example.com',
    startTime: ago(60 * 50),
    endTime: ago(60 * 50 - 2),
    userId: '4f1c8a2e-9b3d-4e5f-8a6b-7c8d9e0f1a2b',
    // An older record kept only the sign-in id; the server names it.
    startedByPerson: {
      label: 'rob@example.com',
      kind: 'person',
      email: 'rob@example.com',
      quickSightUserName: 'rob',
      quickSightUserArn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/rob',
    },
  },
];

/** A running export's log: progress, a throttle warning, an asset error. */
export const EXPORT_LOG: JobLog[] = [
  { timestamp: ago(6), level: 'info', message: 'Export started: 7 asset types, smart mode' },
  { timestamp: ago(6), level: 'debug', message: 'Lock acquired', details: { lock: 'export' } },
  {
    timestamp: ago(5),
    level: 'info',
    message: 'Listed 312 dashboards',
    details: { assetType: 'dashboard', apiCalls: 4 },
  },
  {
    timestamp: ago(4),
    level: 'warn',
    message: 'Throttled; backing off 800 ms',
    details: { assetType: 'dashboard', operation: 'DescribeDashboardDefinition', attempt: 2 },
  },
  {
    timestamp: ago(4),
    level: 'error',
    message: 'Could not describe dashboard definition',
    details: {
      assetType: 'dashboard',
      assetId: 'finance-close',
      error: 'AccessDeniedException: the portal role cannot read this dashboard',
    },
  },
  {
    timestamp: ago(3),
    level: 'info',
    message: 'Exported 312 dashboards',
    details: { assetType: 'dashboard', apiCalls: 312 },
  },
  {
    timestamp: ago(2),
    level: 'info',
    message: 'Exporting datasets',
    details: { assetType: 'dataset' },
  },
  ...Array.from({ length: 40 }, (_, i) => ({
    timestamp: ago(2 - i * 0.04),
    level: 'info' as const,
    message: `Exported dataset ${i + 1}`,
    details: { assetType: 'dataset', assetId: `ds-${String(i + 1).padStart(3, '0')}`, apiCalls: 2 },
  })),
];

function jobId(url: string | undefined): string {
  const match = String(url ?? '').match(/\/jobs\/([^/?]+)/);
  return decodeURIComponent(match?.[1] ?? '');
}

/** The jobs API over JOBS; overrides first so a story can replace a job. */
export function jobsRoutes(jobs: JobMetadata[] = JOBS, log: JobLog[] = EXPORT_LOG): MockRoute[] {
  return [
    {
      method: 'get',
      url: /\/jobs\/[^/]+\/logs/,
      respond: (config) => {
        const after = config.params?.after as string | undefined;
        const index = after ? Number(after.replace('LOG#', '')) + 1 : 0;
        const lines = log.slice(index);
        return {
          body: {
            success: true,
            data: {
              jobId: jobId(config.url),
              logs: lines,
              ...(log.length > 0 && { cursor: `LOG#${log.length - 1}` }),
            },
          },
        };
      },
    },
    {
      method: 'get',
      url: /\/jobs\/[^/]+\/result$/,
      respond: () => ({ body: { success: true, data: { ok: true } } }),
    },
    {
      method: 'post',
      url: /\/jobs\/[^/]+\/stop$/,
      respond: () => ({ body: { success: true, data: {} } }),
    },
    {
      method: 'get',
      url: /\/jobs\/[^/?]+$/,
      respond: (config) => {
        const job = jobs.find((j) => j.jobId === jobId(config.url));
        return job
          ? { body: { success: true, data: job } }
          : { status: 404, body: { success: false } };
      },
    },
    {
      method: 'get',
      url: /\/jobs(\?|$)/,
      respond: (config) => {
        const { type, status, afterDate } = (config.params ?? {}) as Record<string, string>;
        const after = afterDate ? Date.parse(afterDate) : 0;
        const data = jobs.filter(
          (j) =>
            (!type || j.jobType === type) &&
            (!status || j.status === status) &&
            Date.parse(j.startTime) >= after
        );
        return { body: { success: true, data } };
      },
    },
  ];
}
