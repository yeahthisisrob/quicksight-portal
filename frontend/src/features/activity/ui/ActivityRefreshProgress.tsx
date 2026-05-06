import {
  CheckCircle,
  CloudDownload,
  Edit,
  PlaylistAddCheck,
  Settings,
  Warning,
} from '@mui/icons-material';
import { Alert, Box, Stack, Typography, alpha } from '@mui/material';
import { type ReactNode } from 'react';

import {
  JobProgress,
  type JobPhaseStatus as UIJobPhaseStatus,
  type JobProgressStep,
} from '@/entities/job';

import { colors, spacing } from '@/shared/design-system/theme';

import type { JobMetadata, JobPhase } from '@/shared/api/modules/jobs';

type ActivityPhaseKey = 'initialize' | 'fetch-views' | 'fetch-mutations' | 'merge-and-persist';

const STEPS: JobProgressStep[] = [
  {
    key: 'initialize',
    label: 'Initialize',
    description: 'Loading cache & planning fetch',
    icon: Settings,
  },
  {
    key: 'fetch-views',
    label: 'Views',
    description: 'Reading dashboard & analysis views',
    icon: CloudDownload,
  },
  {
    key: 'fetch-mutations',
    label: 'Mutations',
    description: 'Reading audit events',
    icon: Edit,
  },
  {
    key: 'merge-and-persist',
    label: 'Persist',
    description: 'Merging & saving',
    icon: PlaylistAddCheck,
  },
];

interface ActivityRefreshProgressProps {
  jobStatus: JobMetadata | null;
}

const findPhase = (phases: JobPhase[] | undefined, key: ActivityPhaseKey): JobPhase | undefined =>
  phases?.find((p) => p.key === key);

const phaseStepIndex = (phases: JobPhase[] | undefined): number => {
  if (!phases) return -1;
  // Active = the first in_progress phase. If none in flight, fall back to
  // the last completed (so a finished job shows the final step lit).
  const inProgress = phases.findIndex((p) => p.status === 'in_progress');
  if (inProgress !== -1) return inProgress;
  const lastDone = phases.reduce(
    (acc, p, idx) => (p.status === 'completed' || p.status === 'skipped' ? idx : acc),
    -1
  );
  // For a fully complete job, surface the final step as "active" so the
  // stepper doesn't visually overshoot.
  return lastDone === phases.length - 1 ? lastDone : lastDone + 1;
};

const overallStatus = (jobStatus: JobMetadata): UIJobPhaseStatus => {
  switch (jobStatus.status) {
    case 'failed':
    case 'stopping':
    case 'stopped':
      return 'error';
    case 'completed':
      return 'completed';
    case 'queued':
    case 'processing':
      return 'running';
    default:
      return 'idle';
  }
};

const elapsedMs = (jobStatus: JobMetadata): number | null => {
  if (!jobStatus.startTime) return null;
  const start = new Date(jobStatus.startTime).getTime();
  if (Number.isNaN(start)) return null;
  const end = jobStatus.endTime ? new Date(jobStatus.endTime).getTime() : Date.now();
  return Math.max(0, end - start);
};

interface PhaseTotals {
  newEvents: number;
  truncated: number;
  errors: number;
}

const sumPhaseCounts = (phases: JobPhase[] | undefined): PhaseTotals => {
  if (!phases) return { newEvents: 0, truncated: 0, errors: 0 };
  return phases.reduce<PhaseTotals>(
    (acc, p) => ({
      newEvents: acc.newEvents + (p.counts?.newEvents ?? 0),
      truncated: acc.truncated + (p.counts?.truncated ?? 0),
      errors: acc.errors + (p.counts?.errors ?? 0),
    }),
    { newEvents: 0, truncated: 0, errors: 0 }
  );
};

const computeProgressDetails = (
  phases: JobPhase[] | undefined
): { label: string; processed: number; total: number } | undefined => {
  const fetchViews = findPhase(phases, 'fetch-views');
  const fetchMutations = findPhase(phases, 'fetch-mutations');
  const active =
    fetchMutations?.status === 'in_progress'
      ? fetchMutations
      : fetchViews?.status === 'in_progress'
        ? fetchViews
        : undefined;
  if (!active?.counts?.total || active.counts.total <= 0) return undefined;
  return {
    label: active === fetchViews ? 'View event types fetched' : 'Mutation event types fetched',
    processed: active.counts.processed ?? 0,
    total: active.counts.total,
  };
};

const renderFooter = (
  status: UIJobPhaseStatus,
  totals: PhaseTotals
): ReactNode => {
  if (status !== 'completed') return undefined;
  if (totals.truncated === 0 && totals.errors === 0) {
    return (
      <Box
        sx={{
          p: spacing.sm / 8,
          borderRadius: `${spacing.xs / 8}px`,
          background: alpha(colors.status.success, 0.05),
          border: `1px solid ${alpha(colors.status.success, 0.1)}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={spacing.xs / 8}>
          <CheckCircle sx={{ color: colors.status.success, fontSize: 20 }} />
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
            Activity refresh completed — {totals.newEvents.toLocaleString()} new events ingested
          </Typography>
        </Stack>
      </Box>
    );
  }
  return (
    <Stack spacing={spacing.xs / 8}>
      {totals.truncated > 0 && (
        <Alert severity="warning" icon={<Warning fontSize="inherit" />} variant="outlined">
          {totals.truncated} event {totals.truncated === 1 ? 'type' : 'types'} hit the pagination
          cap — some older events may be missing.
        </Alert>
      )}
      {totals.errors > 0 && (
        <Alert severity="warning" variant="outlined">
          {totals.errors} event {totals.errors === 1 ? 'type' : 'types'} failed during this
          refresh and will retry next time.
        </Alert>
      )}
    </Stack>
  );
};

/**
 * Step-based progress card for the activity-refresh job. Maps the backend
 * `phases` array onto the generic JobProgress component, surfaces truncation
 * and error counts, and degrades gracefully when phases aren't yet present
 * (e.g. for a job persisted before phases were a feature).
 */
export function ActivityRefreshProgress({ jobStatus }: ActivityRefreshProgressProps) {
  if (!jobStatus) {
    return null;
  }
  const status = overallStatus(jobStatus);
  return (
    <JobProgress
      title="Activity Refresh"
      steps={STEPS}
      currentStepIndex={phaseStepIndex(jobStatus.phases)}
      phaseStatus={status}
      progressPercent={typeof jobStatus.progress === 'number' ? jobStatus.progress : undefined}
      progressDetails={computeProgressDetails(jobStatus.phases)}
      elapsedMs={elapsedMs(jobStatus)}
      statusLabel={jobStatus.status}
      footerContent={renderFooter(status, sumPhaseCounts(jobStatus.phases))}
    />
  );
}
