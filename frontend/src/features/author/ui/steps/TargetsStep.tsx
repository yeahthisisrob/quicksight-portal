/**
 * Step 2 - for each dataset the source declares, choose what the result
 * should read from: a published SMUS asset (reusing its existing QuickSight
 * dataset, or creating one) or any QuickSight dataset.
 */
import { Close } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { TargetDatasetPicker } from '@/entities/definition';

import type { DefinitionDataset } from '@/shared/api/modules/authoring';

import type { AuthorFlow } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';
import { SmusAssetPicker } from '../SmusAssetPicker';

type TargetTab = 'smus' | 'quicksight';

function IdentifierPanel({ flow, dataset }: { flow: AuthorFlow; dataset: DefinitionDataset }) {
  const [tab, setTab] = useState<TargetTab>('smus');
  const target = flow.draft.targets[dataset.identifier] ?? null;

  return (
    <Panel
      title={dataset.identifier}
      description={
        <>
          Currently reads <code>{dataset.dataSetId}</code> · {dataset.columns.length} column
          {dataset.columns.length === 1 ? '' : 's'} used
          {dataset.calculatedFields.length > 0
            ? ` · ${dataset.calculatedFields.length} calculated field${dataset.calculatedFields.length === 1 ? '' : 's'}`
            : ''}
        </>
      }
      actions={
        target ? (
          <Chip
            color="primary"
            label={`Will read ${target.name}`}
            onDelete={() => flow.draft.setTarget(dataset.identifier, null)}
            deleteIcon={<Close />}
          />
        ) : (
          <StatusIndicator kind="pending">No target yet</StatusIndicator>
        )
      }
    >
      <Tabs value={tab} onChange={(_, next: TargetTab) => setTab(next)} sx={{ mb: 2 }}>
        <Tab value="smus" label="SMUS published assets" />
        <Tab value="quicksight" label="QuickSight datasets" />
      </Tabs>
      {tab === 'smus' ? (
        <SmusAssetPicker
          currentDataSetId={dataset.dataSetId}
          selected={target}
          onSelect={(option) => flow.draft.setTarget(dataset.identifier, option)}
        />
      ) : (
        <TargetDatasetPicker
          value={target}
          onChange={(next) => flow.draft.setTarget(dataset.identifier, next)}
          currentId={dataset.dataSetId}
        />
      )}
    </Panel>
  );
}

export function TargetsStep({ flow }: { flow: AuthorFlow }) {
  const { draft } = flow;

  if (draft.loading) {
    return (
      <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (draft.loadError) {
    return <Alert severity="error">{draft.loadError}</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      {draft.datasets.length === 0 && (
        <Alert severity="info">
          This source declares no datasets, so there is nothing to rebind.
        </Alert>
      )}
      {draft.datasets.map((dataset) => (
        <IdentifierPanel key={dataset.identifier} flow={flow} dataset={dataset} />
      ))}
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          You can also leave targets empty and describe the change in the next step.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={flow.back}>Back</Button>
          <Button variant="contained" onClick={flow.next}>
            Continue
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
