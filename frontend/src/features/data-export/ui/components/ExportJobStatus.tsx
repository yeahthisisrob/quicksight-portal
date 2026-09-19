import { Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';

import type { JobStatus } from '@/shared/api/types/export.types';
import { Container, StatusIndicator, type StatusType } from '@/shared/design-system';

interface ExportJobStatusProps {
  status: JobStatus;
  progress: number;
  message?: string;
  stats?: {
    totalAssets?: number;
    processedAssets?: number;
    failedAssets?: number;
    apiCalls?: number;
  };
  /** Job heartbeat, stamped on every worker write; drives the liveness line. */
  lastUpdatedTime?: string;
  /** Resumable-export progress, drives the per-asset-type chips. */
  checkpoint?: {
    completedAssetTypes?: string[];
    catalogPending?: boolean;
  };
  jobId?: string | null;
}

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HEARTBEAT_QUIET_MS = 90 * SECOND_MS;
const HEARTBEAT_STALLED_MS = 5 * MINUTE_S * SECOND_MS;
const PROGRESS_MAX = 100;

const STATUS_TONE: Record<JobStatus, { type: StatusType; label: string }> = {
  completed: { type: 'success', label: 'Completed' },
  failed: { type: 'error', label: 'Failed' },
  stopping: { type: 'warning', label: 'Stopping' },
  stopped: { type: 'stopped', label: 'Stopped' },
  processing: { type: 'in-progress', label: 'Processing' },
  queued: { type: 'pending', label: 'Queued' },
};

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / SECOND_MS);
  if (seconds < MINUTE_S) return `${seconds}s`;
  const minutes = Math.floor(seconds / MINUTE_S);
  if (minutes < MINUTE_S) return `${minutes}m`;
  return `${Math.floor(minutes / MINUTE_S)}h ${minutes % MINUTE_S}m`;
}

/**
 * Whether the worker is still writing, from the job heartbeat. Re-renders
 * with each status poll, so the age stays fresh at poll granularity.
 */
function Heartbeat({ lastUpdatedTime }: { lastUpdatedTime: string }) {
  const ageMs = Date.now() - new Date(lastUpdatedTime).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return null;

  if (ageMs >= HEARTBEAT_STALLED_MS) {
    return (
      <StatusIndicator type="error" size="small">
        No heartbeat for {formatAge(ageMs)}; the worker may have died (auto-fails after 30m)
      </StatusIndicator>
    );
  }
  if (ageMs >= HEARTBEAT_QUIET_MS) {
    return (
      <StatusIndicator type="warning" size="small">
        Worker quiet for {formatAge(ageMs)}
      </StatusIndicator>
    );
  }
  return (
    <StatusIndicator type="success" size="small">
      Worker active {formatAge(ageMs)} ago
    </StatusIndicator>
  );
}

/** Per-asset-type progress from the export checkpoint, no log parsing. */
function CheckpointProgress({
  checkpoint,
  isActive,
}: {
  checkpoint: NonNullable<ExportJobStatusProps['checkpoint']>;
  isActive: boolean;
}) {
  const completed = checkpoint.completedAssetTypes || [];
  if (completed.length === 0 && !checkpoint.catalogPending) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        Asset types done:
      </Typography>
      {completed.map((type) => (
        <Chip key={type} label={type} size="small" variant="outlined" color="success" />
      ))}
      {checkpoint.catalogPending && isActive && (
        <Chip label="catalog rebuild pending" size="small" variant="outlined" color="info" />
      )}
    </Stack>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <Typography variant="caption" color={emphasize ? 'error' : 'text.secondary'}>
      <Box component="span" sx={{ fontWeight: 600, color: emphasize ? 'inherit' : 'text.primary' }}>
        {value}
      </Box>{' '}
      {label}
    </Typography>
  );
}

/**
 * The current (or a selected past) export job: status, progress, message,
 * processed/failed/API-call counts, checkpoint and worker liveness.
 */
export default function ExportJobStatus({
  status,
  progress,
  message,
  stats,
  lastUpdatedTime,
  checkpoint,
  jobId,
}: ExportJobStatusProps) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.queued;
  const isActive = status === 'queued' || status === 'processing' || status === 'stopping';
  const value = Math.min(progress, PROGRESS_MAX);

  return (
    <Container>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Tooltip title={jobId ? `Job ${jobId}` : ''}>
            <span>
              <StatusIndicator type={tone.type}>{tone.label}</StatusIndicator>
            </span>
          </Tooltip>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
            {message || ''}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {Math.round(value)}%
          </Typography>
        </Stack>

        <LinearProgress
          variant={isActive && value === 0 ? 'indeterminate' : 'determinate'}
          value={value}
          color={tone.type === 'error' ? 'error' : tone.type === 'success' ? 'success' : 'primary'}
        />

        {stats && (stats.totalAssets !== undefined || stats.processedAssets !== undefined) && (
          <Stack direction="row" spacing={2}>
            <Stat
              label="assets processed"
              value={`${(stats.processedAssets || 0).toLocaleString()} / ${(stats.totalAssets || 0).toLocaleString()}`}
            />
            {(stats.failedAssets || 0) > 0 && (
              <Stat label="failed" value={(stats.failedAssets || 0).toLocaleString()} emphasize />
            )}
            {stats.apiCalls !== undefined && (
              <Stat label="API calls" value={stats.apiCalls.toLocaleString()} />
            )}
          </Stack>
        )}

        {checkpoint && <CheckpointProgress checkpoint={checkpoint} isActive={isActive} />}

        {isActive && lastUpdatedTime && <Heartbeat lastUpdatedTime={lastUpdatedTime} />}
      </Stack>
    </Container>
  );
}
