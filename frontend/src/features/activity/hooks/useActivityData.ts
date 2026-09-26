import { useQuery } from '@tanstack/react-query';

import { activityApi, type DatasetActivityData } from '@/shared/api/modules/activity';

const ACTIVITY_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
} as const;

/**
 * Activity for a dataset: refresh (ingestion) history plus aggregated
 * view/update activity of the dashboards and analyses that use it.
 */
export function useDatasetActivity(datasetId: string, enabled: boolean = true) {
  return useQuery<DatasetActivityData>({
    queryKey: ['activity', 'dataset', datasetId],
    queryFn: () => activityApi.getDatasetActivity(datasetId),
    enabled: enabled && !!datasetId,
    ...ACTIVITY_QUERY_OPTIONS,
  });
}
