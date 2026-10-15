/**
 * The sheet grid every layout rule works in: 36 columns wide, rows as
 * tall as they need. Shared by the builder, the edit ops and templates.
 */
export const GRID_COLUMNS = 36;

const CONTROLS_PER_ROW = 4;
const CONTROL_ROWS = 3;
/** A control on the canvas: four to a row, three rows tall. */
export const CONTROL_TILE = { colSpan: GRID_COLUMNS / CONTROLS_PER_ROW, rowSpan: CONTROL_ROWS };

export interface Tile {
  colSpan: number;
  rowSpan: number;
}

/**
 * Sizes in words, for an ask that says "small" or "full width" rather than
 * grid units. Compact on purpose: visuals scroll, so a tile shows the shape
 * of the data and the page stays short.
 */
export const TILE_SIZES = ['small', 'medium', 'large', 'wide', 'full'] as const;
export type TileSize = (typeof TILE_SIZES)[number];
/** A third and two thirds of the 36-column grid. */
const THIRD_WIDTH = 12;
const TWO_THIRDS_WIDTH = 24;
const HALF_WIDTH = GRID_COLUMNS / 2;
export const SIZE_TILES: Record<TileSize, Tile> = {
  small: { colSpan: THIRD_WIDTH, rowSpan: 8 },
  medium: { colSpan: HALF_WIDTH, rowSpan: 10 },
  large: { colSpan: TWO_THIRDS_WIDTH, rowSpan: 12 },
  wide: { colSpan: GRID_COLUMNS, rowSpan: 10 },
  full: { colSpan: GRID_COLUMNS, rowSpan: 14 },
};

/**
 * Where a tile goes, in words: at the bottom of the sheet, right after
 * another tile (beside it when it fits on the row, else on the next), or
 * below another tile's row.
 */
export const PLACEMENTS = ['bottom', 'beside', 'below'] as const;
export type Placement = (typeof PLACEMENTS)[number];

/**
 * The reading order of a grid: by row, then column. Elements without a
 * position come last, in their own order.
 */
function readingOrder<T extends { RowIndex?: number; ColumnIndex?: number }>(elements: T[]): T[] {
  return [...elements].sort((a, b) => {
    const unplaced = Number(a.RowIndex === undefined) - Number(b.RowIndex === undefined);
    if (unplaced !== 0) return unplaced;
    return (
      Number(a.RowIndex ?? 0) - Number(b.RowIndex ?? 0) ||
      Number(a.ColumnIndex ?? 0) - Number(b.ColumnIndex ?? 0)
    );
  });
}

/**
 * Move one element to a place in the reading order, then lay the whole
 * sheet out again from row 0: rows are packed left to right, nothing
 * overlaps and nothing is left hanging in space. This is how the layout is
 * treated as blocks: an op names where a tile goes and the grid decides the
 * coordinates, instead of anyone adjusting numbers by hand.
 */
export function placeAndRepack(
  elements: GridElement[],
  elementId: string,
  placement: Placement,
  anchorId?: string
): GridElement[] {
  const ordered = readingOrder(elements);
  const moving = ordered.find((e) => e.ElementId === elementId);
  if (!moving) {
    throw new Error(`No element '${elementId}' to place`);
  }
  const rest = ordered.filter((e) => e !== moving);
  let at = rest.length;
  if (placement !== 'bottom') {
    const anchorIndex = rest.findIndex((e) => e.ElementId === anchorId);
    if (anchorIndex === -1) {
      throw new Error(`No element '${anchorId ?? ''}' to place ${elementId} ${placement}`);
    }
    const anchor = rest[anchorIndex]!;
    if (placement === 'beside') {
      at = anchorIndex + 1;
    } else {
      // Below: after everything that shares the anchor's row band.
      const bandEnd = Number(anchor.RowIndex ?? 0) + Number(anchor.RowSpan ?? 0);
      at = anchorIndex + 1;
      while (at < rest.length && Number(rest[at]!.RowIndex ?? 0) < bandEnd) at += 1;
    }
  }
  // Below means its own row: the tile starts a new row even where it would fit beside.
  return packInOrder(
    [...rest.slice(0, at), moving, ...rest.slice(at)],
    placement === 'below' ? new Set([elementId]) : undefined
  );
}

/** The sheet laid out again as blocks, in its reading order (after a resize, say). */
export function repack(elements: GridElement[]): GridElement[] {
  return packInOrder(readingOrder(elements));
}

/**
 * Rows packed left to right from row 0, in the order given (a tile in
 * `startsRow` begins a new row); every other field of each element kept.
 */
function packInOrder(order: GridElement[], startsRow?: Set<string>): GridElement[] {
  const packed: GridElement[] = [];
  let col = 0;
  let row = 0;
  let rowHeight = 0;
  for (const element of order) {
    const colSpan = Math.min(Math.max(element.ColumnSpan, 1), GRID_COLUMNS);
    if (col > 0 && (col + colSpan > GRID_COLUMNS || startsRow?.has(element.ElementId))) {
      col = 0;
      row += rowHeight;
      rowHeight = 0;
    }
    packed.push({ ...element, ColumnIndex: col, ColumnSpan: colSpan, RowIndex: row });
    col += colSpan;
    rowHeight = Math.max(rowHeight, element.RowSpan);
  }
  return packed;
}

export interface GridElement {
  ElementId: string;
  ElementType: string;
  ColumnIndex?: number;
  ColumnSpan: number;
  RowIndex?: number;
  RowSpan: number;
}

/** Lay tiles left to right, top to bottom, from a starting row. Returns the row after the last. */
export function reflow(
  items: Array<{ id: string; tile: Tile }>,
  startRow: number
): { elements: GridElement[]; bottom: number } {
  const elements: GridElement[] = [];
  let col = 0;
  let row = startRow;
  let rowHeight = 0;
  for (const { id, tile } of items) {
    const colSpan = Math.min(Math.max(tile.colSpan, 1), GRID_COLUMNS);
    if (col + colSpan > GRID_COLUMNS) {
      col = 0;
      row += rowHeight;
      rowHeight = 0;
    }
    elements.push({
      ElementId: id,
      ElementType: 'VISUAL',
      ColumnIndex: col,
      ColumnSpan: colSpan,
      RowIndex: row,
      RowSpan: tile.rowSpan,
    });
    col += colSpan;
    rowHeight = Math.max(rowHeight, tile.rowSpan);
  }
  return { elements, bottom: row + rowHeight };
}

/** The first free row below every element of a grid. */
export function gridBottom(elements: Array<{ RowIndex?: number; RowSpan?: number }>): number {
  return elements.reduce(
    (max, e) => Math.max(max, Number(e.RowIndex ?? 0) + Number(e.RowSpan ?? 0)),
    0
  );
}
