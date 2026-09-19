/**
 * From nothing, step 1 - the datasets the new dashboard or analysis reads.
 * Each gets an identifier (a slug of its name, editable) that the visuals
 * address its columns by; the columns come from the cached export.
 */
import { Close } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { TargetDatasetPicker } from '@/entities/definition';

import { EmptyState } from '@/shared/design-system';

import type { NewAssetDataset } from '../../model/newAsset';
import type { AuthorFlow } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';
import { SmusAssetPicker } from '../SmusAssetPicker';

type PickerTab = 'smus' | 'quicksight';

const IDENTIFIER_WIDTH = 220;
const COLUMN_CHIPS = 8;

function DatasetCard({ flow, dataset }: { flow: AuthorFlow; dataset: NewAssetDataset }) {
  const [identifier, setIdentifier] = useState(dataset.identifier);
  const columns = flow.fresh.columns[dataset.identifier];
  const commit = () => flow.fresh.setIdentifier(dataset.identifier, identifier);
  const usedBy = flow.fresh.visuals.filter((v) => v.identifier === dataset.identifier).length;

  return (
    <Box
      data-testid={`fresh-dataset-${dataset.dataSetId}`}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: `minmax(0, 1fr) ${IDENTIFIER_WIDTH}px auto` },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
          {dataset.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block' }}
        >
          {dataset.dataSetId}
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}
        >
          {columns?.loading ? (
            <StatusIndicator kind="loading">Reading columns</StatusIndicator>
          ) : columns && columns.columns.length > 0 ? (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
                {columns.columns.length} column{columns.columns.length === 1 ? '' : 's'}
              </Typography>
              {columns.columns.slice(0, COLUMN_CHIPS).map((c) => (
                <Tooltip key={c.name} title={c.type}>
                  <Chip size="small" variant="outlined" label={c.name} sx={{ height: 20 }} />
                </Tooltip>
              ))}
              {columns.columns.length > COLUMN_CHIPS && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  +{columns.columns.length - COLUMN_CHIPS} more
                </Typography>
              )}
            </>
          ) : (
            <StatusIndicator kind="warning">
              Not in the export cache yet: type column names by hand on the next step
            </StatusIndicator>
          )}
        </Stack>
      </Box>
      <TextField
        size="small"
        label="Identifier"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
          }
        }}
        helperText={
          usedBy > 0
            ? `${usedBy} visual${usedBy === 1 ? '' : 's'} read it by this name`
            : 'How the visuals name this dataset'
        }
        slotProps={{ htmlInput: { 'data-testid': 'fresh-identifier' } }}
      />
      <Button
        size="small"
        startIcon={<Close />}
        onClick={() => flow.fresh.removeDataset(dataset.identifier)}
        aria-label={`Remove ${dataset.name}`}
      >
        Remove
      </Button>
    </Box>
  );
}

export function NewDatasetsStep({ flow }: { flow: AuthorFlow }) {
  const [tab, setTab] = useState<PickerTab>('smus');
  const { fresh } = flow;
  const chosen = fresh.datasets;

  return (
    <Stack spacing={2.5}>
      <Panel
        title="Datasets"
        description="What the new one reads from. Add one or more; each dataset's columns become the choices on the Visuals step."
        actions={
          chosen.length > 0 ? (
            <StatusIndicator kind="success">
              {chosen.length} dataset{chosen.length === 1 ? '' : 's'}
            </StatusIndicator>
          ) : (
            <StatusIndicator kind="pending">None yet</StatusIndicator>
          )
        }
      >
        {chosen.length === 0 ? (
          <EmptyState
            compact
            title="No dataset chosen"
            description="Pick a published SMUS asset below, or any QuickSight dataset."
          />
        ) : (
          <Stack spacing={1.5}>
            {chosen.map((dataset) => (
              <DatasetCard key={dataset.dataSetId} flow={flow} dataset={dataset} />
            ))}
          </Stack>
        )}
      </Panel>

      <Panel
        title="Add a dataset"
        description="Published SMUS assets first, reusing the QuickSight dataset that already reads them."
      >
        <Tabs value={tab} onChange={(_, next: PickerTab) => setTab(next)} sx={{ mb: 2 }}>
          <Tab value="smus" label="SMUS published assets" />
          <Tab value="quicksight" label="QuickSight datasets" />
        </Tabs>
        {tab === 'smus' ? (
          <SmusAssetPicker currentDataSetId="" selected={null} onSelect={fresh.addDataset} />
        ) : (
          <TargetDatasetPicker
            value={null}
            onChange={(next) => next && fresh.addDataset(next)}
            helperText="Picking one adds it above; the box clears for the next"
          />
        )}
      </Panel>

      {chosen.length > 1 && (
        <Alert severity="info">
          Each visual reads one dataset. Filters that span datasets apply by column name; the mockup
          says which datasets a filter cannot reach.
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={flow.reset}>Start over</Button>
        <Button variant="contained" onClick={flow.next} disabled={chosen.length === 0}>
          Continue to visuals
        </Button>
      </Stack>
    </Stack>
  );
}
