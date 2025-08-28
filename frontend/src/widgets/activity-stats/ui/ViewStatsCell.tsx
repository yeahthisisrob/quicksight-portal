import { Analytics as AnalyticsIcon } from '@mui/icons-material';
import { IconButton, Tooltip, Skeleton, Box } from '@mui/material';

import { useActivityData, type ActivityData } from '@/features/activity';

interface ViewStatsCellProps {
  assetType: 'dashboard' | 'analysis';
  assetId: string;
  onViewDetails?: (activity: ActivityData) => void;
}

export function ViewStatsCell({ assetType, assetId, onViewDetails }: ViewStatsCellProps) {
  const { data: activity, isLoading } = useActivityData(assetType, assetId);

  if (isLoading) {
    return <Skeleton variant="circular" width={40} height={40} />;
  }

  if (!activity || !('totalViews' in activity) || activity.totalViews === 0) {
    return <Box sx={{ textAlign: 'center' }}>-</Box>;
  }

  const activityData = activity as ActivityData;

  return (
    <Tooltip 
      title={`${activityData.totalViews} views by ${activityData.uniqueViewers} users`}
      placement="top"
    >
      <IconButton
        size="small"
        onClick={() => onViewDetails?.(activityData)}
        sx={{ 
          '&:hover': { 
            backgroundColor: 'action.hover',
            '& .MuiSvgIcon-root': {
              color: 'primary.main'
            }
          }
        }}
      >
        <AnalyticsIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}