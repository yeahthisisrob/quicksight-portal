import { Analytics as AnalyticsIcon } from '@mui/icons-material';
import { IconButton, Tooltip, CircularProgress } from '@mui/material';

import { useActivityRefresh } from '../hooks/useActivityRefresh';
import { ActivityRefreshOptions } from '../model/types';

interface ActivityRefreshButtonProps {
  assetTypes: ActivityRefreshOptions['assetTypes'];
  days?: number;
  onRefreshComplete?: () => void;
  tooltipPrefix?: string;
}

export function ActivityRefreshButton({ 
  assetTypes, 
  days = 90,
  onRefreshComplete,
  tooltipPrefix = 'Refresh activity statistics'
}: ActivityRefreshButtonProps) {
  const { refreshing, refreshActivity } = useActivityRefresh();

  const handleRefresh = async () => {
    try {
      await refreshActivity({ assetTypes, days });
      onRefreshComplete?.();
    } catch (_error) {
      // Error already handled in hook
    }
  };

  const tooltipText = refreshing 
    ? 'Refreshing activity statistics...' 
    : `${tooltipPrefix} (may take several minutes)`;

  return (
    <Tooltip title={tooltipText}>
      <span>
        <IconButton 
          onClick={handleRefresh} 
          disabled={refreshing}
          color="primary"
        >
          {refreshing ? <CircularProgress size={24} /> : <AnalyticsIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}