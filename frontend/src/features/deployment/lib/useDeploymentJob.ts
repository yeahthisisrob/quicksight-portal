import { useSnackbar } from 'notistack';
import { useState, useEffect, useCallback, useRef } from 'react';

import { deployApi , type DeploymentConfig, type DeploymentResult } from '@/shared/api/modules/deploy';
import { jobsApi, type JobMetadata, type JobLog } from '@/shared/api/modules/jobs';

interface UseDeploymentJobOptions {
  pollInterval?: number;
  onSuccess?: (result: DeploymentResult) => void;
  onError?: (error: string) => void;
}

export function useDeploymentJob(options: UseDeploymentJobOptions = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const { pollInterval = 2000, onSuccess, onError } = options;
  
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobMetadata | null>(null);
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const status = await jobsApi.getJob(jobId);
      if (!status) return;
      
      setJobStatus(status);
      
      // Check if job is complete
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'stopped') {
        setIsPolling(false);
        
        // Stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        // Load final logs
        try {
          const logs = await jobsApi.getJobLogs(jobId);
          setJobLogs(logs);
        } catch (error) {
          console.error('Failed to load job logs:', error);
        }
        
        // Load deployment result if successful
        if (status.status === 'completed') {
          try {
            const result = await jobsApi.getJobResult<DeploymentResult>(jobId);
            if (result) {
              setDeploymentResult(result);
              onSuccess?.(result);
              enqueueSnackbar('Deployment completed successfully', { variant: 'success' });
            }
          } catch (error) {
            console.error('Failed to load deployment result:', error);
          }
        } else if (status.status === 'failed') {
          onError?.(status.error || 'Deployment failed');
          enqueueSnackbar(status.error || 'Deployment failed', { variant: 'error' });
        } else if (status.status === 'stopped') {
          enqueueSnackbar('Deployment was stopped', { variant: 'warning' });
        }
        
        // Save job ID to localStorage for history
        const recentJobs = JSON.parse(localStorage.getItem('recentDeploymentJobs') || '[]');
        if (!recentJobs.includes(jobId)) {
          recentJobs.unshift(jobId);
          localStorage.setItem('recentDeploymentJobs', JSON.stringify(recentJobs.slice(0, 10)));
        }
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
    }
  }, [enqueueSnackbar, onSuccess, onError]);

  // Start deployment
  const startDeployment = useCallback(async (
    assetType: string,
    assetId: string,
    config: DeploymentConfig
  ) => {
    try {
      // Clear previous state
      setJobStatus(null);
      setJobLogs([]);
      setDeploymentResult(null);
      
      // Start deployment
      enqueueSnackbar('Starting deployment...', { variant: 'info' });
      const response = await deployApi.deployAsset(assetType, assetId, config) as any;
      
      // Check if we got a job ID (async processing)
      if (response.jobId) {
        const jobId = response.jobId;
        setCurrentJobId(jobId);
        setIsPolling(true);
        
        // Store in localStorage
        localStorage.setItem('lastDeploymentJobId', jobId);
        
        // Start polling
        pollJobStatus(jobId); // Initial poll
        pollIntervalRef.current = setInterval(() => {
          pollJobStatus(jobId);
        }, pollInterval);
        
        enqueueSnackbar('Deployment job queued. Monitoring progress...', { variant: 'info' });
      } else {
        // Synchronous response (shouldn't happen with new design, but handle it)
        setDeploymentResult(response);
        onSuccess?.(response);
        enqueueSnackbar('Deployment completed successfully', { variant: 'success' });
      }
    } catch (_error: any) {
      const message = _error.message || 'Failed to start deployment';
      onError?.(message);
      enqueueSnackbar(message, { variant: 'error' });
      throw _error;
    }
  }, [enqueueSnackbar, pollJobStatus, pollInterval, onSuccess, onError]);

  // Stop deployment
  const stopDeployment = useCallback(async () => {
    if (!currentJobId) return;
    
    try {
      await jobsApi.stopJob(currentJobId);
      enqueueSnackbar('Stop request sent', { variant: 'warning' });
    } catch (_error) {
      enqueueSnackbar('Failed to stop deployment', { variant: 'error' });
    }
  }, [currentJobId, enqueueSnackbar]);

  // Load job status by ID
  const loadJob = useCallback(async (jobId: string) => {
    try {
      setCurrentJobId(jobId);
      
      const status = await jobsApi.getJob(jobId);
      if (status) {
        setJobStatus(status);
        
        // Load logs
        try {
          const logs = await jobsApi.getJobLogs(jobId);
          setJobLogs(logs);
        } catch (error) {
          console.error('Failed to load job logs:', error);
        }
        
        // Load result if completed
        if (status.status === 'completed') {
          try {
            const result = await jobsApi.getJobResult<DeploymentResult>(jobId);
            if (result) {
              setDeploymentResult(result);
            }
          } catch (error) {
            console.error('Failed to load deployment result:', error);
          }
        }
        
        // Start polling if still running
        if (status.status === 'processing' || status.status === 'queued') {
          setIsPolling(true);
          pollIntervalRef.current = setInterval(() => {
            pollJobStatus(jobId);
          }, pollInterval);
        }
      }
    } catch (error) {
      console.error('Failed to load job:', error);
    }
  }, [pollJobStatus, pollInterval]);

  // Load deployment history
  const loadHistory = useCallback(async (limit: number = 10) => {
    try {
      const jobs = await jobsApi.listJobs({
        type: 'deploy',
        limit,
      });
      return jobs;
    } catch (error) {
      console.error('Failed to load deployment history:', error);
      return [];
    }
  }, []);

  // Refresh current job status
  const refreshStatus = useCallback(async () => {
    if (!currentJobId) return;
    await pollJobStatus(currentJobId);
  }, [currentJobId, pollJobStatus]);

  return {
    // State
    currentJobId,
    jobStatus,
    jobLogs,
    deploymentResult,
    isPolling,
    
    // Actions
    startDeployment,
    stopDeployment,
    loadJob,
    loadHistory,
    refreshStatus,
  };
}