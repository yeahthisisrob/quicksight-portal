/**
 * Every job the portal runs - exports, SMUS exports, bulk operations, the
 * assistant, the planner, scripts - in one grid: filter by type, status and
 * window (all in the URL, so a filtered view is a link), sort any column,
 * and open one to follow it. Polls every few seconds while anything runs.
 */
import { Refresh } from '@mui/icons-material';
import {
  Alert,
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { format, formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  apiCalls,
  formatDuration,
  isActive,
  itemsSummary,
  JOB_TYPE_LABELS,
  JobStatusIndicator,
  jobDuration,
  jobTypeLabel,
  startedByLabel,
} from '@/entities/job';
import { PersonLabel } from '@/entities/user';

import { getApiErrorMessage } from '@/shared/api';
import type { JobMetadata, JobStatus, JobType } from '@/shared/api/modules/jobs';
import { pal, SegmentedControl } from '@/shared/design-system';

import { useJobsList } from '../lib/useJobs';
import {
  type JobsSince,
  readJobsFilters,
  SINCE_OPTIONS,
  STATUS_OPTIONS,
  writeJobsFilters,
} from '../model/jobsFilters';
import { JobDetailDrawer } from './JobDetailDrawer';

const ALL = 'all';
const PAGE_SIZE = 50;
const GRID_HEIGHT = 640;

const TYPE_OPTIONS = (Object.entries(JOB_TYPE_LABELS) as Array<[JobType, string]>).sort(
  ([, a], [, b]) => a.localeCompare(b)
);

const COLUMNS: GridColDef<JobMetadata>[] = [
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <JobStatusIndicator status={row.status} />
      </Box>
    ),
  },
  {
    field: 'jobType',
    headerName: 'Type',
    width: 160,
    valueGetter: (_value, row) => jobTypeLabel(row),
  },
  {
    field: 'message',
    headerName: 'What it did',
    flex: 1,
    minWidth: 200,
    maxWidth: 380,
    valueGetter: (_value, row) => (row.status === 'failed' && row.error ? row.error : row.message),
    renderCell: ({ row, value }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ color: row.status === 'failed' ? 'error.main' : 'text.secondary' }}
          title={value as string}
        >
          {value as string}
        </Typography>
      </Box>
    ),
  },
  {
    field: 'startTime',
    headerName: 'Started',
    width: 150,
    type: 'dateTime',
    valueGetter: (value: string) => (value ? new Date(value) : null),
    renderCell: ({ value }) =>
      value ? (
        <Tooltip title={format(value as Date, 'PPpp')}>
          <span>{formatDistanceToNow(value as Date, { addSuffix: true })}</span>
        </Tooltip>
      ) : (
        '-'
      ),
  },
  {
    field: 'duration',
    headerName: 'Duration',
    width: 100,
    type: 'number',
    valueGetter: (_value, row) => jobDuration(row),
    valueFormatter: (value: number | null) => formatDuration(value),
  },
  {
    field: 'items',
    headerName: 'Items',
    width: 150,
    sortable: false,
    valueGetter: (_value, row) => itemsSummary(row),
  },
  {
    field: 'apiCalls',
    headerName: 'API calls',
    width: 100,
    type: 'number',
    valueGetter: (_value, row) => apiCalls(row),
  },
  {
    field: 'startedBy',
    headerName: 'Started by',
    flex: 1,
    minWidth: 160,
    valueGetter: (_value, row) => startedByLabel(row),
    renderCell: ({ row, value }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
        <PersonLabel person={row.startedByPerson} fallback={value as string} />
      </Box>
    ),
  },
];

function Summary({ jobs, since }: { jobs: JobMetadata[]; since: JobsSince }) {
  const running = jobs.filter((j) => isActive(j.status)).length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const window = SINCE_OPTIONS.find((o) => o.value === since)?.label.toLowerCase();
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {jobs.length} job{jobs.length === 1 ? '' : 's'}
      {since === 'all' ? '' : ` in the last ${window}`}
      {running > 0 ? ` · ${running} running` : ''}
      {failed > 0 ? ` · ${failed} failed` : ''}
    </Typography>
  );
}

export function JobsView() {
  const [params, setParams] = useSearchParams();
  const filters = readJobsFilters(params);
  const jobs = useJobsList(filters);
  const rows = useMemo(() => jobs.data ?? [], [jobs.data]);

  const update = (patch: Parameters<typeof writeJobsFilters>[1]) =>
    setParams((prev) => writeJobsFilters(prev, patch), { replace: true });

  return (
    <Stack spacing={2} data-testid="jobs-view">
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}
      >
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="jobs-type">Type</InputLabel>
          <Select
            labelId="jobs-type"
            label="Type"
            value={filters.type ?? ALL}
            onChange={(e) =>
              update({ type: e.target.value === ALL ? undefined : (e.target.value as JobType) })
            }
          >
            <MenuItem value={ALL}>All types</MenuItem>
            {TYPE_OPTIONS.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="jobs-status">Status</InputLabel>
          <Select
            labelId="jobs-status"
            label="Status"
            value={filters.status ?? ALL}
            onChange={(e) =>
              update({
                status: e.target.value === ALL ? undefined : (e.target.value as JobStatus),
              })
            }
          >
            <MenuItem value={ALL}>Any status</MenuItem>
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <SegmentedControl<JobsSince>
          size="small"
          ariaLabel="How far back"
          value={filters.since}
          onChange={(since) => update({ since })}
          options={SINCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <Box sx={{ flex: 1 }} />
        <Summary jobs={rows} since={filters.since} />
        <Tooltip title="Refresh">
          <span>
            <IconButton
              size="small"
              onClick={() => void jobs.refetch()}
              disabled={jobs.isFetching}
              aria-label="Refresh"
            >
              <Refresh fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {jobs.isError && (
        <Alert severity="error">{getApiErrorMessage(jobs.error, 'Could not load the jobs')}</Alert>
      )}

      <Box
        sx={(theme) => ({
          height: GRID_HEIGHT,
          '& .MuiDataGrid-root': { border: `1px solid ${pal(theme).line.divider}` },
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
        })}
      >
        <DataGrid<JobMetadata>
          rows={rows}
          columns={COLUMNS}
          getRowId={(row) => row.jobId}
          loading={jobs.isLoading}
          density="compact"
          disableRowSelectionOnClick
          onRowClick={({ row }) => update({ job: row.jobId })}
          initialState={{
            sorting: { sortModel: [{ field: 'startTime', sort: 'desc' }] },
            pagination: { paginationModel: { pageSize: PAGE_SIZE, page: 0 } },
          }}
          pageSizeOptions={[25, PAGE_SIZE, 100]}
          localeText={{ noRowsLabel: 'No jobs match these filters.' }}
          aria-label="Jobs"
        />
      </Box>

      <JobDetailDrawer jobId={filters.job} onClose={() => update({ job: undefined })} />
    </Stack>
  );
}
