/**
 * Data - the datasets the open asset reads and, when SMUS is configured,
 * which of them a published SMUS asset governs (moving the rest onto
 * governed datasets is a rebind, which the Assistant plans); then how the
 * asset is used: views, viewers, load times.
 */
import { Storage } from '@mui/icons-material';
import { Alert, Box, Button, Chip, Divider, Skeleton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { SmusLinkBadge } from '@/entities/smus';

import type { Studio, StudioDataset } from '../../model/useStudio';
import { InsightsCard } from '../InsightsCard';

function DatasetRow({
  dataset,
  smusConfigured,
}: {
  dataset: StudioDataset;
  smusConfigured: boolean;
}) {
  const governed = dataset.smus?.linked === true;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', py: 1.25 }}>
      <Storage fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {dataset.identifier}
          </Typography>
          {dataset.smus && <SmusLinkBadge link={dataset.smus} />}
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
          {dataset.dataSetId} · {dataset.columns} column{dataset.columns === 1 ? '' : 's'} read
          {dataset.calculatedFields > 0
            ? ` · ${dataset.calculatedFields} calculated field${dataset.calculatedFields === 1 ? '' : 's'}`
            : ''}
        </Typography>
        {governed && dataset.smus?.listingName && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
            Governed by {dataset.smus.listingName}
          </Typography>
        )}
      </Box>
      {smusConfigured && dataset.smus && !governed && (
        <Chip size="small" variant="outlined" color="warning" label="Not governed" />
      )}
    </Stack>
  );
}

export function DataPanel({ studio }: { studio: Studio }) {
  const { datasets, loading, smusConfigured } = studio.data;
  if (loading && datasets.length === 0) {
    return <Skeleton variant="rounded" height={96} />;
  }
  const ungoverned = datasets.filter((d) => d.smus && !d.smus.linked).length;
  return (
    <Stack spacing={2} data-testid="data-panel">
      {datasets.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          The definition reads no datasets.
        </Typography>
      ) : (
        <Box>
          {datasets.map((dataset, index) => (
            <Box key={dataset.identifier}>
              {index > 0 && <Divider />}
              <DatasetRow dataset={dataset} smusConfigured={smusConfigured} />
            </Box>
          ))}
        </Box>
      )}
      {!smusConfigured ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Configure SageMaker Unified Studio in Settings to see which of these datasets a published
          SMUS asset governs.
        </Typography>
      ) : ungoverned > 0 ? (
        <Alert severity="info">
          {ungoverned} dataset{ungoverned === 1 ? ' is' : 's are'} not backed by a SMUS asset.
          Moving onto governed datasets is a rebind; the Assistant plans it and shows the columns
          before anything is written.
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              component={RouterLink}
              to="/author?tab=assistant"
            >
              Ask the Assistant
            </Button>
          </Box>
        </Alert>
      ) : datasets.length > 0 ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Every dataset here is governed in SMUS.
        </Typography>
      ) : null}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Usage
        </Typography>
        <InsightsCard insights={studio.insights} />
      </Box>
    </Stack>
  );
}
