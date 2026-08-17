import {
  CheckCircleOutline as SuccessIcon,
  ErrorOutline as ErrorIcon,
  HourglassEmpty as ProcessingIcon,
  PauseCircleOutline as StoppedIcon,
  Schedule as QueuedIcon,
} from '@mui/icons-material';
import { Box, Card, Chip, LinearProgress, Stack, Tooltip, Typography, alpha } from '@mui/material';

import { colors } from '@/shared/design-system/theme';

import type { JobStatus } from '@/shared/api/types/export.types';

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
  jobId?: string | null;
}

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; color: string; chipColor: 'success' | 'error' | 'warning' | 'info' | 'default'; icon: React.ElementType }
> = {
  completed: { label: 'Completed', color: colors.status.success, chipColor: 'success', icon: SuccessIcon },
  failed: { label: 'Failed', color: colors.status.error, chipColor: 'error', icon: ErrorIcon },
  stopping: { label: 'Stopping', color: colors.status.warning, chipColor: 'warning', icon: StoppedIcon },
  stopped: { label: 'Stopped', color: colors.status.warning, chipColor: 'warning', icon: StoppedIcon },
  processing: { label: 'Processing', color: colors.status.info, chipColor: 'info', icon: ProcessingIcon },
  queued: { label: 'Queued', color: colors.neutral[500], chipColor: 'default', icon: QueuedIcon },
};

function StatValue({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <Typography variant="caption" color={emphasize ? colors.status.error : 'text.secondary'}>
      <Box component="span" sx={{ fontWeight: 600, color: emphasize ? 'inherit' : 'text.primary' }}>
        {value}
      </Box>
      {' '}
      {label}
    </Typography>
  );
}

/**
 * Live status panel for the current (or a selected historical) export job:
 * status chip, progress bar, message, and processed/failed/API-call stats.
 */
export default function ExportJobStatus({
  status,
  progress,
  message,
  stats,
  jobId,
}: ExportJobStatusProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;
  const StatusIcon = config.icon;
  const isActive = status === 'queued' || status === 'processing' || status === 'stopping';

  return (
    <Card sx={{ border: `1px solid ${alpha(config.color, 0.3)}` }}>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <StatusIcon sx={{ fontSize: 20, color: config.color }} />
          <Tooltip title={jobId ? `Job ${jobId}` : ''}>
            <Chip
              label={config.label}
              size="small"
              color={config.chipColor}
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
          </Tooltip>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
            {message || '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {Math.round(progress)}%
          </Typography>
        </Stack>

        <LinearProgress
          variant={isActive && progress === 0 ? 'indeterminate' : 'determinate'}
          value={Math.min(progress, 100)}
          sx={{
            mt: 1,
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(config.color, 0.12),
            '& .MuiLinearProgress-bar': { bgcolor: config.color, borderRadius: 3 },
          }}
        />

        {stats && (stats.totalAssets !== undefined || stats.processedAssets !== undefined) && (
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <StatValue
              label="assets processed"
              value={`${(stats.processedAssets || 0).toLocaleString()} / ${(stats.totalAssets || 0).toLocaleString()}`}
            />
            {(stats.failedAssets || 0) > 0 && (
              <StatValue label="failed" value={(stats.failedAssets || 0).toLocaleString()} emphasize />
            )}
            {stats.apiCalls !== undefined && (
              <StatValue label="API calls" value={stats.apiCalls.toLocaleString()} />
            )}
          </Stack>
        )}
      </Box>
    </Card>
  );
}
