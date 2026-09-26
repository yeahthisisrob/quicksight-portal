/**
 * Laying out a field's dependency chain.
 *
 * The backend hands over nodes carrying a signed depth (negative upstream,
 * 0 for the field itself, positive downstream) and the edges between them.
 * Turning that into coordinates is pure arithmetic, so it lives here and is
 * unit-tested rather than measured in the DOM: every node is the same size,
 * a depth is a column, and the only judgement is the order inside a column.
 */
import type { FieldLineage, FieldLineageNode } from '@/shared/api/modules/data-catalog';

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 68;
export const COLUMN_GAP = 76;
export const ROW_GAP = 14;
/** Room for the focus ring and the edges leaving the outermost columns. */
const PADDING = 8;

export interface PlacedNode extends FieldLineageNode {
  x: number;
  y: number;
}

interface PlacedEdge {
  id: string;
  from: string;
  to: string;
  /** An SVG cubic path from the right edge of `from` to the left edge of `to`. */
  d: string;
  /** True when the edge runs backwards, which a cyclic definition can do. */
  backwards: boolean;
}

interface LineageLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  /** Depth values in column order, so a header can name each band. */
  depths: number[];
}

const columnX = (index: number) => PADDING + index * (NODE_WIDTH + COLUMN_GAP);
const rowY = (index: number, offset: number) =>
  PADDING + (index + offset) * (NODE_HEIGHT + ROW_GAP);

/**
 * Order a column by the average row of the neighbours in the column beside it
 * (the barycentre heuristic), which is what keeps the edges from crossing in
 * the common shapes. A node with no neighbour on that side keeps where it
 * already is rather than being re-sorted, so a later sweep cannot undo what
 * an earlier one settled.
 */
function orderColumn(
  nodes: FieldLineageNode[],
  placedY: Map<string, number>,
  neighbours: Map<string, string[]>
): FieldLineageNode[] {
  const scored = nodes.map((node, index) => {
    const beside = (neighbours.get(node.id) ?? [])
      .map((id) => placedY.get(id))
      .filter((y): y is number => y !== undefined);
    const barycentre =
      beside.length > 0
        ? beside.reduce((a, b) => a + b, 0) / beside.length
        : (placedY.get(node.id) ?? index);
    return { node, index, barycentre };
  });
  return scored
    .sort((a, b) => a.barycentre - b.barycentre || a.index - b.index)
    .map((entry) => entry.node);
}

function path(from: PlacedNode, to: PlacedNode): string {
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const bend = Math.max(Math.abs(x2 - x1) / 2, COLUMN_GAP / 2);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/**
 * How many times the columns are re-ordered against their neighbours. One
 * sweep only sees what is already placed to its left, which leaves the first
 * column — the source columns, usually the widest — in name order and its
 * edges crossing. Sweeping back and forward again settles it.
 */
const SWEEPS: Array<'forward' | 'backward'> = ['forward', 'backward', 'forward'];

/** Coordinates for every node and edge, left to right, sources first. */
export function layoutLineage(lineage: FieldLineage): LineageLayout {
  const byDepth = new Map<number, FieldLineageNode[]>();
  for (const node of lineage.nodes) {
    const column = byDepth.get(node.depth);
    if (column) {
      column.push(node);
    } else {
      byDepth.set(node.depth, [node]);
    }
  }
  const depths = [...byDepth.keys()].sort((a, b) => a - b);

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const edge of lineage.edges) {
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge.from]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }

  const rows = Math.max(1, ...depths.map((depth) => (byDepth.get(depth) ?? []).length));
  const placedY = new Map<string, number>();
  const yOf = (column: FieldLineageNode[], row: number) => rowY(row, (rows - column.length) / 2);

  // Seed by name so the sweeps start from the same place whatever order the
  // API sent the nodes in, then place them so every node has a row to sweep on.
  const order = new Map<number, FieldLineageNode[]>(
    depths.map((depth) => [
      depth,
      [...(byDepth.get(depth) ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    ])
  );
  for (const depth of depths) {
    const column = order.get(depth) ?? [];
    column.forEach((node, row) => placedY.set(node.id, yOf(column, row)));
  }
  for (const sweep of SWEEPS) {
    const walk = sweep === 'forward' ? depths : [...depths].reverse();
    const neighbours = sweep === 'forward' ? incoming : outgoing;
    for (const depth of walk) {
      const column = orderColumn(order.get(depth) ?? [], placedY, neighbours);
      order.set(depth, column);
      column.forEach((node, row) => placedY.set(node.id, yOf(column, row)));
    }
  }

  const placed = new Map<string, PlacedNode>();
  depths.forEach((depth, column) => {
    const nodes = order.get(depth) ?? [];
    nodes.forEach((node, row) => {
      placed.set(node.id, { ...node, x: columnX(column), y: yOf(nodes, row) });
    });
  });

  const edges: PlacedEdge[] = [];
  for (const edge of lineage.edges) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) {
      continue;
    }
    edges.push({
      id: `${edge.from}->${edge.to}`,
      from: edge.from,
      to: edge.to,
      d: path(from, to),
      backwards: to.x <= from.x,
    });
  }

  return {
    width: columnX(Math.max(depths.length, 1) - 1) + NODE_WIDTH + PADDING,
    height: rowY(rows - 1, 0) + NODE_HEIGHT + PADDING,
    nodes: [...placed.values()],
    edges,
    depths,
  };
}

/** "reads it", "3 hops upstream" — what a column of the chain is. */
export function describeDepth(depth: number): string {
  if (depth === 0) return 'this field';
  const hops = Math.abs(depth);
  const step = hops === 1 ? '' : ` (${hops} hops)`;
  return depth < 0 ? `computed from${step}` : `computes${step}`;
}
