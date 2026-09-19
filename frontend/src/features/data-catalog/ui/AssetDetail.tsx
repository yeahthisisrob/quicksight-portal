import { OpenInNew } from '@mui/icons-material';
import { Alert, AlertTitle, Box, Button, Chip, Skeleton, Stack, Typography } from '@mui/material';

import type { SmusCatalogAsset } from '@/shared/api/modules/data-catalog';
import { Container, EmptyState } from '@/shared/design-system';

import { FromSmusSection } from './FromSmusSection';
import { InQuickSightSection } from './InQuickSightSection';

interface AssetDetailProps {
  asset?: SmusCatalogAsset;
  loading?: boolean;
  error?: string | null;
}

function DetailSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" height={96} />
      <Skeleton variant="rounded" height={160} />
      <Skeleton variant="rounded" height={240} />
    </Stack>
  );
}

/** The right pane: the asset header, then what SMUS owns, then what QuickSight adds. */
export function AssetDetail({ asset, loading, error }: AssetDetailProps) {
  if (loading) return <DetailSkeleton />;
  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>The asset could not be loaded</AlertTitle>
        {error}
      </Alert>
    );
  }
  if (!asset) {
    return (
      <Box sx={{ py: 8 }}>
        <EmptyState
          title="Pick a published asset"
          description="Its glossary terms, metadata forms and columns come from SMUS; the datasets, calculated fields and usage come from QuickSight."
        />
      </Box>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Container
        header={asset.name}
        description={asset.description}
        actions={
          asset.url ? (
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNew fontSize="small" />}
              href={asset.url}
              target="_blank"
              rel="noopener"
            >
              Open in SMUS
            </Button>
          ) : undefined
        }
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {asset.projectName && <Chip size="small" label={asset.projectName} />}
          {asset.table && (
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {asset.table.catalog ? `${asset.table.catalog}.` : ''}
              {asset.table.database}.{asset.table.name}
            </Typography>
          )}
          <Chip size="small" variant="outlined" label={`${asset.columnCount} columns`} />
          <Chip
            size="small"
            variant="outlined"
            label={`${asset.datasets.length} QuickSight ${asset.datasets.length === 1 ? 'dataset' : 'datasets'}`}
          />
          {asset.updatedAt && (
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
              Updated {new Date(asset.updatedAt).toLocaleDateString()}
            </Typography>
          )}
        </Stack>
      </Container>

      <FromSmusSection asset={asset} />
      <InQuickSightSection asset={asset} />
    </Stack>
  );
}
