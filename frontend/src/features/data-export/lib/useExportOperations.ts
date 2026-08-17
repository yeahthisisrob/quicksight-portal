/**
 * Hook for export-related operations
 */
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

import { activityApi } from '@/shared/api';

export function useExportOperations() {
  const { enqueueSnackbar } = useSnackbar();

  const [refreshingActivity, setRefreshingActivity] = useState(false);

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
  
  return {
    refreshingActivity,
    refreshActivity,
  };
}