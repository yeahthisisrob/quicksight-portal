/**
 * The feed: filters on top, then days with sticky headers, then bursts and
 * events on a rail. Pages load as the bottom scrolls into view.
 */
import { History as HistoryIcon } from '@mui/icons-material';
import { Alert, Box, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, pal } from '@/shared/design-system';

import {
  type TimelineAssetPin,
  type TimelineFilters,
  useActivityTimeline,
} from '../hooks/useActivityTimeline';
import { groupTimeline, type TimelineDay } from '../lib/timelineGroups';
import {
  dateRangeToStartDate,
  type TimelineDateRange,
  TimelineFilterBar,
} from './TimelineFilterBar';
import { TimelineGroupRow } from './TimelineRow';

const PAGE_SIZE = 50;
/** Pre-fetch the next page this far before the sentinel comes into view. */
const SENTINEL_ROOT_MARGIN = '400px';
const SKELETON_ROWS = 6;
const SKELETON_HEIGHT = 44;
const DEFAULT_RANGE: TimelineDateRange = '30d';

/**
 * Noisy events hidden by default. Ingestions fire on every scheduled refresh
 * and would drown out the changes people look for.
 */
const DEFAULT_EXCLUDED_EVENTS = ['CreateIngestion', 'CancelIngestion'];

interface TimelineFeedProps {
  /** Pin the feed to a single catalog asset. When omitted, shows the global feed. */
  assetPin?: TimelineAssetPin;
  /** Rendered above the filter bar, with the cache's last-refresh time. */
  renderHeader?: (ctx: { cacheLastUpdated: string | undefined }) => ReactNode;
  /** The first page, for a header that wants the asset's name. */
  onFirstPage?: (ctx: { cacheLastUpdated?: string; firstAssetName?: string }) => void;
  /** Start with these filters (e.g. a deep link to agent changes). */
  initialFilters?: Partial<TimelineFilters>;
}

function DayHeader({ day }: { day: TimelineDay }) {
  return (
    <Box
      sx={(theme) => ({
        position: 'sticky',
        top: 0,
        zIndex: 1,
        px: 2,
        py: 0.75,
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
        backgroundColor: pal(theme).surface.container,
        borderBottom: `1px solid ${pal(theme).line.divider}`,
        borderTop: `1px solid ${pal(theme).line.divider}`,
      })}
    >
      <Typography variant="overline" sx={{ fontWeight: 700 }}>
        {day.label}
      </Typography>
      <Typography variant="caption" sx={(theme) => ({ color: pal(theme).text.secondary })}>
        {day.eventCount} {day.eventCount === 1 ? 'event' : 'events'}
      </Typography>
    </Box>
  );
}

export function TimelineFeed({
  assetPin,
  renderHeader,
  onFirstPage,
  initialFilters,
}: TimelineFeedProps) {
  const [filters, setFilters] = useState<TimelineFilters>({
    startDate: dateRangeToStartDate(DEFAULT_RANGE),
    excludeEventNames: DEFAULT_EXCLUDED_EVENTS,
    ...initialFilters,
  });
  const [dateRange, setDateRange] = useState<TimelineDateRange>(DEFAULT_RANGE);
  const [showIngestions, setShowIngestions] = useState(false);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      excludeEventNames: showIngestions ? undefined : DEFAULT_EXCLUDED_EVENTS,
    }));
  }, [showIngestions]);

  const query = useActivityTimeline({ filters, assetPin, pageSize: PAGE_SIZE });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const days = useMemo(() => groupTimeline(items), [items]);
  const cacheLastUpdated = query.data?.pages[0]?.cacheLastUpdated;
  const firstAssetName = query.data?.pages[0]?.items.find((i) => i.assetName)?.assetName;

  useEffect(() => {
    if (query.data && onFirstPage) {
      onFirstPage({ cacheLastUpdated, firstAssetName });
    }
  }, [query.data, cacheLastUpdated, firstAssetName, onFirstPage]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !query.hasNextPage || query.isFetchingNextPage) {
      return;
    }
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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
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
          The timeline could not be loaded: {query.error?.message ?? 'unknown error'}
        </Alert>
      )}

      {query.isLoading && (
        <Stack spacing={1} sx={{ p: 2 }}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              sx={{ height: SKELETON_HEIGHT, borderRadius: 1 }}
            />
          ))}
        </Stack>
      )}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyState
          icon={<HistoryIcon />}
          title="Nothing in this window"
          description="Widen the date range, clear a filter, or refresh the activity from CloudTrail."
        />
      )}

      {items.length > 0 && (
        <Box sx={{ overflow: 'auto', flex: 1, position: 'relative' }}>
          {days.map((day) => (
            <Box key={day.key}>
              <DayHeader day={day} />
              {day.groups.map((group, index) => (
                <TimelineGroupRow
                  key={group.id}
                  group={group}
                  connect={index < day.groups.length - 1}
                />
              ))}
            </Box>
          ))}
          <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            {query.isFetchingNextPage && <CircularProgress size={20} />}
            {!query.hasNextPage && items.length > PAGE_SIZE && (
              <Typography variant="caption" sx={(theme) => ({ color: pal(theme).text.secondary })}>
                End of the timeline
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
