import { type JobMetadata, type JobPhase } from '@/shared/api/modules/jobs';

import { ActivityRefreshProgress } from './ActivityRefreshProgress';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/Activity/ActivityRefreshProgress',
  component: ActivityRefreshProgress,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Step-based progress card for the activity-refresh job. Maps the backend `JobMetadata.phases` array onto the generic JobProgress component, surfaces truncation and error counts on completion, and degrades gracefully when phases are absent.',
      },
    },
  },
} satisfies Meta<typeof ActivityRefreshProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

const NOW = Date.parse('2026-05-06T12:00:00.000Z');
const isoSecondsAgo = (s: number): string => new Date(NOW - s * 1000).toISOString();

const phase = (
  key: JobPhase['key'],
  status: JobPhase['status'],
  counts?: JobPhase['counts'],
  startedSecondsAgo?: number,
  finishedSecondsAgo?: number
): JobPhase => ({
  key,
  status,
  startedAt: startedSecondsAgo !== undefined ? isoSecondsAgo(startedSecondsAgo) : undefined,
  finishedAt: finishedSecondsAgo !== undefined ? isoSecondsAgo(finishedSecondsAgo) : undefined,
  counts,
});

const baseJob = (overrides: Partial<JobMetadata>): JobMetadata => ({
  jobId: 'activity-refresh-1234567890-abc',
  jobType: 'activity-refresh',
  status: 'processing',
  progress: 0,
  startTime: isoSecondsAgo(20),
  ...overrides,
});

/** No job in flight — component renders nothing. */
export const Empty: Story = {
  args: {
    jobStatus: null,
  },
};

/** Job just queued, phases initialized but none active yet. */
export const Queued: Story = {
  args: {
    jobStatus: baseJob({
      status: 'queued',
      progress: 0,
      message: 'Activity refresh starting',
      phases: [
        phase('initialize', 'pending'),
        phase('fetch-views', 'pending'),
        phase('fetch-mutations', 'pending'),
        phase('merge-and-persist', 'pending'),
      ],
    }),
  },
};

/** Initialize phase active; cache loaded, fetch plan being built. */
export const Initializing: Story = {
  args: {
    jobStatus: baseJob({
      status: 'processing',
      progress: 5,
      message: 'Loading existing cache and computing fetch plan',
      phases: [
        phase('initialize', 'in_progress', undefined, 2),
        phase('fetch-views', 'pending'),
        phase('fetch-mutations', 'pending'),
        phase('merge-and-persist', 'pending'),
      ],
    }),
  },
};

/** Mid fetch-views phase, ~half the view event-types processed. */
export const FetchingViews: Story = {
  args: {
    jobStatus: baseJob({
      status: 'processing',
      progress: 25,
      message: 'Activity refresh: fetch-views',
      startTime: isoSecondsAgo(8),
      phases: [
        phase('initialize', 'completed', undefined, 8, 6),
        phase(
          'fetch-views',
          'in_progress',
          { processed: 2, total: 3, newEvents: 412, truncated: 0, errors: 0 },
          6
        ),
        phase('fetch-mutations', 'pending'),
        phase('merge-and-persist', 'pending'),
      ],
    }),
  },
};

/** Heart of the refresh — fetching the long mutation list with live counts. */
export const FetchingMutations: Story = {
  args: {
    jobStatus: baseJob({
      status: 'processing',
      progress: 80,
      message: 'Activity refresh: fetch-mutations',
      startTime: isoSecondsAgo(35),
      phases: [
        phase('initialize', 'completed', undefined, 35, 33),
        phase(
          'fetch-views',
          'completed',
          { processed: 3, total: 3, newEvents: 1240, truncated: 0, errors: 0 },
          33,
          27
        ),
        phase(
          'fetch-mutations',
          'in_progress',
          { processed: 132, total: 200, newEvents: 87, truncated: 0, errors: 0 },
          27
        ),
        phase('merge-and-persist', 'pending'),
      ],
    }),
  },
};

/** Persistence phase — mutations done, merging and writing to S3. */
export const Persisting: Story = {
  args: {
    jobStatus: baseJob({
      status: 'processing',
      progress: 95,
      message: 'Activity refresh: merge-and-persist',
      startTime: isoSecondsAgo(48),
      phases: [
        phase('initialize', 'completed', undefined, 48, 46),
        phase(
          'fetch-views',
          'completed',
          { processed: 3, total: 3, newEvents: 1240, truncated: 0, errors: 0 },
          46,
          40
        ),
        phase(
          'fetch-mutations',
          'completed',
          { processed: 200, total: 200, newEvents: 158, truncated: 0, errors: 0 },
          40,
          5
        ),
        phase('merge-and-persist', 'in_progress', undefined, 5),
      ],
    }),
  },
};

/** Clean completion — green confirmation footer with new-event count. */
export const CompletedClean: Story = {
  args: {
    jobStatus: baseJob({
      status: 'completed',
      progress: 100,
      message: 'Successfully refreshed activity data for 312 items',
      startTime: isoSecondsAgo(50),
      endTime: isoSecondsAgo(0),
      duration: 50_000,
      phases: [
        phase('initialize', 'completed', undefined, 50, 48),
        phase(
          'fetch-views',
          'completed',
          { processed: 3, total: 3, newEvents: 1240, truncated: 0, errors: 0 },
          48,
          42
        ),
        phase(
          'fetch-mutations',
          'completed',
          { processed: 200, total: 200, newEvents: 158, truncated: 0, errors: 0 },
          42,
          5
        ),
        phase('merge-and-persist', 'completed', undefined, 5, 0),
      ],
      stats: { operations: {} } as JobMetadata['stats'],
    }),
  },
};

/** Completion with truncation — some event-types hit the page cap. */
export const CompletedWithTruncation: Story = {
  args: {
    jobStatus: baseJob({
      status: 'completed',
      progress: 100,
      message:
        'Successfully refreshed activity data for 312 items (3 event types hit pagination cap)',
      startTime: isoSecondsAgo(120),
      endTime: isoSecondsAgo(0),
      duration: 120_000,
      phases: [
        phase('initialize', 'completed', undefined, 120, 118),
        phase(
          'fetch-views',
          'completed',
          { processed: 3, total: 3, newEvents: 4520, truncated: 1, errors: 0 },
          118,
          80
        ),
        phase(
          'fetch-mutations',
          'completed',
          { processed: 200, total: 200, newEvents: 5872, truncated: 2, errors: 0 },
          80,
          5
        ),
        phase('merge-and-persist', 'completed', undefined, 5, 0),
      ],
    }),
  },
};

/** Completion with partial errors — some event-types failed but ratio < 10%. */
export const CompletedWithErrors: Story = {
  args: {
    jobStatus: baseJob({
      status: 'completed',
      progress: 100,
      message: 'Successfully refreshed activity data for 312 items (5 event types failed)',
      startTime: isoSecondsAgo(60),
      endTime: isoSecondsAgo(0),
      duration: 60_000,
      phases: [
        phase('initialize', 'completed', undefined, 60, 58),
        phase(
          'fetch-views',
          'completed',
          { processed: 3, total: 3, newEvents: 1240, truncated: 0, errors: 0 },
          58,
          50
        ),
        phase(
          'fetch-mutations',
          'completed',
          { processed: 200, total: 200, newEvents: 87, truncated: 0, errors: 5 },
          50,
          5
        ),
        phase('merge-and-persist', 'completed', undefined, 5, 0),
      ],
    }),
  },
};

/** Failed — too many event-types failed, refresh marked unsuccessful. */
export const Failed: Story = {
  args: {
    jobStatus: baseJob({
      status: 'failed',
      progress: 80,
      message: 'Error refreshing activity: 87 of 200 event types failed',
      startTime: isoSecondsAgo(45),
      endTime: isoSecondsAgo(0),
      duration: 45_000,
      error: '87 of 200 event types failed during fetch',
      phases: [
        phase('initialize', 'completed', undefined, 45, 43),
        phase(
          'fetch-views',
          'completed',
          { processed: 3, total: 3, newEvents: 0, truncated: 0, errors: 0 },
          43,
          40
        ),
        phase(
          'fetch-mutations',
          'failed',
          { processed: 200, total: 200, newEvents: 12, truncated: 0, errors: 87 },
          40,
          0
        ),
        phase('merge-and-persist', 'pending'),
      ],
    }),
  },
};

/** User-requested stop mid-fetch — partial results were persisted. */
export const Stopped: Story = {
  args: {
    jobStatus: baseJob({
      status: 'stopped',
      progress: 60,
      message: 'Activity refresh aborted; partial results saved',
      startTime: isoSecondsAgo(28),
      endTime: isoSecondsAgo(0),
      duration: 28_000,
      phases: [
        phase('initialize', 'completed', undefined, 28, 26),
        phase(
          'fetch-views',
          'completed',
          { processed: 3, total: 3, newEvents: 600, truncated: 0, errors: 0 },
          26,
          20
        ),
        phase(
          'fetch-mutations',
          'in_progress',
          { processed: 95, total: 200, newEvents: 32, truncated: 0, errors: 0 },
          20
        ),
        phase('merge-and-persist', 'pending'),
      ],
    }),
  },
};

/** Old job persisted before phase-tracking shipped — degrades to header-only. */
export const NoPhasesFallback: Story = {
  args: {
    jobStatus: baseJob({
      status: 'processing',
      progress: 50,
      message: 'Refreshing activity (legacy job, no phase data)',
      startTime: isoSecondsAgo(15),
      phases: undefined,
    }),
  },
};
