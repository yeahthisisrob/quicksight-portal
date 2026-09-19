/**
 * API stubs for the SMUS export stories: the status card in every state and
 * an export job that advances on each poll.
 */
import type { MockRoute } from '../../../../../.storybook/mocks/api';
import type { JobMetadata } from '../../../../shared/api/modules/jobs';
import type { SmusSnapshotSummary, SmusStatus } from '../../../../shared/api/modules/smus';

const HOUR_MS = 60 * 60 * 1000;
const POLLS_TO_FINISH = 4;
const PROGRESS_STEP = 25;

export const EXPORTED_AT = new Date(Date.now() - 2 * HOUR_MS).toISOString();

export const SNAPSHOT: SmusSnapshotSummary = {
  exportedAt: EXPORTED_AT,
  projectFilter: ['proj-published-prod', 'proj-published-dev'],
  domainId: 'dzd_example',
  region: 'us-east-1',
  projects: 3,
  listings: 42,
  publishers: 2,
  jobId: 'smus-export-1',
  diagnostics: {
    domainId: 'dzd_example',
    region: 'us-east-1',
    fromListProjects: 3,
    listings: 42,
    publishers: 2,
    callerArn: 'arn:aws:sts::123456789012:assumed-role/Portal-LambdaExecutionRole/api',
    roleArn: 'arn:aws:iam::123456789012:role/Portal-LambdaExecutionRole',
    profileStatus: 'ACTIVATED',
  },
};

/** A domain the role can see but is a member of nothing in. */
export const SNAPSHOT_NO_PROJECTS: SmusSnapshotSummary = {
  ...SNAPSHOT,
  projectFilter: [],
  projects: 0,
  listings: 0,
  publishers: 0,
  diagnostics: {
    ...SNAPSHOT.diagnostics!,
    fromListProjects: 0,
    listings: 0,
    publishers: 0,
  },
};

export const STATUS_EXPORTED: SmusStatus = {
  configured: true,
  domainId: 'dzd_example',
  region: 'us-east-1',
  portalUrl: 'https://dzd_example.sagemaker.us-east-1.on.aws',
  snapshot: SNAPSHOT,
};

export const STATUS_NEVER_EXPORTED: SmusStatus = {
  configured: true,
  domainId: 'dzd_example',
  region: 'us-east-1',
  portalUrl: 'https://dzd_example.sagemaker.us-east-1.on.aws',
};

export const STATUS_NOT_CONFIGURED: SmusStatus = { configured: false };

/** Status plus an export job that completes after a few polls. */
export function smusExportRoutes(
  status: SmusStatus,
  options: { failJob?: boolean; statusError?: string } = {}
): MockRoute[] {
  let polls = 0;
  let current: SmusStatus = status;
  const jobId = 'smus-export-story';
  const job = (): JobMetadata => {
    polls += 1;
    const done = polls >= POLLS_TO_FINISH;
    if (done) {
      current = { ...current, snapshot: { ...SNAPSHOT, exportedAt: new Date().toISOString() } };
    }
    return {
      jobId,
      jobType: 'export',
      status: done ? (options.failJob ? 'failed' : 'completed') : 'processing',
      progress: Math.min(polls * PROGRESS_STEP, PROGRESS_STEP * POLLS_TO_FINISH),
      message: done
        ? options.failJob
          ? 'SearchListings failed'
          : 'SMUS export completed: 3 projects, 42 listings'
        : (['Listing projects', 'Sweeping published listings', 'Naming publishers'][polls - 1] ??
          'Writing the snapshot'),
      startTime: new Date().toISOString(),
      error: done && options.failJob ? 'AccessDeniedException: datazone:SearchListings' : undefined,
    };
  };
  return [
    {
      method: 'get',
      url: '/smus/status',
      respond: () =>
        options.statusError
          ? { status: 500, body: { success: false, error: options.statusError } }
          : { body: { success: true, data: current } },
    },
    {
      method: 'post',
      url: '/smus/export',
      respond: () => ({
        status: 202,
        body: {
          success: true,
          data: { jobId, status: 'queued', message: 'SMUS export queued' },
        },
      }),
    },
    {
      method: 'get',
      url: `/jobs/${jobId}`,
      respond: () => ({ body: { success: true, data: job() } }),
    },
  ];
}
