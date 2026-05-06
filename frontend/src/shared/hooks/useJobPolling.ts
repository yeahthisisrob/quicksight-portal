import { useState, useEffect, useCallback, useRef } from 'react';

import { jobsApi, type JobMetadata } from '@/shared/api/modules/jobs';

/**
 * Polling interval. Pass a number for a fixed cadence, or a function that
 * returns the next delay in ms given elapsed time since polling started —
 * useful for tighter cadence at the start of a job and looser later.
 */
export type PollIntervalFn = (elapsedMs: number) => number;
export type PollInterval = number | PollIntervalFn;

interface UseJobPollingOptions {
  /** Default 2000ms. Pass a function for dynamic backoff. */
  pollInterval?: PollInterval;
  onComplete?: (job: JobMetadata) => void;
  onFailed?: (job: JobMetadata) => void;
  onProgress?: (job: JobMetadata) => void;
}

const resolveInterval = (pi: PollInterval, elapsedMs: number): number =>
  typeof pi === 'function' ? Math.max(0, pi(elapsedMs)) : pi;

export function useJobPolling(options: UseJobPollingOptions = {}) {
  const { pollInterval = 2000, onComplete, onFailed, onProgress } = options;

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobMetadata | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Refs avoid re-running effects when these change.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number>(0);
  const activeIdRef = useRef<string | null>(null);
  const intervalRef = useRef<PollInterval>(pollInterval);
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    intervalRef.current = pollInterval;
  }, [pollInterval]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFailedRef.current = onFailed;
    onProgressRef.current = onProgress;
  }, [onComplete, onFailed, onProgress]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    clearTimer();
    activeIdRef.current = null;
    setIsPolling(false);
  }, [clearTimer]);

  const pollOnce = useCallback(
    async (id: string): Promise<JobMetadata | null> => {
      try {
        const job = await jobsApi.getJob(id);
        if (!job) return null;
        setJobStatus(job);
        onProgressRef.current?.(job);
        if (job.status === 'completed') {
          stopPolling();
          onCompleteRef.current?.(job);
        } else if (job.status === 'failed' || job.status === 'stopped') {
          stopPolling();
          onFailedRef.current?.(job);
        }
        return job;
      } catch (error) {
        // Transient network errors shouldn't kill the poll loop. Log + continue.
        console.error('Failed to poll job status:', error);
        return null;
      }
    },
    [stopPolling]
  );

  const schedule = useCallback(
    (id: string): void => {
      const delay = resolveInterval(intervalRef.current, Date.now() - startedAtRef.current);
      timeoutRef.current = setTimeout(async () => {
        if (activeIdRef.current !== id) return;
        await pollOnce(id);
        if (activeIdRef.current === id) {
          schedule(id);
        }
      }, delay);
    },
    [pollOnce]
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      activeIdRef.current = id;
      startedAtRef.current = Date.now();
      setJobId(id);
      setIsPolling(true);
      // Initial poll immediately, then schedule by interval.
      void pollOnce(id).then(() => {
        if (activeIdRef.current === id) {
          schedule(id);
        }
      });
    },
    [stopPolling, pollOnce, schedule]
  );

  // When the tab regains focus, force an immediate poll so the UI doesn't
  // appear frozen with stale state. Only fires while a job is in flight.
  useEffect(() => {
    const handler = (): void => {
      const id = activeIdRef.current;
      if (!id || document.visibilityState !== 'visible') return;
      clearTimer();
      void pollOnce(id).then(() => {
        if (activeIdRef.current === id) {
          schedule(id);
        }
      });
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [pollOnce, schedule, clearTimer]);

  // Clean up timer on unmount.
  useEffect(() => () => clearTimer(), [clearTimer]);

  const reset = useCallback(() => {
    stopPolling();
    setJobId(null);
    setJobStatus(null);
  }, [stopPolling]);

  return {
    jobId,
    jobStatus,
    isPolling,
    startPolling,
    stopPolling,
    reset,
  };
}
