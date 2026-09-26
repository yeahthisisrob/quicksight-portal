/**
 * One job, beside the list: what it is doing or did, its phases, what
 * failed, and its log followed live while it runs. Stop it while it runs;
 * download what it produced once it is done.
 */
import {
  CheckCircleOutlined,
  Close,
  Download,
  ErrorOutlined,
  HourglassEmpty,
  RemoveCircleOutlined,
  StopCircleOutlined,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import {
  apiCalls,
  formatDuration,
  isActive,
  itemsSummary,
  JobFailureList,
  JobLogGrid,
  JobStatusIndicator,
  jobDuration,
  jobTypeLabel,
  useJobLogs,
} from '@/entities/job';

import { getApiErrorMessage } from '@/shared/api';
import { type JobMetadata, type JobPhase, jobsApi } from '@/shared/api/modules/jobs';
import { KeyValuePairs } from '@/shared/design-system';

import { useJob } from '../lib/useJobs';

const DRAWER_WIDTH = 820;
const TOP_OPERATIONS = 8;

function PhaseIcon({ status }: { status: JobPhase['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircleOutlined fontSize="small" color="success" />;
    case 'failed':
      return <ErrorOutlined fontSize="small" color="error" />;
    case 'in_progress':
      return <CircularProgress size={16} />;
    case 'skipped':
      return <RemoveCircleOutlined fontSize="small" color="disabled" />;
    default:
      return <HourglassEmpty fontSize="small" color="disabled" />;
  }
}

function Phases({ phases }: { phases: JobPhase[] }) {
  return (
    <Stack spacing={0.75}>
      {phases.map((phase) => (
        <Stack key={phase.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <PhaseIcon status={phase.status} />
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 140 }}>
            {phase.key}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }} noWrap>
            {phase.message ?? ''}
          </Typography>
          {phase.counts?.total !== undefined && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {phase.counts.processed ?? 0} / {phase.counts.total}
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

/** The busiest operations, for jobs that count them (exports). */
function Operations({ job }: { job: JobMetadata }) {
  const ops = Object.entries(job.stats?.operations ?? {})
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_OPERATIONS);
  if (ops.length === 0) return null;
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
      {ops.map(([name, count]) => (
        <Chip
          key={name}
          size="small"
          variant="outlined"
          label={`${name} · ${count.toLocaleString()}`}
          sx={{ fontFamily: 'monospace', fontSize: '0.6875rem' }}
        />
      ))}
    </Stack>
  );
}

async function downloadResult(job: JobMetadata) {
  const result = await jobsApi.getJobResult(job.jobId);
  if (result === null) {
    throw new Error('This job saved no result');
  }
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${job.jobType}-${job.jobId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function JobDetail({ job }: { job: JobMetadata }) {
  const active = isActive(job.status);
  const log = useJobLogs(job.jobId, { follow: active });
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [stopping, setStopping] = useState(false);
  const calls = apiCalls(job);
  const started = Date.parse(job.startTime);

  const stop = async () => {
    setStopping(true);
    try {
      await jobsApi.stopJob(job.jobId);
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      enqueueSnackbar('Asked the job to stop', { variant: 'info' });
    } catch (e) {
      enqueueSnackbar(getApiErrorMessage(e, 'Could not stop the job'), { variant: 'error' });
    } finally {
      setStopping(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
        >
          <JobStatusIndicator status={job.status} size="medium" />
          {job.message && (
            <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, minWidth: 200 }}>
              {job.message}
            </Typography>
          )}
          {active && (
            <Button
              size="small"
              color="warning"
              variant="outlined"
              startIcon={<StopCircleOutlined />}
              onClick={() => void stop()}
              disabled={stopping || job.status === 'stopping'}
            >
              Stop
            </Button>
          )}
          {job.status === 'completed' && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download />}
              onClick={() =>
                void downloadResult(job).catch((e) =>
                  enqueueSnackbar(getApiErrorMessage(e, 'No result to download'), {
                    variant: 'info',
                  })
                )
              }
            >
              Result
            </Button>
          )}
        </Stack>
        {active && (
          <LinearProgress
            variant={job.progress ? 'determinate' : 'indeterminate'}
            value={job.progress ?? 0}
            aria-label="Progress"
          />
        )}
      </Stack>

      {job.error && job.status === 'failed' && <Alert severity="error">{job.error}</Alert>}
      <JobFailureList
        failures={job.failures ?? []}
        title={`${job.failures?.length ?? 0} item${job.failures?.length === 1 ? '' : 's'} failed`}
      />

      <KeyValuePairs
        columns={3}
        items={[
          {
            label: 'Started',
            value: Number.isFinite(started) ? (
              <Tooltip title={format(started, 'PPpp')}>
                <span>{formatDistanceToNow(started, { addSuffix: true })}</span>
              </Tooltip>
            ) : (
              '-'
            ),
          },
          { label: 'Duration', value: formatDuration(jobDuration(job)) },
          { label: 'Items', value: itemsSummary(job) },
          { label: 'API calls', value: calls === null ? '-' : calls.toLocaleString() },
          { label: 'Started by', value: job.userId ?? 'The portal' },
          { label: 'Job id', value: <code>{job.jobId}</code> },
        ]}
      />
      <Operations job={job} />

      {job.phases && job.phases.length > 0 && (
        <Section title="Phases">
          <Phases phases={job.phases} />
        </Section>
      )}

      <Divider />
      <Section title="Log">
        <JobLogGrid
          logs={log.logs}
          loading={log.loading}
          error={log.error}
          follow={active}
          height={440}
        />
      </Section>
    </Stack>
  );
}

export function JobDetailDrawer({
  jobId,
  onClose,
}: {
  jobId: string | undefined;
  onClose: () => void;
}) {
  const job = useJob(jobId);
  return (
    <Drawer
      anchor="right"
      open={Boolean(jobId)}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', md: DRAWER_WIDTH } } } }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700, flex: 1 }} noWrap>
          {job.data ? jobTypeLabel(job.data) : 'Job'}
        </Typography>
        <IconButton onClick={onClose} aria-label="Close">
          <Close />
        </IconButton>
      </Stack>
      <Box sx={{ p: 3, overflow: 'auto' }} data-testid="job-detail">
        {job.isLoading ? (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={120} />
          </Stack>
        ) : job.isError ? (
          <Alert severity="error">{getApiErrorMessage(job.error, 'Could not load the job')}</Alert>
        ) : job.data ? (
          <JobDetail key={job.data.jobId} job={job.data} />
        ) : (
          <Alert severity="info">
            This job is no longer kept; jobs expire after their retention.
          </Alert>
        )}
      </Box>
    </Drawer>
  );
}
