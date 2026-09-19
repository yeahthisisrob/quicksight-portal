/**
 * Moving a visual with the arrows trades places with its neighbour in that
 * direction, rather than sliding one row and overlapping it. When nothing is
 * there to trade with, the visual nudges one cell as before.
 */
import type { DefinitionOp, SheetOutline, SheetOutlineElement } from '@/shared/api/modules/authoring';

export type SwapDirection = 'up' | 'down' | 'left' | 'right';

interface Placed {
  element: SheetOutlineElement;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

function placed(element: SheetOutlineElement): Placed | null {
  if (element.kind !== 'visual' || element.col === undefined || element.row === undefined) {
    return null;
  }
  return {
    element,
    col: element.col,
    row: element.row,
    colSpan: element.colSpan ?? 1,
    rowSpan: element.rowSpan ?? 1,
  };
}

function overlaps(aStart: number, aSpan: number, bStart: number, bSpan: number): boolean {
  return aStart < bStart + bSpan && bStart < aStart + aSpan;
}

/** The nearest visual in that direction that shares rows (or columns) with this one. */
export function swapNeighbour(
  sheet: SheetOutline,
  elementId: string,
  direction: SwapDirection
): SheetOutlineElement | null {
  const self = sheet.elements.map(placed).find((p) => p?.element.elementId === elementId);
  if (!self) {
    return null;
  }
  const others = sheet.elements
    .map(placed)
    .filter((p): p is Placed => p !== null && p.element.elementId !== elementId);

  const vertical = direction === 'up' || direction === 'down';
  const candidates = others.filter((o) =>
    vertical
      ? overlaps(self.col, self.colSpan, o.col, o.colSpan) &&
        (direction === 'up' ? o.row < self.row : o.row > self.row)
      : overlaps(self.row, self.rowSpan, o.row, o.rowSpan) &&
        (direction === 'left' ? o.col < self.col : o.col > self.col)
  );
  if (candidates.length === 0) {
    return null;
  }
  const distance = (o: Placed) =>
    vertical ? Math.abs(o.row - self.row) : Math.abs(o.col - self.col);
  return candidates.sort((a, b) => distance(a) - distance(b))[0]!.element;
}

/**
 * The ops for an arrow press: two moves that trade origins with the
 * neighbour, or one nudge when there is no neighbour. Each keeps its size.
 */
export function swapOps(
  sheet: SheetOutline,
  elementId: string,
  direction: SwapDirection,
  clamp: { col: (c: number) => number; row: (r: number) => number }
): DefinitionOp[] {
  const self = sheet.elements.find((e) => e.elementId === elementId);
  if (!self) {
    return [];
  }
  const col = self.col ?? 0;
  const row = self.row ?? 0;
  const neighbour = swapNeighbour(sheet, elementId, direction);
  if (!neighbour) {
    const dc = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dr = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    return [
      { op: 'move', sheetId: sheet.sheetId, elementId, col: clamp.col(col + dc), row: clamp.row(row + dr) },
    ];
  }
  return [
    {
      op: 'move',
      sheetId: sheet.sheetId,
      elementId: neighbour.elementId,
      col: clamp.col(col),
      row: clamp.row(row),
    },
    {
      op: 'move',
      sheetId: sheet.sheetId,
      elementId,
      col: clamp.col(neighbour.col ?? 0),
      row: clamp.row(neighbour.row ?? 0),
    },
  ];
}
