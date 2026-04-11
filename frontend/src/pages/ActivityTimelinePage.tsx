import { Box } from '@mui/material';

import { TimelineFeed } from '@/features/activity';

import { PageLayout } from '@/shared/ui';

/**
 * Global activity timeline — a top-level page reachable from the left nav.
 * The same TimelineFeed also lives inside the Export page's "Timeline" tab
 * and the per-asset drill-down at /assets/:type/:id/timeline.
 */
export default function ActivityTimelinePage() {
  return (
    <PageLayout title="Activity Timeline">
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 200px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <TimelineFeed />
      </Box>
    </PageLayout>
  );
}
