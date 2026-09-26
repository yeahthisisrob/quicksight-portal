import { describe, expect, it } from 'vitest';

import { ContextGraph, entityId, expressionColumnNames, MAX_DEPTH } from '../lib/contextGraph';

function chain(length: number): ContextGraph {
  const graph = new ContextGraph();
  for (let i = 0; i <= length; i++) {
    graph.add({
      id: entityId('dataset', `n${i}`),
      type: 'dataset',
      name: `n${i}`,
      summary: `n${i}`,
      attributes: {},
    });
  }
  for (let i = 0; i < length; i++) {
    graph.link(entityId('dataset', `n${i}`), 'uses-dataset', entityId('dataset', `n${i + 1}`));
  }
  return graph;
}

describe('ContextGraph', () => {
  it('drops edges to entities it does not know', () => {
    const graph = chain(1);
    graph.link('dataset:n0', 'reads-listing', 'listing:missing');
    expect(graph.relationCounts('dataset:n0')).toEqual([
      { relation: 'uses-dataset', direction: 'out', count: 1 },
    ]);
  });

  it('follows relations both ways, never deeper than the bound, and records the path', () => {
    const graph = chain(6);
    const deep = graph.related('dataset:n0', { direction: 'out', depth: 10 });
    expect(deep.map((h) => h.depth)).toEqual([1, 2, MAX_DEPTH]);
    expect(deep[1]!.via.map((v) => v.relation)).toEqual(['uses-dataset', 'uses-dataset']);
    expect(graph.related('dataset:n3', { direction: 'in' }).map((h) => h.entity.id)).toEqual([
      'dataset:n2',
    ]);
    expect(
      graph
        .related('dataset:n3')
        .map((h) => h.entity.id)
        .sort()
    ).toEqual(['dataset:n2', 'dataset:n4']);
    expect(graph.related('dataset:n0', { direction: 'out', depth: 3, limit: 2 })).toHaveLength(2);
  });

  it('reads the column names out of an expression', () => {
    expect(
      expressionColumnNames("ifelse({status} = 'x', {Net Revenue} - {cost}, 0)").sort()
    ).toEqual(['Net Revenue', 'cost', 'status']);
  });
});
