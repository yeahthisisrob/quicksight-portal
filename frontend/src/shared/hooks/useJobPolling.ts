import { useState, useEffect, useCallback, useRef } from 'react';

import { jobsApi, type JobMetadata } from '@/shared/api/modules/jobs';

interface UseJobPollingOptions {
  pollInterval?: number;
  onComplete?: (job: JobMetadata) => void;
  onFailed?: (job: JobMetadata) => void;
  onProgress?: (job: JobMetadata) => void;
}

export function useJobPolling(options: UseJobPollingOptions = {}) {
  const {
    pollInterval = 2000,
    onComplete,
    onFailed,
    onProgress,
  } = options;

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobMetadata | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Store callbacks in refs to avoid recreating functions
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  const onProgressRef = useRef(onProgress);
  
  // Update refs when callbacks change
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFailedRef.current = onFailed;
    onProgressRef.current = onProgress;
  }, [onComplete, onFailed, onProgress]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollJob = useCallback(async (id: string) => {
    try {
      const job = await jobsApi.getJob(id);
      if (!job) return;

      setJobStatus(job);
      onProgressRef.current?.(job);

      // Check if job is complete
      if (job.status === 'completed') {
        stopPolling();
        onCompleteRef.current?.(job);
      } else if (job.status === 'failed' || job.status === 'stopped') {
        stopPolling();
        onFailedRef.current?.(job);
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
      // Don't stop polling on error - might be temporary network issue
    }
  }, [stopPolling]);

  const startPolling = useCallback((id: string) => {
    // Stop any existing polling
    stopPolling();
    
    setJobId(id);
    setIsPolling(true);

    // Do an initial poll immediately
    pollJob(id);

    // Set up interval for subsequent polls
    intervalRef.current = setInterval(() => {
      pollJob(id);
    }, pollInterval);
  }, [stopPolling, pollJob, pollInterval]);

  // Remove auto-start effect to prevent loops
  const reset = useCallback(() => {
    stopPolling();
    setJobId(null);
    setJobStatus(null);
  }, [stopPolling]);

  return {
    // State
    jobId,
    jobStatus,
    isPolling,
    
    // Actions
    startPolling,
    stopPolling,
    reset,
  };
}