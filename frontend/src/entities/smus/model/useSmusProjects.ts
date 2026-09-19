import { useQuery } from '@tanstack/react-query';

import { type SmusProjectsResponse, settingsApi } from '@/shared/api/modules/settings';

const PROJECTS_STALE_MS = 5 * 60 * 1000;

export const SMUS_PROJECTS_QUERY_KEY = ['settings', 'smus', 'projects'] as const;

/** The projects the portal can reach in the configured SMUS domain. */
export function useSmusProjects() {
  return useQuery<SmusProjectsResponse>({
    queryKey: SMUS_PROJECTS_QUERY_KEY,
    queryFn: () => settingsApi.listSmusProjects(),
    staleTime: PROJECTS_STALE_MS,
  });
}
