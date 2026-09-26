import type { Meta, StoryObj } from '@storybook/react-vite';

import type { JobMetadata, JobPhase } from '@/shared/api/modules/jobs';

import { ActivityRefreshProgress } from './ActivityRefreshProgress';

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
        phase('refresh-ingestions', 'pending'),
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
        phase('refresh-ingestions', 'completed'),
      ],
      stats: { operations: {} } as JobMetadata['stats'],
    }),
  },
};

/** Completion with warnings — event-types that hit the page cap and event-types that failed. */
export const CompletedWithWarnings: Story = {
  args: {
    jobStatus: baseJob({
      status: 'completed',
      progress: 100,
      message: 'Successfully refreshed activity data for 312 items (3 truncated, 5 failed)',
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
          { processed: 200, total: 200, newEvents: 5872, truncated: 2, errors: 5 },
          80,
          5
        ),
        phase('merge-and-persist', 'completed', undefined, 5, 0),
        phase('refresh-ingestions', 'completed'),
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
        phase('refresh-ingestions', 'pending'),
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
