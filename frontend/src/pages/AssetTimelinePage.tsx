import { ArrowBack } from '@mui/icons-material';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

import { TimelineFeed, type TimelineAssetType } from '@/features/activity';

import { PageLayout } from '@/shared/ui';

/**
 * Plural URL segment → singular TimelineAssetType expected by the backend.
 * Matches the mapping in AssetsPage's assetConfigs.
 */
const PLURAL_TO_SINGULAR: Record<string, TimelineAssetType> = {
  dashboards: 'dashboard',
  analyses: 'analysis',
  datasets: 'dataset',
  datasources: 'datasource',
  folders: 'folder',
  groups: 'group',
  users: 'user',
};

/**
 * Per-asset activity timeline — reached from the "View Timeline" entry in the
 * asset table's 3-dot menu. Reuses the global TimelineFeed, pinned via
 * assetPin so the feed only shows events for this specific asset.
 */
export default function AssetTimelinePage() {
  const navigate = useNavigate();
  const { type, id } = useParams<{ type: string; id: string }>();

  const singular = type ? PLURAL_TO_SINGULAR[type] : undefined;

  if (!singular || !id) {
    return (
      <PageLayout title="Activity Timeline">
        <Alert severity="error">
          Invalid asset path. Expected /assets/:type/:id/timeline where :type is one of{' '}
          {Object.keys(PLURAL_TO_SINGULAR).join(', ')}.
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Activity Timeline">
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(`/assets/${type}`)}
            size="small"
          >
            Back to {type}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {singular}: <code>{id}</code>
          </Typography>
        </Box>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            maxHeight: 'calc(100vh - 240px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <TimelineFeed assetPin={{ assetType: singular, assetId: id }} />
        </Box>
      </Stack>
    </PageLayout>
  );
}
