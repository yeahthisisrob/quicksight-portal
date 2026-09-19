/**
 * SmusExportPanel - the SageMaker Unified Studio card on Operations.
 *
 * Shows what the last SMUS export captured (when, how many projects,
 * listings and publishers, and the portal role's standing in the domain)
 * and runs a new one. Everything SMUS-related in the portal reads that
 * export, so this is where "why is the picker empty" gets answered.
 */
import { CloudSync, PlayArrow } from '@mui/icons-material';
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { format, formatDistanceToNow } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';

import { describeProjectDiagnostics } from '@/entities/smus';

import { getApiErrorMessage } from '@/shared/api';
import type { JobMetadata } from '@/shared/api/modules/jobs';
import type { SmusSnapshotSummary, SmusStatus } from '@/shared/api/modules/smus';
import {
  Container,
  EmptyState,
  KeyValuePairs,
  StatusIndicator,
  type StatusType,
} from '@/shared/design-system';

import { useSmusStatus } from '../hooks/useSmus';
import { useSmusExport } from '../model/useSmusExport';

const DATE_FORMAT = 'MMM d, yyyy HH:mm';
const PROGRESS_MAX = 100;

const JOB_TONE: Record<JobMetadata['status'], { type: StatusType; label: string }> = {
  queued: { type: 'pending', label: 'Queued' },
  processing: { type: 'in-progress', label: 'Exporting' },
  completed: { type: 'success', label: 'Completed' },
  failed: { type: 'error', label: 'Failed' },
  stopping: { type: 'warning', label: 'Stopping' },
  stopped: { type: 'stopped', label: 'Stopped' },
};

function JobProgress({ job }: { job: JobMetadata }) {
  const tone = JOB_TONE[job.status] ?? JOB_TONE.queued;
  const active = job.status === 'queued' || job.status === 'processing';
  const progress = Math.min(job.progress ?? 0, PROGRESS_MAX);
  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <StatusIndicator type={tone.type}>{tone.label}</StatusIndicator>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {job.message || (active ? 'Sweeping the domain' : '')}
        </Typography>
        {active && (
          <Typography variant="caption" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        )}
      </Stack>
      {active && (
        <LinearProgress
          variant={progress === 0 ? 'indeterminate' : 'determinate'}
          value={progress}
          sx={{ mt: 1 }}
        />
      )}
      {job.status === 'failed' && job.error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {job.error}
        </Alert>
      )}
    </Box>
  );
}

function SnapshotFacts({ snapshot }: { snapshot: SmusSnapshotSummary }) {
  const exported = new Date(snapshot.exportedAt);
  const detail = describeProjectDiagnostics(snapshot.diagnostics);
  return (
    <Stack spacing={2}>
      <KeyValuePairs
        columns={3}
        items={[
          {
            label: 'Last export',
            value: `${formatDistanceToNow(exported, { addSuffix: true })} · ${format(exported, DATE_FORMAT)}`,
          },
          { label: 'Domain', value: snapshot.domainId },
          { label: 'Region', value: snapshot.region },
          {
            label: 'Scope',
            value:
              snapshot.projectFilter.length > 0
                ? `Scoped to ${snapshot.projectFilter.length} selected project${snapshot.projectFilter.length === 1 ? '' : 's'}`
                : 'Whole domain',
            info: 'The projects selected under "Projects to read from" in Settings limit what the export captures.',
          },
          { label: 'Projects', value: snapshot.projects.toLocaleString() },
          { label: 'Published listings', value: snapshot.listings.toLocaleString() },
          { label: 'Publishing projects', value: snapshot.publishers.toLocaleString() },
        ]}
      />
      {detail && (
        <Alert severity={snapshot.projects === 0 ? 'warning' : 'info'} icon={false}>
          {detail}
        </Alert>
      )}
    </Stack>
  );
}

function Body({
  status,
  running,
  onRun,
}: {
  status: SmusStatus;
  running: boolean;
  onRun: () => void;
}) {
  if (!status.configured) {
    return (
      <EmptyState
        compact
        title="SageMaker Unified Studio is not connected"
        description="Set the domain id and region in Settings, then run an export to bring its published assets into the portal."
        action={
          <Button component={RouterLink} to="/settings" variant="contained">
            Open Settings
          </Button>
        }
      />
    );
  }
  if (!status.snapshot) {
    return (
      <EmptyState
        compact
        icon={<CloudSync />}
        title="No SMUS export yet"
        description="Nothing from the domain is in the portal until an export has run. It sweeps the projects and published listings once and stores them; Settings, Author and the catalog read from that."
        action={
          <Button variant="contained" startIcon={<PlayArrow />} onClick={onRun} disabled={running}>
            Run export
          </Button>
        }
      />
    );
  }
  return <SnapshotFacts snapshot={status.snapshot} />;
}

export function SmusExportPanel() {
  const status = useSmusStatus();
  const exportJob = useSmusExport();

  return (
    <Container
      header="SageMaker Unified Studio"
      description="Projects and published listings, captured by the SMUS export. Everything SMUS in the portal reads this snapshot, never DataZone directly."
      actions={
        status.data?.configured ? (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => void exportJob.start()}
            disabled={exportJob.running}
          >
            {exportJob.running ? 'Exporting' : 'Run export'}
          </Button>
        ) : undefined
      }
    >
      <Stack spacing={2.5}>
        {exportJob.startError && <Alert severity="error">{exportJob.startError}</Alert>}
        {exportJob.job && <JobProgress job={exportJob.job} />}
        {status.isLoading ? (
          <LinearProgress />
        ) : status.isError ? (
          <Alert severity="error">
            {getApiErrorMessage(status.error, 'The SMUS status could not be read')}
          </Alert>
        ) : status.data ? (
          <Body
            status={status.data}
            running={exportJob.running}
            onRun={() => void exportJob.start()}
          />
        ) : null}
      </Stack>
    </Container>
  );
}
