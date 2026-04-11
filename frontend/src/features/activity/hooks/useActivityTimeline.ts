import { useInfiniteQuery } from '@tanstack/react-query';

import {
  activityApi,
  type TimelinePage,
  type TimelineQueryParams,
} from '@/shared/api/modules/activity';

/** Catalog asset types for the per-asset timeline drill-down. */
export type TimelineAssetType =
  | 'dashboard'
  | 'analysis'
  | 'dataset'
  | 'datasource'
  | 'folder'
  | 'group'
  | 'user';

/** Filter state for the timeline feed — serializable so it can drive the query key. */
export interface TimelineFilters {
  resourceTypes?: string[];
  users?: string[];
  eventNames?: string[];
  excludeEventNames?: string[];
  actions?: string[];
  startDate?: string;
  endDate?: string;
}

/** Pin the feed to a single catalog asset (per-asset drill-down). */
export interface TimelineAssetPin {
  assetType: TimelineAssetType;
  assetId: string;
}

export interface UseActivityTimelineOptions {
  filters?: TimelineFilters;
  assetPin?: TimelineAssetPin;
  pageSize?: number;
  /** Defaults to true. Set false to defer fetching until the user opens the tab. */
  enabled?: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

/**
 * Infinite timeline feed. Uses TanStack Query's `useInfiniteQuery` — the
 * backend returns a cursor (`nextCursor` = ISO timestamp of the last item in
 * the current page), which we pass back on the next fetch as `cursor` to get
 * older events. When the backend returns `nextCursor: null` the feed is done.
 *
 * Query key includes filters + assetPin so changing any of them triggers a
 * fresh infinite query (old pages are discarded).
 */
export function useActivityTimeline({
  filters,
  assetPin,
  pageSize = DEFAULT_PAGE_SIZE,
  enabled = true,
}: UseActivityTimelineOptions = {}) {
  return useInfiniteQuery<TimelinePage, Error>({
    queryKey: ['activity-timeline', assetPin, filters, pageSize],
    queryFn: async ({ pageParam }) => {
      const query: TimelineQueryParams = {
        ...filters,
        limit: pageSize,
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
      };
      if (assetPin) {
        return activityApi.getAssetTimeline(assetPin.assetType, assetPin.assetId, query);
      }
      return activityApi.getTimeline(query);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
    // Timeline data is derived from CloudTrail which has a 5–15 min propagation
    // lag — treating it as stale for 60s keeps scrolling snappy while a manual
    // refresh (via /activity/refresh) still works.
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
