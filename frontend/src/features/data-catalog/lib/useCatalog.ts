/**
 * Data access for the catalog page: URL state plus the queries the page
 * makes (the projects, a project's assets, one asset, and dataset ids for a
 * tag filter). Query keys start with 'data-catalog' so the field metadata
 * editor's invalidation after a save refreshes the open asset.
 */
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { assetsApi, dataCatalogApi, smusCatalogApi } from '@/shared/api';
import type { SmusCatalog, SmusCatalogAsset } from '@/shared/api/modules/data-catalog';

import { type CatalogUrlState, readCatalogState, writeCatalogState } from '../model/catalogState';

export type TagFilter = { key: string; value: string };

const TAGGED_DATASETS_PAGE = 500;
const LIST_STALE_MS = 30_000;
const PROJECTS_STALE_MS = 60_000;

export function useCatalogUrlState(): [CatalogUrlState, (patch: Partial<CatalogUrlState>) => void] {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readCatalogState(params), [params]);
  const update = useCallback(
    (patch: Partial<CatalogUrlState>) => {
      setParams((current) => writeCatalogState(current, patch), { replace: true });
    },
    [setParams]
  );
  return [state, update];
}

/** The unscoped list: only to learn the projects and whether SMUS is configured. */
export function useCatalogProjects() {
  return useQuery<SmusCatalog>({
    queryKey: ['data-catalog', 'smus', 'projects'],
    // Projects only: the snapshot answers this without the QuickSight field
    // index, so the page opens before the heavier per-project list arrives.
    queryFn: () => smusCatalogApi.list({ scope: 'projects' }),
    staleTime: PROJECTS_STALE_MS,
  });
}

export function useCatalogList(params: { projectId?: string; search?: string; term?: string }) {
  return useQuery<SmusCatalog>({
    queryKey: ['data-catalog', 'smus', 'list', params],
    queryFn: () =>
      smusCatalogApi.list({
        projectId: params.projectId,
        search: params.search || undefined,
        term: params.term,
      }),
    enabled: Boolean(params.projectId),
    staleTime: LIST_STALE_MS,
  });
}

export function useCatalogAsset(listingId?: string) {
  return useQuery<SmusCatalogAsset>({
    queryKey: ['data-catalog', 'smus', 'asset', listingId],
    queryFn: () => smusCatalogApi.get(listingId as string),
    enabled: Boolean(listingId),
    staleTime: LIST_STALE_MS,
  });
}

export function useAvailableDatasetTags() {
  return useQuery({
    queryKey: ['data-catalog', 'tags'],
    queryFn: () => dataCatalogApi.getAvailableTags(),
    staleTime: PROJECTS_STALE_MS,
  });
}

/**
 * Dataset ids carrying every chosen tag, for narrowing the asset list.
 * Resolves to null when no tags are chosen, meaning "do not filter".
 */
export function useTaggedDatasetIds(tags: TagFilter[]) {
  return useQuery<Set<string> | null>({
    queryKey: ['data-catalog', 'tagged-datasets', tags],
    queryFn: async () => {
      if (tags.length === 0) return null;
      const result = await assetsApi.getDatasetsPaginated({
        page: 1,
        pageSize: TAGGED_DATASETS_PAGE,
        filters: { includeTags: tags },
      });
      return new Set(result.datasets.map((d) => d.id));
    },
    staleTime: LIST_STALE_MS,
  });
}
