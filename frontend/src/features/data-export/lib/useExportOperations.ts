/**
 * Hook for export-related operations
 */
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

import { activityApi, exportApi, jobsApi } from '@/shared/api';

export function useExportOperations(onCacheSummaryUpdate: () => void) {
  const { enqueueSnackbar } = useSnackbar();
  
  const [refreshingActivity, setRefreshingActivity] = useState(false);
  const [exportingIngestions, setExportingIngestions] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [clearingStuckJobs, setClearingStuckJobs] = useState(false);
  
  const refreshActivity = useCallback(async () => {
    if (refreshingActivity) return;
    
    try {
      setRefreshingActivity(true);
      enqueueSnackbar('Refreshing activity data...', { variant: 'info' });
      await activityApi.refreshActivity({ assetTypes: ['all'] });
      enqueueSnackbar('Activity data refreshed', { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to refresh activity:', error);
      enqueueSnackbar(error.message || 'Failed to refresh activity', { variant: 'error' });
    } finally {
      setRefreshingActivity(false);
    }
  }, [refreshingActivity, enqueueSnackbar]);
  
  const exportIngestions = useCallback(async () => {
    if (exportingIngestions) return;
    
    try {
      setExportingIngestions(true);
      enqueueSnackbar('Starting ingestion export...', { variant: 'info' });
      
      await exportApi.warmUp();
      const result = await exportApi.startExportJob({ exportIngestions: true });
      
      if (result?.jobId) {
        enqueueSnackbar(`Ingestion export started: ${result.jobId}`, { variant: 'success' });
        localStorage.setItem('lastExportJobId', result.jobId);
      }
    } catch (error: any) {
      console.error('Failed to export ingestions:', error);
      enqueueSnackbar(error.message || 'Failed to export ingestions', { variant: 'error' });
    } finally {
      setExportingIngestions(false);
    }
  }, [exportingIngestions, enqueueSnackbar]);
  
  const clearCache = useCallback(async () => {
    if (clearingCache) return;
    
    if (!window.confirm('Are you sure you want to clear the cache? This will delete all cached data.')) {
      return;
    }
    
    try {
      setClearingCache(true);
      enqueueSnackbar('Clearing cache...', { variant: 'info' });
      await exportApi.clearMemoryCache();
      enqueueSnackbar('Cache cleared successfully', { variant: 'success' });
      onCacheSummaryUpdate();
    } catch (error: any) {
      console.error('Failed to clear cache:', error);
      enqueueSnackbar(error.message || 'Failed to clear cache', { variant: 'error' });
    } finally {
      setClearingCache(false);
    }
  }, [clearingCache, enqueueSnackbar, onCacheSummaryUpdate]);
  
  const clearStuckJobs = useCallback(async () => {
    if (clearingStuckJobs) return;
    
    try {
      setClearingStuckJobs(true);
      enqueueSnackbar('Clearing stuck jobs...', { variant: 'info' });
      const result = await jobsApi.cleanupJobs();
      
      if (result?.failedStuckCount > 0) {
        enqueueSnackbar(`Cleared ${result.failedStuckCount} stuck job(s)`, { variant: 'success' });
      } else {
        enqueueSnackbar('No stuck jobs found', { variant: 'info' });
      }
    } catch (error: any) {
      console.error('Failed to clear stuck jobs:', error);
      enqueueSnackbar(error.message || 'Failed to clear stuck jobs', { variant: 'error' });
    } finally {
      setClearingStuckJobs(false);
    }
  }, [clearingStuckJobs, enqueueSnackbar]);
  
  return {
    refreshingActivity,
    exportingIngestions,
    clearingCache,
    clearingStuckJobs,
    refreshActivity,
    exportIngestions,
    clearCache,
    clearStuckJobs,
  };
}