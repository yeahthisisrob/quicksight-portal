/**
 * The canvas: the open asset drawn from its definition, with every edit and
 * fix applied exactly as a save would write it. Click a card to inspect it;
 * Before shows the asset as it is, with slow or failing visuals flagged and
 * what the edits removed ghosted.
 */
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';

import { DefinitionWireframe, removedOnly, summarizeDiff } from '@/entities/definition';

import { SegmentedControl } from '@/shared/design-system';

import type { Studio } from '../../model/useStudio';
import { StatusIndicator } from '../primitives/StatusIndicator';

export type CanvasView = 'before' | 'after';

const SUMMARY_LABELS: Record<string, string> = {
  renamed: 'field renamed',
  moved: 'moved',
  resized: 'resized',
  retyped: 'retyped',
  added: 'added',
  removed: 'removed',
};

function DiffChips({ studio }: { studio: Studio }) {
  const summary = summarizeDiff(studio.preview.diff ?? undefined);
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

interface CanvasProps {
  studio: Studio;
  view: CanvasView;
  onViewChange: (view: CanvasView) => void;
  sheetId: string;
  onSheetChange: (sheetId: string) => void;
}

export function Canvas({ studio, view, onViewChange, sheetId, onSheetChange }: CanvasProps) {
  const { preview, source, state, dirty } = studio;
  // Nothing edited: the asset as it is, editable, with its health on it.
  const showingBefore = dirty && view === 'before';
  const model = showingBefore ? source.model : (preview.model ?? source.model);
  const editable = !showingBefore && model !== null;

  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        {preview.loading ? (
          <StatusIndicator kind="loading">Drawing the edits</StatusIndicator>
        ) : dirty ? (
          <StatusIndicator kind="info">
            {state.ops.length > 0
              ? `${state.ops.length} edit${state.ops.length === 1 ? '' : 's'}`
              : 'Fixes applied'}{' '}
            not saved
          </StatusIndicator>
        ) : (
          <StatusIndicator kind="pending">Click a visual to edit it</StatusIndicator>
        )}
        {dirty && <DiffChips studio={studio} />}
        <Box sx={{ flex: 1 }} />
        {dirty && (
          <SegmentedControl<CanvasView>
            size="small"
            ariaLabel="Before or after"
            value={view}
            onChange={onViewChange}
            options={[
              { value: 'before', label: 'Before' },
              { value: 'after', label: 'After' },
            ]}
          />
        )}
      </Stack>

      {preview.warnings.length > 0 && (
        <Alert severity="warning" data-testid="canvas-warnings">
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {preview.warnings.map((warning) => (
              <li key={warning}>
                <Typography variant="body2">{warning}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}
      {preview.error && <Alert severity="error">{preview.error}</Alert>}
      {source.error && <Alert severity="error">{source.error}</Alert>}

      {source.loading && (
        <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}
      {!source.loading && !source.error && !source.model && (
        <Alert severity="info">
          No definition is cached for this asset yet, so there is nothing to draw. Run an export
          with definitions from Operations; the issues and their fixes still work.
        </Alert>
      )}

      {model && (
        <Box sx={{ minWidth: 0, opacity: !showingBefore && preview.loading ? 0.6 : 1 }}>
          <DefinitionWireframe
            model={model}
            sheetId={sheetId}
            onSheetChange={onSheetChange}
            diff={
              !dirty
                ? undefined
                : showingBefore
                  ? removedOnly(preview.diff ?? undefined)
                  : (preview.diff ?? undefined)
            }
            badges={dirty && !showingBefore ? undefined : studio.healthBadges}
            selectedId={editable ? state.selectedElement?.elementId : undefined}
            onSelect={
              editable ? (elementId) => studio.selectElement({ sheetId, elementId }) : undefined
            }
          />
        </Box>
      )}
    </Stack>
  );
}
