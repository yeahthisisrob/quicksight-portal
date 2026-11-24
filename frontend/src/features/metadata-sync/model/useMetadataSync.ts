/**
 * useMetadataSync - the metadata sync's status, a preview or a run followed
 * to the end, and a conflict settled.
 *
 * A pass writes its report where the status reads it, so the status is
 * fetched again when a job ends, however it ends: a failed run may still
 * have written to some tables.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

import { getApiErrorMessage } from '@/shared/api';
import type { JobMetadata } from '@/shared/api/modules/jobs';
import {
  type MetadataSyncMode,
  type MetadataSyncResolveRequest,
  metadataSyncApi,
} from '@/shared/api/modules/metadataSync';
import { type PollIntervalFn, useJobPolling } from '@/shared/hooks/useJobPolling';

const STATUS_KEY = ['metadata-sync', 'status'] as const;
const EARLY_MS = 10_000;
const EARLY_INTERVAL_MS = 1_000;
const LATE_INTERVAL_MS = 3_000;

const pollInterval: PollIntervalFn = (elapsedMs) =>
  elapsedMs < EARLY_MS ? EARLY_INTERVAL_MS : LATE_INTERVAL_MS;

export function useMetadataSync() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [starting, setStarting] = useState<MetadataSyncMode | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => metadataSyncApi.getStatus(),
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
    [queryClient]
  );

  const onComplete = useCallback(
    (job: JobMetadata) => {
      setStarting(null);
      enqueueSnackbar(job.message || 'Metadata sync completed', { variant: 'success' });
      void refresh();
    },
    [enqueueSnackbar, refresh]
  );

  const onFailed = useCallback(
    (job: JobMetadata) => {
      setStarting(null);
      enqueueSnackbar(job.error || job.message || 'Metadata sync failed', { variant: 'error' });
      void refresh();
    },
    [enqueueSnackbar, refresh]
  );

  const { jobStatus, isPolling, startPolling, reset } = useJobPolling({
    pollInterval,
    onComplete,
    onFailed,
  });

  const start = useCallback(
    async (mode: MetadataSyncMode) => {
      setStarting(mode);
      setStartError(null);
      reset();
      try {
        const queued = await metadataSyncApi.start(mode);
        startPolling(queued.jobId);
      } catch (error) {
        setStarting(null);
        setStartError(getApiErrorMessage(error, 'Failed to start the metadata sync'));
      }
    },
    [reset, startPolling]
  );

  const resolve = useMutation({
    mutationFn: (pick: MetadataSyncResolveRequest) => metadataSyncApi.resolve(pick),
    onError: (error) =>
      enqueueSnackbar(getApiErrorMessage(error, 'Failed to settle the conflict'), {
        variant: 'error',
      }),
  });

  return {
    status,
    start,
    /** Queued or processing. */
    running: starting !== null || isPolling,
    job: jobStatus,
    startError,
    resolve,
  };
}
