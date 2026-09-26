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
