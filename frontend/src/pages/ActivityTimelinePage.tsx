import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Box, Button, Stack } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { TimelineFeed } from '@/features/activity';

import { Container, PageHeader, StatusIndicator } from '@/shared/design-system';

/** The feed keeps this much room for the page header and padding. */
const FEED_HEIGHT = 'calc(100vh - 200px)';

/**
 * Every change to the account's QuickSight assets, from CloudTrail, with
 * the portal's own writes attributed to the person or the API key behind
 * them. The default landing page.
 */
export default function ActivityTimelinePage() {
  const [cacheLastUpdated, setCacheLastUpdated] = useState<string | undefined>();

  return (
    <Box sx={{ minWidth: 0 }}>
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
              variant="text"
              component={RouterLink}
              to="/operations?tab=activity"
              startIcon={<RefreshIcon />}
            >
              Refresh runs in Operations
            </Button>
          </Stack>
        }
      />
      <Container disableContentPadding sx={{ maxHeight: FEED_HEIGHT }}>
        <TimelineFeed onFirstPage={(ctx) => setCacheLastUpdated(ctx.cacheLastUpdated)} />
      </Container>
    </Box>
  );
}
