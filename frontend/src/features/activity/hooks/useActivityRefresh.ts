import { useSnackbar } from 'notistack';
import { useState, useCallback, useRef, useEffect } from 'react';

import { activityApi } from '@/shared/api/modules/activity';
import { jobsApi, type JobMetadata } from '@/shared/api/modules/jobs';

import { ActivityRefreshOptions } from '../model/types';

export function useActivityRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobMetadata | null>(null);
  const { enqueueSnackbar } = useSnackbar();
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
        setRefreshing(false);
        
        // Stop polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        if (status.status === 'completed') {
          // Extract refresh counts from the job stats
          // The backend stores these in stats.refreshed
          const refreshedData = (status.stats as any)?.refreshed || {};
          const refreshed = {
            dashboards: refreshedData.dashboards || 0,
            analyses: refreshedData.analyses || 0,
            users: refreshedData.users || 0
          };
          
          const totalRefreshed = refreshed.dashboards + refreshed.analyses + refreshed.users;
          
          enqueueSnackbar(
            `Successfully refreshed activity data for ${totalRefreshed} items`,
            { variant: 'success' }
          );
          
          setLastRefreshed(new Date());
        } else if (status.status === 'failed') {
          enqueueSnackbar(
            status.error || 'Activity refresh failed',
            { variant: 'error' }
          );
        } else if (status.status === 'stopped') {
          enqueueSnackbar('Activity refresh was stopped', { variant: 'warning' });
        }
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
    }
  }, [enqueueSnackbar]);

  const refreshActivity = useCallback(async (options: ActivityRefreshOptions) => {
    setRefreshing(true);
    setJobStatus(null);
    
    try {
      const assetTypeNames = options.assetTypes.includes('all') 
        ? 'all assets' 
        : options.assetTypes.join(', ');
      
      enqueueSnackbar(
        `Starting activity refresh for ${assetTypeNames}...`,
        { variant: 'info', autoHideDuration: 3000 }
      );
      
      // Start the refresh job
      const result = await activityApi.refreshActivity(options);
      
      setCurrentJobId(result.jobId);
      
      // Start polling for job status
      pollIntervalRef.current = setInterval(() => {
        pollJobStatus(result.jobId);
      }, 2000); // Poll every 2 seconds
      
      // Initial poll
      pollJobStatus(result.jobId);
      
      return result;
    } catch (error: any) {
      setRefreshing(false);
      enqueueSnackbar(
        error.message || 'Failed to start activity refresh',
        { variant: 'error' }
      );
      throw error;
    }
  }, [enqueueSnackbar, pollJobStatus]);

  return {
    refreshing,
    lastRefreshed,
    refreshActivity,
    currentJobId,
    jobStatus
  };
}