import { Alert, Box, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';


import { TimelineFilterBar, type TimelineDateRange } from './TimelineFilterBar';
import { TimelineRow } from './TimelineRow';
import {
  useActivityTimeline,
  type TimelineAssetPin,
  type TimelineFilters,
} from '../hooks/useActivityTimeline';

const PAGE_SIZE = 50;
const SENTINEL_ROOT_MARGIN = '400px'; // pre-fetch the next page 400px before it comes into view

/**
 * Noisy events hidden by default. Ingestions fire on every scheduled refresh
 * which can easily drown out the events users actually care about. Toggled
 * via the "Show ingestions" switch in the filter bar.
 */
const DEFAULT_EXCLUDED_EVENTS = ['CreateIngestion', 'CancelIngestion'];

export interface TimelineFeedProps {
  /** Pin the feed to a single catalog asset. When omitted, shows the global feed. */
  assetPin?: TimelineAssetPin;
  /**
   * Optional header rendered above the filter bar. Gets the cache-last-updated
   * timestamp from the first loaded page so callers can render a "last
   * refreshed X ago" hint without a second request.
   */
  renderHeader?: (ctx: { cacheLastUpdated: string | undefined }) => React.ReactNode;
}

/**
 * Main timeline feed component. Renders the filter bar, the scrollable list,
 * and an intersection-observed sentinel at the bottom that drives infinite
 * scroll via fetchNextPage().
 */
export function TimelineFeed({ assetPin, renderHeader }: TimelineFeedProps) {
  const [filters, setFilters] = useState<TimelineFilters>({
    startDate: dateRangeToStartDate('30d'),
    excludeEventNames: DEFAULT_EXCLUDED_EVENTS,
  });
  const [dateRange, setDateRange] = useState<TimelineDateRange>('30d');
  const [showIngestions, setShowIngestions] = useState(false);

  // Keep filters.excludeEventNames in sync with the toggle.
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      excludeEventNames: showIngestions ? undefined : DEFAULT_EXCLUDED_EVENTS,
    }));
  }, [showIngestions]);

  const query = useActivityTimeline({ filters, assetPin, pageSize: PAGE_SIZE });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data]
  );

  // The first page carries the cache's lastUpdated; all pages return the
  // same value so we can read it off pages[0] safely.
  const cacheLastUpdated = query.data?.pages[0]?.cacheLastUpdated;

  // Intersection observer on the bottom sentinel — fetch next page when visible.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!query.hasNextPage || query.isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          query.fetchNextPage();
        }
      },
      { rootMargin: SENTINEL_ROOT_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, query]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {renderHeader?.({ cacheLastUpdated })}
      <TimelineFilterBar
        filters={filters}
        onChange={setFilters}
        hideResourceTypes={Boolean(assetPin)}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showIngestions={showIngestions}
        onShowIngestionsChange={setShowIngestions}
      />

      {query.isError && (
        <Alert severity="error" sx={{ m: 2 }}>
          Failed to load activity timeline: {query.error?.message ?? 'unknown error'}
        </Alert>
      )}

      {query.isLoading && (
        <Stack spacing={1} sx={{ p: 2 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      )}

      {!query.isLoading && items.length === 0 && !query.isError && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No activity events in this window. Try widening the date range or
            running an activity refresh.
          </Typography>
        </Box>
      )}

      {items.length > 0 && (
        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {items.map((event) => (
            <TimelineRow key={event.id} event={event} />
          ))}
          <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            {query.isFetchingNextPage && <CircularProgress size={24} />}
            {!query.hasNextPage && items.length > PAGE_SIZE && (
              <Typography variant="caption" color="text.secondary">
                End of timeline
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** Local copy — TimelineFilterBar owns the canonical version for its own usage. */
function dateRangeToStartDate(range: TimelineDateRange): string | undefined {
  const now = new Date();
  const MS_PER_DAY = 86_400_000;
  switch (range) {
    case '24h':
      return new Date(now.getTime() - MS_PER_DAY).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * MS_PER_DAY).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * MS_PER_DAY).toISOString();
    case '90d':
      return new Date(now.getTime() - 90 * MS_PER_DAY).toISOString();
    case 'all':
    default:
      return undefined;
  }
}
