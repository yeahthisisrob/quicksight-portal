/**
 * Step 4 - the result before it exists, and the place to shape it. The
 * server rewrites the definition exactly as publish would and we draw it;
 * on the After view every card is clickable and the inspector edits it.
 * Every change is listed in plain language beneath the drawing.
 */
import { Redo, Undo } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import { DefinitionWireframe, removedOnly, summarizeDiff } from '@/entities/definition';

import { SegmentedControl } from '@/shared/design-system';

import { outlineFromModel } from '../../lib/ops';
import type { AuthorFlow } from '../../model/useAuthorFlow';
import { ChangesList } from '../ChangesList';
import { Inspector } from '../mockup/Inspector';
import { OpsList } from '../mockup/OpsList';
import { Panel } from '../primitives/Panel';
import { StatusIndicator } from '../primitives/StatusIndicator';

type View = 'before' | 'after';

const INSPECTOR_WIDTH = 320;

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

const SUMMARY_LABELS: Record<string, string> = {
  renamed: 'field renamed',
  moved: 'moved',
  resized: 'resized',
  retyped: 'retyped',
  added: 'added',
  removed: 'removed',
};

function DiffChips({ flow }: { flow: AuthorFlow }) {
  const summary = summarizeDiff(flow.preview.diff ?? undefined);
  return (
    <>
      {Object.entries(summary)
        .filter(([, n]) => n > 0)
        .map(([kind, n]) => (
          <Chip
            key={kind}
            size="small"
            color={kind === 'removed' ? 'error' : 'info'}
            variant={kind === 'renamed' ? 'filled' : 'outlined'}
            label={`${n} ${SUMMARY_LABELS[kind] ?? kind}${n === 1 || kind !== 'renamed' ? '' : 's'}`}
          />
        ))}
    </>
  );
}

export function MockupStep({ flow }: { flow: AuthorFlow }) {
  const [view, setView] = useState<View>('after');
  const { preview, source, draft, state } = flow;
  // From nothing there is no Before, nothing to diff, and the visuals are
  // shaped on their own step rather than in the inspector.
  const fromNothing = state.mode === 'new';
  const sum = totals(flow);
  const blockers = sum.suggested + sum.missing;

  const afterModel = preview.model ?? source.model;
  const model = view === 'after' || fromNothing ? afterModel : source.model;
  // The source outline names elements as they were, so the edits list reads
  // "Retitle 'Revenue by region'" rather than repeating the new title.
  const sourceOutline = useMemo(
    () => (source.model ? outlineFromModel(source.model) : []),
    [source.model]
  );
  const outline = preview.outline ?? sourceOutline;
  const [sheetId, setSheetId] = useState<string | undefined>(undefined);
  const currentSheetId = sheetId ?? outline[0]?.sheetId ?? model?.sheets[0]?.id ?? '';
  const editing = view === 'after' && model !== null && !fromNothing;
  const visualCount = fromNothing ? flow.fresh.visuals.filter((v) => v.title.trim()).length : 0;

  return (
    <Stack spacing={2.5}>
      {preview.warnings.length > 0 && (
        <Alert severity="warning" data-testid="mockup-warnings">
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Not everything could be carried over
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {preview.warnings.map((warning) => (
              <li key={warning}>
                <Typography variant="body2">{warning}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}
      <Panel
        title="Mockup"
        description={
          fromNothing
            ? 'Layout and fields only, drawn from the definition the publish step would write. Change the visuals on the Visuals step, the layout on the Standard step.'
            : 'Layout and fields only, drawn from the definition the publish step would write. On the After view, click any card to edit it.'
        }
        actions={
          <>
            {!fromNothing && (
              <SegmentedControl<View>
                size="small"
                ariaLabel="Before or after"
                value={view}
                onChange={setView}
                options={[
                  { value: 'before', label: 'Before' },
                  { value: 'after', label: 'After' },
                ]}
              />
            )}
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
            ) : fromNothing ? (
              <StatusIndicator kind={preview.error ? 'warning' : 'success'}>
                {visualCount} visual{visualCount === 1 ? '' : 's'} on {flow.fresh.datasets.length}{' '}
                dataset{flow.fresh.datasets.length === 1 ? '' : 's'}
              </StatusIndicator>
            ) : blockers > 0 ? (
              <StatusIndicator kind="warning">
                {blockers} column{blockers === 1 ? '' : 's'} still need a decision
              </StatusIndicator>
            ) : draft.rebinds.length > 0 ? (
              <StatusIndicator kind="success">Every column resolves</StatusIndicator>
            ) : state.ops.length > 0 ? (
              <StatusIndicator kind="info">
                {state.ops.length} edit{state.ops.length === 1 ? '' : 's'}
              </StatusIndicator>
            ) : (
              <StatusIndicator kind="pending">Nothing changed yet</StatusIndicator>
            )}
            {draft.rebinds.length > 0 && (
              <>
                <Chip size="small" variant="outlined" label={`${sum.matched} matched`} />
                <Chip
                  size="small"
                  variant="outlined"
                  color="info"
                  label={`${sum.mapped} renamed`}
                />
              </>
            )}
            {sum.missing > 0 && (
              <Chip
                size="small"
                variant="outlined"
                color="error"
                label={`${sum.missing} missing`}
              />
            )}
            <DiffChips flow={flow} />
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

          {!fromNothing && !source.model && !source.loading && (
            <Alert severity="info">
              No definition is cached for the source yet, so there is nothing to draw or edit. Run
              an export with definitions and come back; publishing still works.
            </Alert>
          )}

          {(view === 'after' || fromNothing) && preview.loading && !model && (
            <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}

          {model && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: editing
                  ? { xs: '1fr', lg: `minmax(0, 1fr) ${INSPECTOR_WIDTH}px` }
                  : '1fr',
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box sx={{ minWidth: 0, opacity: view === 'after' && preview.loading ? 0.6 : 1 }}>
                <DefinitionWireframe
                  model={model}
                  sheetId={currentSheetId}
                  onSheetChange={setSheetId}
                  diff={
                    view === 'after'
                      ? (preview.diff ?? undefined)
                      : removedOnly(preview.diff ?? undefined)
                  }
                  badges={view === 'before' ? flow.healthBadges : undefined}
                  selectedId={editing ? state.selectedElement?.elementId : undefined}
                  onSelect={
                    editing
                      ? (elementId) => flow.selectElement({ sheetId: currentSheetId, elementId })
                      : undefined
                  }
                />
                {view === 'before' && flow.healthBadges.size > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', mt: 1, display: 'block' }}
                  >
                    Flagged visuals are slow (p90 over 3 s) or failing to load in the source.
                    Consider retyping or removing them before you publish.
                  </Typography>
                )}
              </Box>
              {editing && (
                <Inspector
                  outline={outline}
                  sheetId={currentSheetId}
                  selected={state.selectedElement}
                  onOps={flow.addOps}
                  onClearSelection={() => flow.selectElement(null)}
                />
              )}
            </Box>
          )}
        </Stack>
      </Panel>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: fromNothing ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Panel
          title={fromNothing ? 'What gets built' : 'Changes'}
          description={
            fromNothing
              ? 'Every visual and every piece of the standard, in plain language, as the server built it.'
              : 'Every change in plain language, in the order the publish step applies it.'
          }
        >
          <ChangesList
            changes={preview.changes}
            emptyText={
              preview.loading
                ? 'Working out the changes…'
                : fromNothing
                  ? 'Nothing built yet. Add a visual on the Visuals step.'
                  : 'Nothing changes yet. Choose datasets, add calculated fields or edit the mockup.'
            }
          />
        </Panel>
        {!fromNothing && (
          <Panel
            title="Edits"
            description="What you and the planner changed on the mockup. Remove any one, or take them all back."
            actions={
              <>
                <Button
                  size="small"
                  startIcon={<Undo />}
                  onClick={flow.undoOp}
                  disabled={state.ops.length === 0}
                >
                  Undo last
                </Button>
                <Button
                  size="small"
                  startIcon={<Redo sx={{ transform: 'scaleX(-1)' }} />}
                  onClick={flow.clearOps}
                  disabled={state.ops.length === 0}
                >
                  Clear all
                </Button>
              </>
            }
          >
            <OpsList ops={state.ops} outline={sourceOutline} onRemove={flow.removeOp} />
          </Panel>
        )}
      </Box>
    </Stack>
  );
}
