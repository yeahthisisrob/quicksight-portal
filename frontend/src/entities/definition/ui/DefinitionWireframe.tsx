/**
 * DefinitionWireframe - a sketch of a dashboard or analysis.
 *
 * Sheet tabs top-left as QuickSight draws them, a summary of what the
 * definition contains, the sheet's control strip, then the canvas. Nothing
 * here touches data: it is layout, visual types and field names only, which
 * is exactly what you need to compare a proposed clone against its source.
 *
 * Read-only by default. Given `onSelect` it becomes the editor's surface:
 * cards are clickable and the selected one is outlined. Given `diff` it
 * highlights renamed fields and moved, resized, retyped, added and removed
 * elements; given `badges` it flags slow or failing visuals.
 */
import { alpha, Box, Chip, Tab, Tabs, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { borderRadius, typography } from '@/shared/design-system/theme';

import type { WireframeDiff } from '../lib/wireframeDiff';
import type { WireframeBadges, WireframeModel } from '../model/types';
import { decorateWith, SheetCanvas } from './SheetCanvas';
import { WireframeCard } from './WireframeCard';

const CONTROL_CARD_WIDTH = 200;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function Summary({ model }: { model: WireframeModel }) {
  const items = [
    plural(model.visualCount, 'visual'),
    plural(model.datasets.length, 'dataset'),
    model.parameterCount > 0 ? plural(model.parameterCount, 'parameter') : null,
    model.filterGroupCount > 0 ? plural(model.filterGroupCount, 'filter group') : null,
    model.calculatedFieldCount > 0 ? plural(model.calculatedFieldCount, 'calculated field') : null,
  ].filter((s): s is string => Boolean(s));

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map((label) => (
        <Chip key={label} label={label} size="small" variant="outlined" />
      ))}
      {model.datasets.map((d) => (
        <Chip
          key={d.identifier}
          label={d.identifier}
          size="small"
          title={d.dataSetId}
          sx={{ fontFamily: typography.fontFamily.monospace }}
        />
      ))}
    </Box>
  );
}

interface DefinitionWireframeProps {
  model: WireframeModel;
  /** Which sheet to show first; defaults to the first sheet. */
  initialSheetId?: string;
  /** Controlled sheet selection, for hosts that keep it (the editor). */
  sheetId?: string;
  onSheetChange?: (sheetId: string) => void;
  /** Hide the summary strip (when the host already shows it). */
  hideSummary?: boolean;
  /**
   * Changes to highlight (from diffWireframeModels against the model this one
   * was derived from): renamed fields, and moved/resized/retyped/added/removed
   * elements.
   */
  diff?: WireframeDiff;
  /** Health warnings keyed by element id (slow, errors). */
  badges?: WireframeBadges;
  /** Editor selection: the outlined card. */
  selectedId?: string;
  /** Makes cards clickable. */
  onSelect?: (elementId: string) => void;
}

export function DefinitionWireframe({
  model,
  initialSheetId,
  sheetId: controlledSheetId,
  onSheetChange,
  hideSummary = false,
  diff,
  badges,
  selectedId,
  onSelect,
}: DefinitionWireframeProps) {
  const [ownSheetId, setOwnSheetId] = useState(initialSheetId ?? model.sheets[0]?.id);
  const sheetId = controlledSheetId ?? ownSheetId;
  const setSheetId = (id: string) => {
    setOwnSheetId(id);
    onSheetChange?.(id);
  };

  // A new model (different asset) may not contain the selected sheet.
  useEffect(() => {
    if (!model.sheets.some((s) => s.id === sheetId)) {
      const fallback = initialSheetId ?? model.sheets[0]?.id;
      if (fallback) {
        setOwnSheetId(fallback);
        onSheetChange?.(fallback);
      }
    }
  }, [model, sheetId, initialSheetId, onSheetChange]);

  const sheet = useMemo(
    () => model.sheets.find((s) => s.id === sheetId) ?? model.sheets[0],
    [model, sheetId]
  );

  if (model.sheets.length === 0 || !sheet) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          This definition has no sheets to draw.
        </Typography>
      </Box>
    );
  }

  const decorate = decorateWith(sheet.id, { diff, badges, selectedId, onSelect });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={sheet.id}
          onChange={(_, value: string) => setSheetId(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
        >
          {model.sheets.map((s) => (
            <Tab key={s.id} value={s.id} label={s.name} sx={{ textTransform: 'none' }} />
          ))}
        </Tabs>
        {!hideSummary && (
          <Box sx={{ pb: 0.5 }}>
            <Summary model={model} />
          </Box>
        )}
      </Box>

      {sheet.controlBar.length > 0 && (
        <Box
          data-testid="wireframe-control-bar"
          sx={{
            display: 'flex',
            gap: 1,
            p: 1,
            overflowX: 'auto',
            bgcolor: (t) => alpha(t.palette.text.primary, 0.02),
            border: 1,
            borderColor: 'divider',
            borderRadius: `${borderRadius.md}px`,
          }}
        >
          {sheet.controlBar.map((control) => (
            <Box key={control.id} sx={{ width: CONTROL_CARD_WIDTH, flexShrink: 0 }}>
              <WireframeCard element={control} dense {...decorate(control.id)} />
            </Box>
          ))}
        </Box>
      )}

      <SheetCanvas
        sheet={sheet}
        diff={diff}
        badges={badges}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </Box>
  );
}
