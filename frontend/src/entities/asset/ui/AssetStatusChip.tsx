import { 
  CheckCircle as ActiveIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { Chip } from '@mui/material';

interface AssetStatusChipProps {
  status?: string;
  size?: 'small' | 'medium';
}

export function AssetStatusChip({ status, size = 'small' }: AssetStatusChipProps) {
  const getConfig = () => {
    switch (status?.toUpperCase()) {
      case 'CREATION_SUCCESSFUL':
      case 'UPDATE_SUCCESSFUL':
      case 'ACTIVE':
        return {
          label: 'Active',
          color: 'success' as const,
          icon: <ActiveIcon fontSize="small" />,
        };
      case 'CREATION_FAILED':
      case 'UPDATE_FAILED':
      case 'FAILED':
        return {
          label: 'Failed',
          color: 'error' as const,
          icon: <ErrorIcon fontSize="small" />,
        };
      case 'CREATION_IN_PROGRESS':
      case 'UPDATE_IN_PROGRESS':
        return {
          label: 'In Progress',
          color: 'warning' as const,
          icon: <ScheduleIcon fontSize="small" />,
        };
      default:
        return {
          label: status || 'Unknown',
          color: 'default' as const,
          icon: undefined,
        };
    }
  };

  const config = getConfig();

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      icon={config.icon}
      variant="outlined"
    />
  );
}