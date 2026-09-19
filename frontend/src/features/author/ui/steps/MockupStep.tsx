/**
 * Step 4 - the result before it exists. The server rewrites the definition
 * exactly as publish would and we draw it, with renamed fields lit up.
 */
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { DefinitionWireframe } from '@/entities/definition';

import type { AuthorFlow } from '../../model/useAuthorFlow';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

type View = 'before' | 'after';

function totals(flow: AuthorFlow) {
  const plan = flow.preview.plan ?? flow.draft.plan;
  const sum = { matched: 0, mapped: 0, suggested: 0, missing: 0 };
  for (const d of plan?.datasets ?? []) {
    sum.matched += d.summary.matched;
    sum.mapped += d.summary.mapped;
    sum.suggested += d.summary.suggested;
    sum.missing += d.summary.missing;
  }
  return sum;
}

export function MockupStep({ flow }: { flow: AuthorFlow }) {
  const [view, setView] = useState<View>('after');
  const { preview, source, draft } = flow;
  const sum = totals(flow);
  const blockers = sum.suggested + sum.missing;
  const renamed = preview.diff?.size ?? 0;

  const model = view === 'after' ? preview.model : source.model;

  return (
    <Stack spacing={2.5}>
      <Panel
        title="Mockup"
        description="Layout and fields only, drawn from the definition the publish step would write. No data is shown."
        actions={
          <>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={view}
              onChange={(_, next: View | null) => next && setView(next)}
            >
              <ToggleButton value="before">Before</ToggleButton>
              <ToggleButton value="after">After</ToggleButton>
            </ToggleButtonGroup>
            <Button onClick={flow.back}>Back</Button>
            <Button
              variant="contained"
              onClick={flow.next}
              disabled={flow.status.publish === 'locked'}
            >
              Continue to publish
            </Button>
          </>
        }
      >
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            {preview.loading ? (
              <StatusIndicator kind="loading">Building the mockup</StatusIndicator>
            ) : blockers > 0 ? (
              <StatusIndicator kind="warning">
                {blockers} column{blockers === 1 ? '' : 's'} still need a decision
              </StatusIndicator>
            ) : draft.rebinds.length > 0 ? (
              <StatusIndicator kind="success">Every column resolves</StatusIndicator>
            ) : null}
            <Chip size="small" variant="outlined" label={`${sum.matched} matched`} />
            <Chip size="small" variant="outlined" color="info" label={`${sum.mapped} renamed`} />
            {renamed > 0 && (
              <Chip
                size="small"
                color="info"
                label={`${renamed} field${renamed === 1 ? '' : 's'} highlighted`}
              />
            )}
            {sum.missing > 0 && (
              <Chip
                size="small"
                variant="outlined"
                color="error"
                label={`${sum.missing} missing`}
              />
            )}
          </Stack>

          {blockers > 0 && (
            <Alert
              severity="warning"
              action={
                <Button size="small" onClick={() => flow.goTo('review')}>
                  Back to review
                </Button>
              }
            >
              Publishing is blocked until every column is matched or renamed. Suggested renames are
              not applied on their own, so the mockup shows them unchanged.
            </Alert>
          )}

          {preview.error && <Alert severity="error">{preview.error}</Alert>}

          {!source.model && !source.loading && (
            <Alert severity="info">
              No definition is cached for the source yet, so there is nothing to draw. Run an export
              with definitions and come back; publishing still works.
            </Alert>
          )}

          {view === 'after' && preview.loading && !preview.model && (
            <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}

          {model && (
            <Box sx={{ opacity: view === 'after' && preview.loading ? 0.6 : 1 }}>
              <DefinitionWireframe
                model={model}
                diff={view === 'after' ? (preview.diff ?? undefined) : undefined}
              />
            </Box>
          )}

          {view === 'after' && !preview.model && !preview.loading && source.model && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Choose at least one dataset to see the result.
            </Typography>
          )}
        </Stack>
      </Panel>
    </Stack>
  );
}
