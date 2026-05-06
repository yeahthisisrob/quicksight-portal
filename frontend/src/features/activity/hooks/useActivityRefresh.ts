import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useCallback, useState } from 'react';

import { activityApi } from '@/shared/api/modules/activity';
import { type JobMetadata } from '@/shared/api/modules/jobs';
import { useJobPolling, type PollIntervalFn } from '@/shared/hooks/useJobPolling';

import { ActivityRefreshOptions } from '../model/types';

/**
 * Smart polling backoff. Tight cadence early so the stepper animates lively,
 * then ease off as the refresh runs longer to keep load down on long jobs.
 */
const activityRefreshPollInterval: PollIntervalFn = (elapsedMs) => {
  if (elapsedMs < 10_000) return 1000;
  if (elapsedMs < 60_000) return 2000;
  return 5000;
};

const totalRefreshedCount = (job: JobMetadata): number => {
  const refreshed = (job.stats as any)?.refreshed;
  if (!refreshed) return 0;
  return (refreshed.dashboards || 0) + (refreshed.analyses || 0) + (refreshed.users || 0);
};

export function useActivityRefresh() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const onComplete = useCallback(
    (job: JobMetadata) => {
      setRefreshing(false);
      setLastRefreshed(new Date());
      enqueueSnackbar(
        `Successfully refreshed activity data for ${totalRefreshedCount(job)} items`,
        { variant: 'success' }
      );
      // Auto-refetch the timeline + per-asset activity views. refetchType:
      // 'active' is required — without it, mounted-but-fresh queries (default
      // staleTime 60s) don't re-fire after the cache update.
      void queryClient.invalidateQueries({
        queryKey: ['activity-timeline'],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({ queryKey: ['activity'], refetchType: 'active' });
    },
    [enqueueSnackbar, queryClient]
  );

  const onFailed = useCallback(
    (job: JobMetadata) => {
      setRefreshing(false);
      if (job.status === 'stopped') {
        enqueueSnackbar('Activity refresh was stopped', { variant: 'warning' });
      } else {
        enqueueSnackbar(job.error || job.message || 'Activity refresh failed', {
          variant: 'error',
        });
      }
    },
    [enqueueSnackbar]
  );

  const { jobId, jobStatus, isPolling, startPolling, reset } = useJobPolling({
    pollInterval: activityRefreshPollInterval,
    onComplete,
    onFailed,
  });

  const refreshActivity = useCallback(
    async (options: ActivityRefreshOptions) => {
      setRefreshing(true);
      reset();
      const assetTypeNames = options.assetTypes.includes('all')
        ? 'all assets'
        : options.assetTypes.join(', ');
      enqueueSnackbar(`Starting activity refresh for ${assetTypeNames}...`, {
        variant: 'info',
        autoHideDuration: 3000,
      });
      try {
        const result = await activityApi.refreshActivity(options);
        startPolling(result.jobId);
        return result;
      } catch (error: any) {
        setRefreshing(false);
        enqueueSnackbar(error.message || 'Failed to start activity refresh', { variant: 'error' });
        throw error;
      }
    },
    [enqueueSnackbar, reset, startPolling]
  );

  return {
    refreshing: refreshing || isPolling,
    lastRefreshed,
    refreshActivity,
    currentJobId: jobId,
    jobStatus,
  };
}
