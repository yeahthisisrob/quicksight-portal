import {
  Cancel,
  CheckCircle,
  CloudQueue,
  Error as ErrorIcon,
  HourglassEmpty,
} from '@mui/icons-material';
import { alpha, Chip } from '@mui/material';

import { colors } from '@/shared/design-system/theme';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  RUNNING: { label: 'Running', color: colors.status.info, icon: HourglassEmpty },
  COMPLETED: { label: 'Completed', color: colors.status.success, icon: CheckCircle },
  FAILED: { label: 'Failed', color: colors.status.error, icon: ErrorIcon },
  CANCELLED: { label: 'Cancelled', color: colors.neutral[500], icon: Cancel },
  INITIALIZED: { label: 'Initialized', color: colors.neutral[400], icon: CloudQueue },
  QUEUED: { label: 'Queued', color: colors.status.warning, icon: CloudQueue },
};

interface IngestionStatusChipProps {
  status: string;
}

/** Colored status chip for an ingestion run. Falls back to the raw status text. */
export function IngestionStatusChip({ status }: IngestionStatusChipProps) {
  const config = statusConfig[status];
  if (!config) return <>{status}</>;
  const StatusIcon = config.icon;
  return (
    <Chip
      icon={<StatusIcon sx={{ fontSize: 16 }} />}
      label={config.label}
      size="small"
      sx={{
        backgroundColor: alpha(config.color, 0.1),
        color: config.color,
        '& .MuiChip-icon': { color: config.color },
      }}
    />
  );
}
