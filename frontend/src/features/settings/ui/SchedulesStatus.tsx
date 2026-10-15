/**
 * Under the Schedules settings: for each kind of run, when it last
 * completed, whether one is going, and when the next is due on the cadence
 * chosen (unsaved changes count, so a person sees what a choice means
 * before saving). Read from the job list, nothing more.
 */
import { Box, Chip, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { jobsApi } from '@/shared/api';
import type { JobMetadata, JobType } from '@/shared/api/modules/jobs';

/** The runs Settings can schedule, in the order they flow. */
const SCHEDULED_KINDS: Array<{ jobType: JobType; settingKey: string; label: string }> = [
  { jobType: 'smus-export', settingKey: 'schedules.smus', label: 'SMUS export' },
  { jobType: 'export', settingKey: 'schedules.export', label: 'Smart Sync export' },
  { jobType: 'activity-refresh', settingKey: 'schedules.activity', label: 'Activity refresh' },
];

const ACTIVE = new Set(['queued', 'processing', 'stopping']);
const RECENT = 20;
const MS_PER_HOUR = 3_600_000;

/** A cadence setting's hours, or null for manual. */
function cadenceHours(value: unknown): number | null {
  const match = /^(\d+)h$/.exec(typeof value === 'string' ? value : '');
  return match ? Number(match[1]) : null;
}

function lastCompleted(jobs: JobMetadata[]): JobMetadata | undefined {
  return jobs
    .filter((j) => j.status === 'completed')
    .sort((a, b) => (b.endTime ?? b.startTime).localeCompare(a.endTime ?? a.startTime))[0];
}

function Row({ kind, cadence }: { kind: (typeof SCHEDULED_KINDS)[number]; cadence: unknown }) {
  const jobs = useQuery({
    queryKey: ['jobs', 'recent', kind.jobType],
    queryFn: () => jobsApi.listJobs({ type: kind.jobType, limit: RECENT }),
  });
  const hours = cadenceHours(cadence);
  const list = jobs.data ?? [];
  const running = list.find((j) => ACTIVE.has(j.status));
  const last = lastCompleted(list);
  const lastAt = last ? new Date(last.endTime ?? last.startTime) : null;
  const nextDue =
    hours === null ? null : lastAt ? new Date(lastAt.getTime() + hours * MS_PER_HOUR) : new Date();
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: 'center', py: 0.75 }}
      data-testid={`schedule-${kind.jobType}`}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 150 }}>
        {kind.label}
      </Typography>
      {jobs.isLoading ? (
        <Skeleton variant="text" width={240} />
      ) : (
        <>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {lastAt ? `Last completed ${lastAt.toLocaleString()}` : 'Never completed'}
            {last?.startedBy ? ` by ${last.startedBy}` : ''}
          </Typography>
          {running ? (
            <Chip size="small" color="info" label="Running now" />
          ) : hours === null ? (
            <Chip size="small" variant="outlined" label="Manual" />
          ) : (
            <Chip
              size="small"
              variant="outlined"
              color={nextDue && nextDue.getTime() <= Date.now() ? 'warning' : 'default'}
              label={
                nextDue && nextDue.getTime() <= Date.now()
                  ? 'Due at the next hourly tick'
                  : `Next due ${nextDue?.toLocaleString()}`
              }
            />
          )}
        </>
      )}
    </Stack>
  );
}

/** `cadences` is the value each schedule setting has now, unsaved changes included. */
export function SchedulesStatus({ cadences }: { cadences: Record<string, unknown> }) {
  return (
    <Box
      sx={{ mt: 1, pt: 1.5, borderTop: 1, borderColor: 'divider' }}
      data-testid="schedules-status"
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Where each run stands
      </Typography>
      {SCHEDULED_KINDS.map((kind) => (
        <Row key={kind.jobType} kind={kind} cadence={cadences[kind.settingKey]} />
      ))}
    </Box>
  );
}
