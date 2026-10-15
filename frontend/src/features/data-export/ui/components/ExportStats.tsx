import { format, formatDistanceToNow } from 'date-fns';

import { StatStrip, StatusIndicator, type StatusType } from '@/shared/design-system';

const DATE_FORMAT = 'MMM d, yyyy HH:mm';
const HOUR_MS = 60 * 60 * 1000;
const FRESH_HOURS = 6;
const STALE_DAYS = 7;
const DAY_HOURS = 24;

interface ExportStatsProps {
  totalAssets: number;
  archivedAssets?: number;
  lastUpdated?: string | null;
  fieldStats: {
    total: number;
    calculated: number;
    physical: number;
  } | null;
  loading?: boolean;
}

/** How fresh the cache is, said with a status not just a time. */
function freshness(lastUpdated: string | null | undefined): {
  value: string;
  status: StatusType;
  note: string;
} {
  if (!lastUpdated) {
    return { value: 'Never', status: 'pending', note: 'Run the first export' };
  }
  const date = new Date(lastUpdated);
  const ageHours = (Date.now() - date.getTime()) / HOUR_MS;
  const value = formatDistanceToNow(date, { addSuffix: true });
  if (ageHours < FRESH_HOURS) {
    return { value, status: 'success', note: format(date, DATE_FORMAT) };
  }
  if (ageHours < STALE_DAYS * DAY_HOURS) {
    return { value, status: 'warning', note: 'Consider a refresh' };
  }
  return { value, status: 'error', note: 'Stale' };
}

/** What the cache holds, as the same strip of counts the catalog shows over its lists. */
export default function ExportStats({
  totalAssets,
  archivedAssets = 0,
  lastUpdated,
  fieldStats,
  loading = false,
}: ExportStatsProps) {
  const fresh = freshness(lastUpdated);
  return (
    <StatStrip
      ariaLabel="Cache summary"
      loading={loading}
      items={[
        { label: 'Cached assets', value: totalAssets.toLocaleString() },
        { label: 'Archived', value: archivedAssets.toLocaleString() },
        {
          label: 'Fields',
          value: (fieldStats?.total ?? 0).toLocaleString(),
          ...(fieldStats ? { hint: `${fieldStats.calculated.toLocaleString()} calculated` } : {}),
        },
        {
          label: 'Last export',
          value: fresh.value,
          hint: (
            <StatusIndicator type={fresh.status} size="small">
              {fresh.note}
            </StatusIndicator>
          ),
        },
      ]}
    />
  );
}
