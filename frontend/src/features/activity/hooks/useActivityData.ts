import { useQuery } from '@tanstack/react-query';

import { activityApi } from '@/shared/api/modules/activity';

import { ActivityData, UserActivity } from '../model/types';

export function useActivityData(
  assetType: 'dashboard' | 'analysis' | 'user',
  assetId: string,
  enabled: boolean = true
) {
  return useQuery<ActivityData | UserActivity>({
    queryKey: ['activity', assetType, assetId],
    queryFn: () => activityApi.getActivityData(assetType, assetId),
    enabled: enabled && !!assetId,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

export function useDashboardActivity(dashboardId: string, enabled: boolean = true) {
  return useActivityData('dashboard', dashboardId, enabled) as ReturnType<typeof useQuery<ActivityData>>;
}

export function useAnalysisActivity(analysisId: string, enabled: boolean = true) {
  return useActivityData('analysis', analysisId, enabled) as ReturnType<typeof useQuery<ActivityData>>;
}

export function useUserActivity(userName: string, enabled: boolean = true) {
  return useActivityData('user', userName, enabled) as ReturnType<typeof useQuery<UserActivity>>;
}