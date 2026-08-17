import { useQuery } from '@tanstack/react-query';

import { smusApi, type SmusDatasetLink } from '@/shared/api/modules/smus';

/**
 * SMUS integration status. Config changes require a backend redeploy, so a
 * long stale time is safe — the answer only flips when config flips.
 */
export function useSmusStatus() {
  return useQuery({
    queryKey: ['smus', 'status'],
    queryFn: () => smusApi.getStatus(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * SMUS catalog link resolutions for the given datasets (typically the current
 * table page), keyed by dataset id. Backend resolves against the live catalog
 * with its own short TTL, so a modest client stale time keeps pages snappy
 * without going stale.
 */
export function useSmusDatasetLinks(datasetIds: string[], enabled: boolean = true) {
  return useQuery<Map<string, SmusDatasetLink>>({
    queryKey: ['smus', 'dataset-links', [...datasetIds].sort()],
    queryFn: async () => {
      const links = await smusApi.getDatasetLinks(datasetIds);
      return new Map(links.map((link) => [link.datasetId, link]));
    },
    enabled: enabled && datasetIds.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
