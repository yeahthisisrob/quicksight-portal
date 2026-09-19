/**
 * Step 3 - describe the change in words and let the planner fill the form,
 * then review what the server dry run says about every column.
 */
import { AutoAwesome } from '@mui/icons-material';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { ColumnResolutionTable, type RebindMode } from '@/entities/definition';

import type { AuthorFlow } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

function AskPanel({ flow }: { flow: AuthorFlow }) {
  return (
    <Panel
      title="Describe what you want"
      description="The planner picks datasets and column renames from what the account actually has. Everything it proposes lands in the form below, where you can change it."
    >
      <Stack spacing={1.5}>
        <TextField
          multiline
          minRows={2}
          placeholder='e.g. "copy this onto the orders gold dataset" or "switch this to the new customer table in place"'
          value={flow.ask}
          onChange={(e) => flow.setAsk(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void flow.propose();
            }
          }}
          disabled={flow.proposing}
          fullWidth
        />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={
              flow.proposing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />
            }
            onClick={() => void flow.propose()}
            disabled={flow.proposing || !flow.ask.trim()}
          >
            Propose
          </Button>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Enter to send, Shift+Enter for a new line
          </Typography>
        </Stack>
        {flow.proposeError && <Alert severity="error">{flow.proposeError}</Alert>}
        {flow.proposal && (
          <Alert severity={flow.proposal.intent === 'unclear' ? 'warning' : 'success'}>
            <AlertTitle>
              {flow.proposal.intent === 'unclear'
                ? 'The planner could not turn that into a dataset change'
                : `Proposal from ${flow.proposal.model.provider}`}
            </AlertTitle>
            {flow.proposal.reason}
            {flow.proposal.unmapped.length > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Still needs a decision:{' '}
                {flow.proposal.unmapped.map((u) => `${u.column} (${u.reason})`).join('; ')}
              </Typography>
            )}
          </Alert>
        )}
      </Stack>
    </Panel>
  );
}

function ReviewPanel({ flow }: { flow: AuthorFlow }) {
  const { draft } = flow;
  const noun = flow.state.source?.type === 'dashboard' ? 'dashboard' : 'analysis';

  return (
    <Panel
      title="Review"
      description="What will be written, and whether the new datasets can serve every column."
      actions={
        draft.planning ? (
          <StatusIndicator kind="loading">Checking</StatusIndicator>
        ) : draft.rebinds.length === 0 ? (
          <StatusIndicator kind="pending">No datasets chosen</StatusIndicator>
        ) : draft.canApply ? (
          <StatusIndicator kind="success">Ready to publish</StatusIndicator>
        ) : (
          <StatusIndicator kind="warning">Columns need a decision</StatusIndicator>
        )
      }
    >
      <Stack spacing={2.5}>
        <RadioGroup
          row
          value={draft.mode}
          onChange={(e) => draft.setMode(e.target.value as RebindMode)}
        >
          <FormControlLabel
            value="clone"
            control={<Radio size="small" />}
            label={`Create a copy of this ${noun}`}
          />
          <FormControlLabel
            value="update"
            control={<Radio size="small" />}
            label={`Change this ${noun} in place`}
          />
        </RadioGroup>
        <TextField
          label={draft.mode === 'clone' ? 'Name for the copy' : 'Name'}
          value={draft.name}
          onChange={(e) => draft.setName(e.target.value)}
          size="small"
          fullWidth
          helperText={draft.mode === 'update' ? 'Leave as is to keep the current name' : undefined}
        />

        {draft.rebinds.length === 0 && (
          <Alert severity="info">
            Pick datasets in the previous step, or describe the change above and let the planner
            pick them.
          </Alert>
        )}

        {draft.datasets.map((dataset) => {
          const target = draft.targets[dataset.identifier];
          const datasetPlan = draft.plan?.datasets.find((d) => d.identifier === dataset.identifier);
          if (!target) {
            return null;
          }
          const suggestions =
            datasetPlan?.columns.filter((c) => c.status === 'suggested').length ?? 0;
          return (
            <Box key={dataset.identifier}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {dataset.identifier}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  → {target.name}
                </Typography>
                <Box sx={{ flex: 1 }} />
                {datasetPlan && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {datasetPlan.summary.matched} matched · {datasetPlan.summary.mapped} renamed ·{' '}
                    {datasetPlan.summary.suggested} to decide · {datasetPlan.summary.missing}{' '}
                    missing
                  </Typography>
                )}
                {suggestions > 0 && (
                  <Button size="small" onClick={() => draft.acceptSuggestions(dataset.identifier)}>
                    Accept {suggestions} suggestion{suggestions === 1 ? '' : 's'}
                  </Button>
                )}
              </Stack>
              <Divider sx={{ mb: 1 }} />
              {datasetPlan ? (
                <ColumnResolutionTable
                  plan={datasetPlan}
                  columnMap={draft.columnMaps[dataset.identifier] ?? {}}
                  onMap={(from, to) => draft.mapColumn(dataset.identifier, from, to)}
                />
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Checking columns…
                </Typography>
              )}
            </Box>
          );
        })}

        {draft.planError && <Alert severity="error">{draft.planError}</Alert>}

        {draft.mode === 'update' && draft.rebinds.length > 0 && (
          <Alert severity="warning">
            This rewrites the {noun} in place
            {noun === 'dashboard' ? ' and publishes a new version' : ''}. Everyone who uses it will
            see the new dataset.
          </Alert>
        )}

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={flow.back}>Back</Button>
          <Button
            variant="contained"
            onClick={flow.next}
            disabled={flow.status.mockup === 'locked'}
          >
            See the mockup
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}

export function ReviewStep({ flow }: { flow: AuthorFlow }) {
  return (
    <Stack spacing={2.5}>
      <AskPanel flow={flow} />
      <ReviewPanel flow={flow} />
    </Stack>
  );
}
