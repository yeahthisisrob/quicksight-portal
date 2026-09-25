import { describe, expect, it } from 'vitest';

import type { FieldLineage, FieldLineageNode } from '@/shared/api/modules/data-catalog';

import {
  COLUMN_GAP,
  describeDepth,
  layoutLineage,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_GAP,
} from '../fieldLineage';

const node = (
  id: string,
  depth: number,
  over: Partial<FieldLineageNode> = {}
): FieldLineageNode => ({
  id,
  name: id,
  kind: id.startsWith('col') ? 'column' : 'calculated',
  depth,
  ...over,
});

// revenue and cost feed margin, which feeds margin_pct; revenue feeds
// margin_pct directly too, which is the edge that crosses a column.
const CHAIN: FieldLineage = {
  nodes: [
    node('col:revenue', -1),
    node('col:cost', -1),
    node('cf:margin', 0),
    node('cf:margin_pct', 1),
  ],
  edges: [
    { from: 'col:revenue', to: 'cf:margin' },
    { from: 'col:cost', to: 'cf:margin' },
    { from: 'cf:margin', to: 'cf:margin_pct' },
    { from: 'col:revenue', to: 'cf:margin_pct' },
  ],
  truncated: false,
};

describe('layoutLineage', () => {
  it('puts each depth in its own column, sources first', () => {
    const layout = layoutLineage(CHAIN);
    const x = Object.fromEntries(layout.nodes.map((n) => [n.id, n.x]));

    expect(layout.depths).toEqual([-1, 0, 1]);
    expect(x['col:revenue']).toBe(x['col:cost']);
    expect(x['cf:margin']).toBe((x['col:revenue'] as number) + NODE_WIDTH + COLUMN_GAP);
    expect(x['cf:margin_pct']).toBe((x['cf:margin'] as number) + NODE_WIDTH + COLUMN_GAP);
  });

  it('stacks a column by row and centres the shorter ones against the tallest', () => {
    const layout = layoutLineage(CHAIN);
    const y = Object.fromEntries(layout.nodes.map((n) => [n.id, n.y]));

    // Two upstream columns, so the tallest column is two rows high.
    expect(Math.abs((y['col:cost'] as number) - (y['col:revenue'] as number))).toBe(
      NODE_HEIGHT + ROW_GAP
    );
    // The single-node columns sit between them.
    expect(y['cf:margin']).toBeGreaterThan(Math.min(y['col:revenue']!, y['col:cost']!));
    expect(y['cf:margin']).toBeLessThan(Math.max(y['col:revenue']!, y['col:cost']!));
    expect(y['cf:margin_pct']).toBe(y['cf:margin']);
  });

  it('draws an edge per link, left to right, and sizes the canvas to hold them', () => {
    const layout = layoutLineage(CHAIN);

    expect(layout.edges).toHaveLength(4);
    expect(layout.edges.every((e) => e.d.startsWith('M ') && e.d.includes(' C '))).toBe(true);
    expect(layout.edges.every((e) => !e.backwards)).toBe(true);
    expect(layout.width).toBeGreaterThanOrEqual(3 * NODE_WIDTH + 2 * COLUMN_GAP);
    expect(layout.height).toBeGreaterThanOrEqual(2 * NODE_HEIGHT + ROW_GAP);
  });

  it('marks an edge that runs backwards, which a field defined in terms of itself can do', () => {
    const cycle = layoutLineage({
      nodes: [node('cf:a', 0), node('cf:b', -1)],
      edges: [
        { from: 'cf:b', to: 'cf:a' },
        { from: 'cf:a', to: 'cf:b' },
      ],
      truncated: false,
    });
    expect(cycle.edges.map((e) => e.backwards)).toEqual([false, true]);
  });

  it('drops an edge whose ends are not both in the chain, rather than drawing into space', () => {
    const layout = layoutLineage({
      nodes: [node('cf:a', 0)],
      edges: [{ from: 'cf:a', to: 'cf:gone' }],
      truncated: true,
    });
    expect(layout.edges).toEqual([]);
    expect(layout.nodes).toHaveLength(1);
  });

  it('orders the source column too, which one left-to-right pass cannot', () => {
    // Nothing feeds the sources, so their order can only come from where they
    // feed to: a single forward sweep would leave them alphabetical and cross
    // both edges.
    const layout = layoutLineage({
      nodes: [
        node('col:zulu', -1),
        node('col:alpha', -1),
        node('cf:first', 0),
        node('cf:second', 0),
      ],
      edges: [
        { from: 'col:zulu', to: 'cf:first' },
        { from: 'col:alpha', to: 'cf:second' },
      ],
      truncated: false,
    });
    const y = Object.fromEntries(layout.nodes.map((n) => [n.id, n.y]));
    expect(y['col:zulu']! < y['col:alpha']!).toBe(y['cf:first']! < y['cf:second']!);
  });

  it('orders a column so the edges into it cross as little as possible', () => {
    // b is fed by the lower source, a by the upper one; laid out in the wrong
    // order the two edges would cross.
    const layout = layoutLineage({
      nodes: [node('col:top', -1), node('col:bottom', -1), node('cf:b', 0), node('cf:a', 0)],
      edges: [
        { from: 'col:top', to: 'cf:a' },
        { from: 'col:bottom', to: 'cf:b' },
      ],
      truncated: false,
    });
    const y = Object.fromEntries(layout.nodes.map((n) => [n.id, n.y]));
    expect(y['cf:a']! < y['cf:b']!).toBe(y['col:top']! < y['col:bottom']!);
  });
});

describe('describeDepth', () => {
  it('names each band of the chain', () => {
    expect(describeDepth(0)).toBe('this field');
    expect(describeDepth(-1)).toBe('computed from');
    expect(describeDepth(-3)).toBe('computed from (3 hops)');
    expect(describeDepth(2)).toBe('computes (2 hops)');
  });
});
