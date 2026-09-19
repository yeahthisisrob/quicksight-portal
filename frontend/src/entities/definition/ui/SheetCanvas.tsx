/**
 * Draws one sheet's elements according to its layout kind.
 *
 * grid      CSS grid, 36 columns, rows as tall as a column is wide (QuickSight's
 *           grid cells are square) so proportions survive.
 * freeform  absolute pixels scaled from the designed canvas width to ours.
 * section   paginated report: one free-form band per header/body/footer section.
 * flow      no layout data; three cards to a row in definition order.
 *
 * Every card gets its extras (renames, changes, badge, selection) from one
 * `decorate` lookup, so the canvases stay ignorant of what the host is doing.
 */
import { alpha, Box, Typography } from '@mui/material';
import { useMemo, useRef } from 'react';

import { borderRadius } from '@/shared/design-system/theme';

import { elementChanges, elementRenames, type WireframeDiff } from '../lib/wireframeDiff';
import type { WireframeBadges, WireframeElement, WireframeSheet } from '../model/types';
import { useElementWidth } from './useElementWidth';
import { WireframeCard, type WireframeCardProps } from './WireframeCard';

/** Everything a card may carry besides its element. */
export type CardExtras = Omit<WireframeCardProps, 'element' | 'dense'>;
export type Decorate = (elementId: string) => CardExtras;

const GRID_COLUMNS = 36;
const GRID_GAP = 6;
const FLOW_SPAN = 12;
const DEFAULT_CANVAS_WIDTH = 1600;
const DEFAULT_PAGE_WIDTH = 612;
const FALLBACK_WIDTH = 960;
const MIN_ROW_UNIT = 14;
/** Section bands: 8px padding each side plus a 1px border each side. */
const SECTION_BAND_INSET = 2 * 8 + 2;

function GridCanvas({
  elements,
  width,
  decorate,
}: {
  elements: WireframeElement[];
  width: number;
  decorate: Decorate;
}) {
  const rowUnit = Math.max(MIN_ROW_UNIT, (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  let flowRow = elements.reduce(
    (max, e) =>
      e.position.type === 'grid' && e.position.row !== undefined
        ? Math.max(max, e.position.row + e.position.rowSpan)
        : max,
    0
  );
  let flowCol = 0;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
        gridAutoRows: `${rowUnit}px`,
        gap: `${GRID_GAP}px`,
      }}
    >
      {elements.map((element) => {
        let area: string;
        if (element.position.type === 'grid') {
          const { col, colSpan, row, rowSpan } = element.position;
          // Tiles without indexes flow: CSS auto-placement puts each after the
          // previous one and wraps at the 36th column, as QuickSight does.
          area =
            col !== undefined && row !== undefined
              ? `${row + 1} / ${col + 1} / span ${rowSpan} / span ${colSpan}`
              : `auto / auto / span ${rowSpan} / span ${colSpan}`;
        } else {
          // Unplaced: append below the laid-out rows, three to a row.
          if (flowCol + FLOW_SPAN > GRID_COLUMNS) {
            flowCol = 0;
            flowRow += FLOW_SPAN / 2;
          }
          area = `${flowRow + 1} / ${flowCol + 1} / span ${FLOW_SPAN / 2} / span ${FLOW_SPAN}`;
          flowCol += FLOW_SPAN;
        }
        return (
          <Box key={element.id} sx={{ gridArea: area, minWidth: 0, minHeight: 0 }}>
            <WireframeCard element={element} {...decorate(element.id)} />
          </Box>
        );
      })}
    </Box>
  );
}

function FreeFormCanvas({
  elements,
  width,
  canvasWidth,
  decorate,
}: {
  elements: WireframeElement[];
  width: number;
  canvasWidth: number;
  decorate: Decorate;
}) {
  const { scale, height } = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    for (const e of elements) {
      if (e.position.type !== 'freeform') continue;
      maxX = Math.max(maxX, e.position.x + e.position.width);
      maxY = Math.max(maxY, e.position.y + e.position.height);
    }
    const designed = Math.max(canvasWidth, maxX, 1);
    const s = width / designed;
    return { scale: s, height: Math.max(maxY * s, MIN_ROW_UNIT) };
  }, [elements, width, canvasWidth]);

  return (
    <Box sx={{ position: 'relative', height, minHeight: 0 }}>
      {elements.map((element) =>
        element.position.type === 'freeform' ? (
          <Box
            key={element.id}
            sx={{
              position: 'absolute',
              left: element.position.x * scale,
              top: element.position.y * scale,
              width: element.position.width * scale,
              height: element.position.height * scale,
            }}
          >
            <WireframeCard element={element} {...decorate(element.id)} />
          </Box>
        ) : null
      )}
    </Box>
  );
}

function FlowCanvas({ elements, decorate }: { elements: WireframeElement[]; decorate: Decorate }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gridAutoRows: 180,
        gap: `${GRID_GAP}px`,
      }}
    >
      {elements.map((element) => (
        <WireframeCard key={element.id} element={element} {...decorate(element.id)} />
      ))}
    </Box>
  );
}

function SectionCanvas({
  elements,
  width,
  decorate,
}: {
  elements: WireframeElement[];
  width: number;
  decorate: Decorate;
}) {
  const bands = useMemo(() => {
    const map = new Map<string, { role: string; elements: WireframeElement[] }>();
    for (const e of elements) {
      const key = e.section?.id ?? 'unsectioned';
      const role = e.section?.role ?? 'body';
      if (!map.has(key)) map.set(key, { role, elements: [] });
      map.get(key)?.elements.push(e);
    }
    return [...map.entries()];
  }, [elements]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {bands.map(([id, band]) => (
        <Box key={id}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
          >
            {band.role} · {id}
          </Typography>
          <Box
            sx={{
              mt: 0.5,
              p: 1,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: `${borderRadius.sm}px`,
            }}
          >
            <FreeFormCanvas
              elements={band.elements}
              width={Math.max(width - SECTION_BAND_INSET, 1)}
              canvasWidth={DEFAULT_PAGE_WIDTH}
              decorate={decorate}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export interface SheetCanvasProps {
  sheet: WireframeSheet;
  diff?: WireframeDiff;
  badges?: WireframeBadges;
  selectedId?: string;
  onSelect?: (elementId: string) => void;
}

/** Build the per-card extras for one sheet from the host's diff, badges and selection. */
export function decorateWith(
  sheetId: string,
  { diff, badges, selectedId, onSelect }: Omit<SheetCanvasProps, 'sheet'>
): Decorate {
  return (elementId) => ({
    renames: elementRenames(diff, sheetId, elementId),
    changes: elementChanges(diff, sheetId, elementId),
    badge: badges?.get(elementId),
    selected: selectedId === elementId,
    onSelect: onSelect ? () => onSelect(elementId) : undefined,
  });
}

export function SheetCanvas({ sheet, diff, badges, selectedId, onSelect }: SheetCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref, FALLBACK_WIDTH);
  const decorate = decorateWith(sheet.id, { diff, badges, selectedId, onSelect });

  let body: React.ReactNode;
  if (sheet.elements.length === 0) {
    body = (
      <Typography variant="body2" sx={{ color: 'text.secondary', p: 2, textAlign: 'center' }}>
        This sheet has no elements.
      </Typography>
    );
  } else if (sheet.layout === 'grid') {
    body = <GridCanvas elements={sheet.elements} width={width} decorate={decorate} />;
  } else if (sheet.layout === 'freeform') {
    body = (
      <FreeFormCanvas
        elements={sheet.elements}
        width={width}
        canvasWidth={sheet.canvasWidth ?? DEFAULT_CANVAS_WIDTH}
        decorate={decorate}
      />
    );
  } else if (sheet.layout === 'section') {
    body = <SectionCanvas elements={sheet.elements} width={width} decorate={decorate} />;
  } else {
    body = <FlowCanvas elements={sheet.elements} decorate={decorate} />;
  }

  return (
    <Box
      data-testid="wireframe-canvas"
      sx={{
        p: 1.5,
        bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
        borderRadius: `${borderRadius.md}px`,
      }}
    >
      {/* Measured inside the padding so scaled layouts fill exactly the content box. */}
      <Box ref={ref}>{body}</Box>
    </Box>
  );
}
