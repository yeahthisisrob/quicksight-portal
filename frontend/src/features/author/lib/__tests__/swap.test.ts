import { describe, expect, it } from 'vitest';

import type { SheetOutline } from '@/shared/api/modules/authoring';

import { swapNeighbour, swapOps } from '../swap';

const el = (elementId: string, col: number, row: number, colSpan = 18, rowSpan = 12) =>
  ({ elementId, kind: 'visual', visualType: 'BarChartVisual', col, row, colSpan, rowSpan }) as any;

/** Two rows of two: A B / C D, and a wide E under them. */
const sheet: SheetOutline = {
  sheetId: 's1',
  name: 'Overview',
  layout: 'grid',
  elements: [
    el('A', 0, 0),
    el('B', 18, 0),
    el('C', 0, 12),
    el('D', 18, 12),
    el('E', 0, 24, 36, 12),
    { elementId: 'text', kind: 'text', col: 0, row: 36, colSpan: 36, rowSpan: 4 } as any,
  ],
} as any;

const clamp = { col: (c: number) => Math.max(0, Math.min(35, c)), row: (r: number) => Math.max(0, r) };

describe('swapNeighbour', () => {
  it('finds the nearest visual in each direction that shares the same band', () => {
    expect(swapNeighbour(sheet, 'D', 'up')?.elementId).toBe('B');
    expect(swapNeighbour(sheet, 'D', 'left')?.elementId).toBe('C');
    expect(swapNeighbour(sheet, 'A', 'down')?.elementId).toBe('C');
    expect(swapNeighbour(sheet, 'A', 'right')?.elementId).toBe('B');
  });

  it('spans: the wide visual below both columns is the neighbour of either', () => {
    expect(swapNeighbour(sheet, 'C', 'down')?.elementId).toBe('E');
    expect(swapNeighbour(sheet, 'D', 'down')?.elementId).toBe('E');
  });

  it('ignores non-visual elements and finds nothing past the edge', () => {
    expect(swapNeighbour(sheet, 'E', 'down')).toBeNull();
    expect(swapNeighbour(sheet, 'A', 'up')).toBeNull();
    expect(swapNeighbour(sheet, 'A', 'left')).toBeNull();
  });
});

describe('swapOps', () => {
  it('trades origins with the neighbour, each keeping its own size', () => {
    expect(swapOps(sheet, 'D', 'up', clamp)).toEqual([
      { op: 'move', sheetId: 's1', elementId: 'B', col: 18, row: 12 },
      { op: 'move', sheetId: 's1', elementId: 'D', col: 18, row: 0 },
    ]);
    expect(swapOps(sheet, 'C', 'down', clamp)).toEqual([
      { op: 'move', sheetId: 's1', elementId: 'E', col: 0, row: 12 },
      { op: 'move', sheetId: 's1', elementId: 'C', col: 0, row: 24 },
    ]);
  });

  it('nudges one cell when there is nothing to trade with, clamped at the edge', () => {
    expect(swapOps(sheet, 'A', 'up', clamp)).toEqual([
      { op: 'move', sheetId: 's1', elementId: 'A', col: 0, row: 0 },
    ]);
    expect(swapOps(sheet, 'B', 'right', clamp)).toEqual([
      { op: 'move', sheetId: 's1', elementId: 'B', col: 19, row: 0 },
    ]);
  });
});
