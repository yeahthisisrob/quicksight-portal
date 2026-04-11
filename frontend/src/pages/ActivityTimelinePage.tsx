import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';

import { TimelineFeed, useActivityRefresh } from '@/features/activity';

import { PageLayout } from '@/shared/ui';

/**
 * Global activity timeline — the default landing page for the portal and the
 * top entry in the left nav. Wraps TimelineFeed with a header showing when
 * the activity cache was last refreshed plus a button to trigger a new refresh.
 */
export default function ActivityTimelinePage() {
  const { refreshing, refreshActivity } = useActivityRefresh();

  const handleRefresh = () => {
    refreshActivity({ assetTypes: ['all'], days: 90 });
  };

  return (
    <PageLayout title="Activity Timeline">
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 180px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TimelineFeed
          renderHeader={({ cacheLastUpdated }) => (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                px: 2,
                py: 1.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {cacheLastUpdated ? (
                  <>
                    Last refreshed{' '}
                    <strong>{formatDistanceToNow(new Date(cacheLastUpdated), { addSuffix: true })}</strong>
                    {' '}· CloudTrail has a 5–15 min propagation delay
                  </>
                ) : (
                  'No activity cached yet — refresh to populate the timeline'
                )}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  refreshing ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )
                }
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing…' : 'Refresh activity'}
              </Button>
            </Stack>
          )}
        />
      </Box>
      {refreshing && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Activity refresh queued. The timeline will update automatically when the job completes
          (CloudTrail sweep typically takes 2–10 minutes depending on account activity).
        </Alert>
      )}
    </PageLayout>
  );
}
