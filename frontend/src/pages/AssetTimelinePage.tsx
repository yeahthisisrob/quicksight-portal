import { ArrowBack } from '@mui/icons-material';
import { Alert, Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { type TimelineAssetType, TimelineFeed } from '@/features/activity';

import { Container, PageHeader } from '@/shared/design-system';
import TypedChip, { type ChipType } from '@/shared/ui/TypedChip';

/** Plural URL segment → singular asset type expected by the backend. */
const PLURAL_TO_SINGULAR: Record<string, TimelineAssetType> = {
  dashboards: 'dashboard',
  analyses: 'analysis',
  datasets: 'dataset',
  datasources: 'datasource',
  folders: 'folder',
  groups: 'group',
  users: 'user',
};

const CHIP_TYPE: Record<TimelineAssetType, ChipType> = {
  dashboard: 'DASHBOARD',
  analysis: 'ANALYSIS',
  dataset: 'DATASET',
  datasource: 'DATASOURCE',
  folder: 'FOLDER',
  group: 'GROUP',
  user: 'USER',
};

const FEED_HEIGHT = 'calc(100vh - 220px)';

/**
 * One asset's history: the global feed pinned to it, with the asset named
 * in the header once the first page says what it is called.
 */
export default function AssetTimelinePage() {
  const navigate = useNavigate();
  const { type, id } = useParams<{ type: string; id: string }>();
  const [assetName, setAssetName] = useState<string | undefined>();

  const singular = type ? PLURAL_TO_SINGULAR[type] : undefined;

  if (!singular || !id) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <PageHeader title="Activity" />
        <Alert severity="error">
          Invalid asset path. Expected /assets/:type/:id/timeline where :type is one of{' '}
          {Object.keys(PLURAL_TO_SINGULAR).join(', ')}.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
      <PageHeader
        breadcrumbs={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate(`/assets/${type}`)}
              size="small"
              sx={{ ml: -1 }}
            >
              Back to {type}
            </Button>
            <TypedChip type={CHIP_TYPE[singular]} size="small" />
          </Box>
        }
        title={assetName ?? id}
        description={
          <Typography component="code" variant="caption">
            {id}
          </Typography>
        }
      />
      <Container disableContentPadding sx={{ maxHeight: FEED_HEIGHT }}>
        <TimelineFeed
          assetPin={{ assetType: singular, assetId: id }}
          onFirstPage={(ctx) => setAssetName(ctx.firstAssetName)}
        />
      </Container>
    </Box>
  );
}
