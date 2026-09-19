import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Box, Button, CircularProgress, Stack } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

import { ActivityRefreshProgress, TimelineFeed, useActivityRefresh } from '@/features/activity';

import { Container, PageHeader, StatusIndicator } from '@/shared/design-system';

/** The feed keeps this much room for the page header and padding. */
const FEED_HEIGHT = 'calc(100vh - 200px)';
const REFRESH_DAYS = 90;
const SPINNER_SIZE = 14;

/**
 * Every change to the account's QuickSight assets, from CloudTrail, with
 * the portal's own writes attributed to the person or the API key behind
 * them. The default landing page.
 */
export default function ActivityTimelinePage() {
  const { refreshing, refreshActivity, jobStatus } = useActivityRefresh();
  const [cacheLastUpdated, setCacheLastUpdated] = useState<string | undefined>();

  const showProgress =
    refreshing ||
    jobStatus?.status === 'completed' ||
    jobStatus?.status === 'failed' ||
    jobStatus?.status === 'stopped';

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <PageHeader
        title="Activity"
        description="Who changed what, from where, and when. Portal changes name the person or the API key behind them; console changes name the person."
        actions={
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            {cacheLastUpdated ? (
              <StatusIndicator type="success" size="small">
                Refreshed {formatDistanceToNow(new Date(cacheLastUpdated), { addSuffix: true })}
              </StatusIndicator>
            ) : (
              <StatusIndicator type="pending" size="small">
                Not refreshed yet
              </StatusIndicator>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={
                refreshing ? (
                  <CircularProgress size={SPINNER_SIZE} color="inherit" />
                ) : (
                  <RefreshIcon />
                )
              }
              onClick={() => refreshActivity({ assetTypes: ['all'], days: REFRESH_DAYS })}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh from CloudTrail'}
            </Button>
          </Stack>
        }
      />
      <Container disableContentPadding sx={{ maxHeight: FEED_HEIGHT }}>
        <TimelineFeed onFirstPage={(ctx) => setCacheLastUpdated(ctx.cacheLastUpdated)} />
      </Container>
      {showProgress && (
        <Box sx={{ mt: 2 }}>
          <ActivityRefreshProgress jobStatus={jobStatus} />
        </Box>
      )}
    </Box>
  );
}
