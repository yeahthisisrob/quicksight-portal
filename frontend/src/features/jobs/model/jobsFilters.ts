/**
 * The Jobs tab's filters, kept in the URL so a filtered view is a link:
 * which type, which status, how far back, and which job is open.
 */

import { JOB_TYPE_LABELS } from '@/entities/job';

import type { JobListOptions, JobStatus, JobType } from '@/shared/api/modules/jobs';

export type JobsSince = '24h' | '7d' | '30d' | 'all';

export interface JobsFilters {
  type?: JobType;
  status?: JobStatus;
  since: JobsSince;
  /** The job open in the detail drawer. */
  job?: string;
}

export const SINCE_OPTIONS: ReadonlyArray<{ value: JobsSince; label: string }> = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All' },
];

export const STATUS_OPTIONS: ReadonlyArray<{ value: JobStatus; label: string }> = [
  { value: 'processing', label: 'Running' },
  { value: 'queued', label: 'Queued' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'stopped', label: 'Stopped' },
];

const DEFAULT_SINCE: JobsSince = '7d';
const HOUR_MS = 60 * 60 * 1000;
const SINCE_MS: Record<Exclude<JobsSince, 'all'>, number> = {
  '24h': 24 * HOUR_MS,
  '7d': 7 * 24 * HOUR_MS,
  '30d': 30 * 24 * HOUR_MS,
};
/** Enough to page through a busy month; the grid pages the rest. */
const LIST_LIMIT = 500;

const isType = (v: string | null): v is JobType => v !== null && v in JOB_TYPE_LABELS;
const isStatus = (v: string | null): v is JobStatus =>
  v !== null && STATUS_OPTIONS.some((o) => o.value === v);
const isSince = (v: string | null): v is JobsSince =>
  v !== null && SINCE_OPTIONS.some((o) => o.value === v);

export function readJobsFilters(params: URLSearchParams): JobsFilters {
  const type = params.get('type');
  const status = params.get('status');
  const since = params.get('since');
  const job = params.get('job');
  return {
    ...(isType(type) && { type }),
    ...(isStatus(status) && { status }),
    since: isSince(since) ? since : DEFAULT_SINCE,
    ...(job && { job }),
  };
}

/** Apply a patch; undefined removes a key, and the default window is left out. */
export function writeJobsFilters(
  params: URLSearchParams,
  patch: Partial<JobsFilters>
): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || (key === 'since' && value === DEFAULT_SINCE)) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  return next;
}

/** What the list endpoint is asked for. */
export function listOptions(filters: JobsFilters, now = Date.now()): JobListOptions {
  return {
    limit: LIST_LIMIT,
    ...(filters.type && { type: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.since !== 'all' && {
      afterDate: new Date(now - SINCE_MS[filters.since]).toISOString(),
    }),
  };
}
