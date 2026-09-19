import { Archive, Functions, Schedule, Storage } from '@mui/icons-material';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { format, formatDistanceToNow } from 'date-fns';
import type { ReactNode } from 'react';

import { Container, StatusIndicator, type StatusType } from '@/shared/design-system';

const DATE_FORMAT = 'MMM d, yyyy HH:mm';
const HOUR_MS = 60 * 60 * 1000;
const FRESH_HOURS = 6;
const STALE_DAYS = 7;
const DAY_HOURS = 24;

interface StatTileProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
  loading?: boolean;
}

function StatTile({ label, value, detail, icon, loading }: StatTileProps) {
  return (
    <Container variant="subtle" sx={{ flex: 1, minWidth: 180 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
        {icon}
        <Typography variant="subtitle2">{label}</Typography>
      </Stack>
      {loading ? (
        <Skeleton variant="text" sx={{ width: 96, fontSize: '1.5rem', mt: 0.5 }} />
      ) : (
        <Typography variant="h3" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
      )}
      {detail && !loading && (
        <Box sx={{ mt: 0.5 }}>
          {typeof detail === 'string' ? (
            <Typography variant="caption" color="text.secondary">
              {detail}
            </Typography>
          ) : (
            detail
          )}
        </Box>
      )}
    </Container>
  );
}

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

export default function ExportStats({
  totalAssets,
  archivedAssets = 0,
  lastUpdated,
  fieldStats,
  loading = false,
}: ExportStatsProps) {
  const fresh = freshness(lastUpdated);

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <StatTile
        label="Cached assets"
        value={totalAssets.toLocaleString()}
        icon={<Storage fontSize="small" />}
        loading={loading}
      />
      <StatTile
        label="Last export"
        value={fresh.value}
        detail={
          <StatusIndicator type={fresh.status} size="small">
            {fresh.note}
          </StatusIndicator>
        }
        icon={<Schedule fontSize="small" />}
        loading={loading}
      />
      <StatTile
        label="Fields"
        value={(fieldStats?.total ?? 0).toLocaleString()}
        detail={fieldStats ? `${fieldStats.calculated.toLocaleString()} calculated` : undefined}
        icon={<Functions fontSize="small" />}
        loading={loading}
      />
      <StatTile
        label="Archived"
        value={archivedAssets.toLocaleString()}
        icon={<Archive fontSize="small" />}
        loading={loading}
      />
    </Box>
  );
}
