/**
 * The activity refresh, as an operation: start one, watch it through its
 * phases, and see the recent runs (by a person, the API or the schedule).
 * The timeline page only reads what these runs produced; Settings >
 * Schedules can start them by itself.
 */
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Box, Button, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';

import { jobsApi } from '@/shared/api';
import type { JobMetadata } from '@/shared/api/modules/jobs';
import { Container } from '@/shared/design-system';

import { useActivityRefresh } from '../hooks/useActivityRefresh';
import { ActivityRefreshProgress } from './ActivityRefreshProgress';

/** How far back a refresh reads CloudTrail. */
const REFRESH_DAYS = 90;
const RECENT_RUNS = 10;
const SPINNER_SIZE = 16;
const ACTIVE = new Set(['queued', 'processing', 'stopping']);

const STATUS_COLOR: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  completed: 'success',
  failed: 'error',
  stopped: 'warning',
  processing: 'info',
  queued: 'info',
  stopping: 'warning',
};

function RunRow({ job }: { job: JobMetadata }) {
  const when = new Date(job.startTime);
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 0.75 }}>
      <Chip
        size="small"
        color={STATUS_COLOR[job.status] ?? 'default'}
        variant={ACTIVE.has(job.status) ? 'filled' : 'outlined'}
        label={job.status}
      />
      <Typography variant="body2" sx={{ minWidth: 0, flex: 1 }} noWrap>
        {job.message ?? 'Activity refresh'}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {formatDistanceToNow(when, { addSuffix: true })}
        {job.startedBy ? ` · ${job.startedBy}` : ''}
      </Typography>
    </Stack>
  );
}

export function ActivityPanel() {
  const { refreshing, refreshActivity, jobStatus } = useActivityRefresh();
  const runs = useQuery({
    queryKey: ['jobs', 'recent', 'activity-refresh', jobStatus?.status],
    queryFn: () => jobsApi.listJobs({ type: 'activity-refresh', limit: RECENT_RUNS }),
  });
  const showProgress =
    refreshing ||
    jobStatus?.status === 'completed' ||
    jobStatus?.status === 'failed' ||
    jobStatus?.status === 'stopped';
  const recent = runs.data ?? [];

  return (
    <Stack spacing={2} data-testid="activity-panel">
      <Container
        header="Activity refresh"
        description={`Reads the last ${REFRESH_DAYS} days of views, viewers and load times from CloudTrail and CloudWatch, and the datasets' refresh runs, into the caches the Activity page and the asset lists read. One runs at a time.`}
        actions={
          <Button
            variant="contained"
            startIcon={
              refreshing ? (
                <CircularProgress size={SPINNER_SIZE} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
            onClick={() => refreshActivity({ assetTypes: ['all'], days: REFRESH_DAYS })}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh activity'}
          </Button>
        }
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          To run it by itself, set a cadence under{' '}
          <Button component={RouterLink} to="/settings?section=schedules" size="small">
            Settings › Schedules
          </Button>
        </Typography>
      </Container>

      {showProgress && <ActivityRefreshProgress jobStatus={jobStatus} />}

      <Container
        header="Recent runs"
        description="Who started each, and how it ended. Every run is also under Jobs, with its log."
      >
        {runs.isLoading ? (
          <CircularProgress size={20} />
        ) : recent.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No activity refresh has run yet.
          </Typography>
        ) : (
          <Box>
            {recent.map((job, i) => (
              <Box key={job.jobId}>
                {i > 0 && <Divider />}
                <RunRow job={job} />
              </Box>
            ))}
          </Box>
        )}
      </Container>
    </Stack>
  );
}
