/**
 * Hook for export-related operations
 */
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

import { activityApi, exportApi } from '@/shared/api';

export function useExportOperations() {
  const { enqueueSnackbar } = useSnackbar();
  
  const [refreshingActivity, setRefreshingActivity] = useState(false);
  const [exportingIngestions, setExportingIngestions] = useState(false);
  
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
  
  return {
    refreshingActivity,
    exportingIngestions,
    refreshActivity,
    exportIngestions,
  };
}