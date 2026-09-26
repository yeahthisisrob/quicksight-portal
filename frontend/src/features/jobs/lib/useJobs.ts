/**
 * The jobs list and one job, polled: every few seconds while anything is
 * running, rarely when nothing is, so an open tab stays current without
 * hammering the table.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { isActive } from '@/entities/job';

import { type JobMetadata, jobsApi } from '@/shared/api/modules/jobs';

import { type JobsFilters, listOptions } from '../model/jobsFilters';

const ACTIVE_POLL_MS = 5_000;
const IDLE_POLL_MS = 60_000;

export function useJobsList(filters: JobsFilters) {
  const { type, status, since } = filters;
  return useQuery({
    queryKey: ['jobs', 'list', type ?? 'all', status ?? 'all', since],
    queryFn: () => jobsApi.listJobs(listOptions({ type, status, since })),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((job: JobMetadata) => isActive(job.status))
        ? ACTIVE_POLL_MS
        : IDLE_POLL_MS,
  });
}

export function useJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ['jobs', 'one', jobId],
    queryFn: () => jobsApi.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (isActive(query.state.data?.status) ? ACTIVE_POLL_MS : false),
  });
}
