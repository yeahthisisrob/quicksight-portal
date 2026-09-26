/**
 * useSmusExport - start the SMUS export job and follow it to the end.
 *
 * The export sweeps the DataZone domain once and writes the snapshot every
 * SMUS-backed page reads, so when it finishes every one of those queries is
 * invalidated: settings (the project picker), the Author asset picker, the
 * catalog and the status card itself.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

import type { JobMetadata } from '@/shared/api/modules/jobs';
import { smusApi } from '@/shared/api/modules/smus';
import { type PollIntervalFn, useJobPolling } from '@/shared/hooks/useJobPolling';

const EARLY_MS = 10_000;
const MID_MS = 60_000;
const EARLY_INTERVAL_MS = 1_000;
const MID_INTERVAL_MS = 2_000;
const LATE_INTERVAL_MS = 5_000;

/** Lively while the sweep is young, then eased off for a long domain. */
const smusExportPollInterval: PollIntervalFn = (elapsedMs) => {
  if (elapsedMs < EARLY_MS) return EARLY_INTERVAL_MS;
  if (elapsedMs < MID_MS) return MID_INTERVAL_MS;
  return LATE_INTERVAL_MS;
};

/** Every query that reads the SMUS snapshot. */
const SMUS_SNAPSHOT_QUERY_KEYS: readonly (readonly string[])[] = [
  ['settings'],
  ['settings-options'],
  ['smus-assets'],
  ['smus'],
  ['smus-status'],
  ['data-catalog', 'smus'],
];

interface SmusExport {
  /** Queue the job (or attach to the one already running). */
  start: () => Promise<void>;
  /** Queued or processing. */
  running: boolean;
  jobId: string | null;
  job: JobMetadata | null;
  /** Why the last start failed, if it did. */
  startError: string | null;
}

export function useSmusExport(): SmusExport {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const invalidate = useCallback(() => {
    for (const queryKey of SMUS_SNAPSHOT_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
    }
  }, [queryClient]);

  const onComplete = useCallback(
    (job: JobMetadata) => {
      setStarting(false);
      enqueueSnackbar(job.message || 'SMUS export completed', { variant: 'success' });
      invalidate();
    },
    [enqueueSnackbar, invalidate]
  );

  const onFailed = useCallback(
    (job: JobMetadata) => {
      setStarting(false);
      enqueueSnackbar(
        job.status === 'stopped'
          ? 'SMUS export was stopped'
          : job.error || job.message || 'SMUS export failed',
        { variant: job.status === 'stopped' ? 'warning' : 'error' }
      );
      // A partial snapshot may still have been written.
      invalidate();
    },
    [enqueueSnackbar, invalidate]
  );

  const { jobId, jobStatus, isPolling, startPolling, reset } = useJobPolling({
    pollInterval: smusExportPollInterval,
    onComplete,
    onFailed,
  });

  const start = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    reset();
    try {
      const queued = await smusApi.startExport();
      startPolling(queued.jobId);
    } catch (error) {
      setStarting(false);
      setStartError(error instanceof Error ? error.message : 'Failed to start the SMUS export');
    }
  }, [reset, startPolling]);

  return {
    start,
    running: starting || isPolling,
    jobId,
    job: jobStatus,
    startError,
  };
}
