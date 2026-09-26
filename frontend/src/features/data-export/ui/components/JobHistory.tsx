import {
  DescriptionOutlined as LogsIcon,
  RefreshOutlined as RefreshIcon,
} from '@mui/icons-material';
import {
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { format, formatDistanceToNow } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { exportApi } from '@/shared/api';
import type { JobMetadata, JobStatus, JobType } from '@/shared/api/modules/jobs';
import { EmptyState, pal, StatusIndicator, type StatusType } from '@/shared/design-system';

type Job = JobMetadata;

const PAGE_SIZE = 50;
const SKELETON_ROWS = 5;
const COLUMN_COUNT = 7;
const MAX_HEIGHT = 480;
const MS_PER_S = 1000;
const S_PER_MIN = 60;
const MIN_PER_H = 60;

/** Friendly labels for the job types the portal runs. */
const JOB_TYPE_LABELS: Record<string, string> = {
  export: 'Export',
  'activity-refresh': 'Activity refresh',
  'smus-export': 'SMUS export',
  'bulk-operation': 'Bulk operation',
  'csv-export': 'CSV export',
  planner: 'Planner',
  assistant: 'Assistant',
  deploy: 'Deploy',
  ingestion: 'Ingestion',
  rebuild: 'Rebuild',
};

/** Type-filter options shown in the dropdown (only types users start from the portal). */
const JOB_TYPE_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'export', label: 'Export' },
  { value: 'activity-refresh', label: 'Activity refresh' },
  { value: 'smus-export', label: 'SMUS export' },
  { value: 'bulk-operation', label: 'Bulk operation' },
  { value: 'csv-export', label: 'CSV export' },
  { value: 'planner', label: 'Planner' },
  { value: 'deploy', label: 'Deploy' },
];

const STATUS_TONE: Record<Job['status'], { type: StatusType; label: string }> = {
  completed: { type: 'success', label: 'Completed' },
  failed: { type: 'error', label: 'Failed' },
  stopped: { type: 'stopped', label: 'Stopped' },
  stopping: { type: 'warning', label: 'Stopping' },
  processing: { type: 'in-progress', label: 'Processing' },
  queued: { type: 'pending', label: 'Queued' },
};

/** Ingestion exports run as jobType 'export'; tell them apart by their options. */
function jobTypeLabel(job: Job): string {
  if (job.jobType === 'export' && job.exportOptions?.exportIngestions) {
    return 'Export (ingestions)';
  }
  return JOB_TYPE_LABELS[job.jobType ?? ''] ?? job.jobType ?? 'Unknown';
}

/**
 * Sum QuickSight API calls from the tracked per-operation counts. Operations
 * are namespaced ('api.dashboard.describe', 's3.get', ...); only api.* rows
 * are API calls. Null when the job tracked none (bulk operations).
 */
function sumApiCalls(job: Job): number | null {
  const ops = job.stats?.operations;
  if (!ops) return null;
  const apiEntries = Object.entries(ops).filter(([key]) => key.startsWith('api.'));
  if (apiEntries.length === 0) return null;
  return apiEntries.reduce((sum, [, value]) => sum + value, 0);
}

function formatDuration(duration?: number): string {
  if (!duration) return '-';
  const seconds = Math.floor(duration / MS_PER_S);
  const minutes = Math.floor(seconds / S_PER_MIN);
  const hours = Math.floor(minutes / MIN_PER_H);
  if (hours > 0) return `${hours}h ${minutes % MIN_PER_H}m`;
  if (minutes > 0) return `${minutes}m ${seconds % S_PER_MIN}s`;
  return `${seconds}s`;
}

interface JobHistoryProps {
  onSelectJob: (jobId: string) => void;
  currentJobId?: string | null;
}

/** Every job the portal ran, newest first; a row opens its log. */
export function JobHistory({ onSelectJob, currentJobId }: JobHistoryProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<JobType | 'all'>('all');

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await exportApi.listJobs({
        limit: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
      });
      setJobs(result?.jobs || []);
    } catch (error) {
      console.error('Failed to load job history:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  const refresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle2">Job history</Typography>
        <Typography variant="caption" color="text.secondary">
          {jobs.length} jobs
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', ml: 'auto' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as JobType | 'all')}
              label="Type"
            >
              {JOB_TYPE_FILTERS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="stopped">Stopped</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="queued">Queued</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={refresh} disabled={refreshing} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <TableContainer
        sx={(theme) => ({
          maxHeight: MAX_HEIGHT,
          border: `1px solid ${pal(theme).line.divider}`,
          borderRadius: `${theme.shape.borderRadius}px`,
        })}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Assets</TableCell>
              <TableCell>API calls</TableCell>
              <TableCell align="right">Log</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <Skeleton variant="text" />
                  </TableCell>
                </TableRow>
              ))
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <EmptyState
                    compact
                    title="No jobs match"
                    description="Nothing has run with this type and status yet."
                  />
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const tone = STATUS_TONE[job.status] ?? STATUS_TONE.queued;
                return (
                  <TableRow
                    key={job.jobId}
                    hover
                    selected={job.jobId === currentJobId}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => onSelectJob(job.jobId)}
                  >
                    <TableCell>
                      <StatusIndicator type={tone.type} size="small">
                        {tone.label}
                      </StatusIndicator>
                    </TableCell>
                    <TableCell>
                      <Chip label={jobTypeLabel(job)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={format(new Date(job.startTime), 'PPpp')}>
                        <Typography variant="body2">
                          {formatDistanceToNow(new Date(job.startTime), { addSuffix: true })}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDuration(job.duration ?? undefined)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {job.stats?.totalAssets !== undefined ||
                        job.stats?.processedAssets !== undefined
                          ? `${job.stats?.processedAssets || 0} / ${job.stats?.totalAssets || 0}`
                          : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {sumApiCalls(job)?.toLocaleString() ?? '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View log">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectJob(job.jobId);
                          }}
                        >
                          <LogsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
