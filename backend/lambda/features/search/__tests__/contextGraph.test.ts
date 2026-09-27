import { describe, expect, it } from 'vitest';

import { buildContextGraph } from '../lib/buildContextGraph';
import { ContextGraph, entityId, MAX_DEPTH } from '../lib/contextGraph';
import type { SearchDocument } from '../types';

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
});

describe('buildContextGraph', () => {
  it('gives each calculated field its kind, read with the other fields of its asset', () => {
    const calc = (id: string, name: string, expression: string) =>
      ({
        type: 'calculated-field',
        id,
        name,
        expression,
        columns: [],
        calculatedFields: [name],
        tags: [],
        context: [],
        summary: name,
        path: '',
        definedIn: [{ type: 'analysis', id: 'a1', name: 'Sales' }],
      }) as unknown as SearchDocument;
    const graph = buildContextGraph({
      docs: [
        calc('k1', 'total', 'sum({revenue})'),
        calc('k2', 'share', '{total} / 2'),
        calc('k3', 'margin', '{revenue} - {cost}'),
        calc('k4', 'rolling', 'sumOver({revenue}, [{region}], PRE_FILTER)'),
      ],
      entries: {},
      listings: [],
      calculatedFields: new Map(),
      visuals: new Map(),
    });
    const attrs = (key: string) => graph.get(entityId('calculated-field', key))?.attributes;
    expect(attrs('k2')).toMatchObject({ kind: 'aggregate', materialisable: false });
    expect(attrs('k3')).toMatchObject({
      kind: 'row-level',
      stage: 'simple-calculations',
      materialisable: true,
    });
    expect(attrs('k4')).toMatchObject({ kind: 'lac-w', calcLevel: 'PRE_FILTER' });
  });
});

describe('field-level lineage', () => {
  const doc = (type: string, id: string, name: string, extra: Record<string, unknown> = {}) =>
    ({
      type,
      id,
      name,
      columns: [],
      calculatedFields: [],
      tags: [],
      context: [],
      summary: name,
      path: '',
      ...extra,
    }) as unknown as SearchDocument;

  /** gold (amt) <- orders (revenue, renamed from amt; margin) <- analysis Sales (share) <- a visual. */
  function lineage() {
    return buildContextGraph({
      docs: [
        doc('dataset', 'gold', 'orders_gold'),
        doc('dataset', 'orders', 'orders'),
        doc('analysis', 'a1', 'Sales'),
        doc('calculated-field', 'k-margin', 'margin', {
          expression: '{revenue} - {cost}',
          definedIn: [{ type: 'dataset', id: 'orders', name: 'orders' }],
        }),
        doc('calculated-field', 'k-share', 'share', {
          expression: '{margin} / {revenue}',
          definedIn: [{ type: 'analysis', id: 'a1', name: 'Sales' }],
        }),
        doc('visual', 'analysis:a1:v1', 'Share by region', {
          parent: { type: 'analysis', id: 'a1', name: 'Sales' },
        }),
      ],
      entries: {
        dataset: [
          { assetId: 'gold', metadata: {} },
          { assetId: 'orders', metadata: { lineageData: { datasetIds: ['gold'] } } },
        ],
        analysis: [{ assetId: 'a1', metadata: { lineageData: { datasetIds: ['orders'] } } }],
      },
      listings: [],
      calculatedFields: new Map([
        [
          'k-margin',
          {
            expression: '{revenue} - {cost}',
            definedIn: [{ type: 'dataset', id: 'orders', name: 'orders' }],
          },
        ],
        [
          'k-share',
          {
            expression: '{margin} / {revenue}',
            definedIn: [{ type: 'analysis', id: 'a1', name: 'Sales' }],
          },
        ],
      ]),
      visuals: new Map([
        [
          'analysis:a1:v1',
          {
            asset: { type: 'analysis', id: 'a1' },
            fields: new Map([
              ['share', undefined],
              ['region', 'orders'],
            ]),
          },
        ],
      ]),
      columns: [
        { datasetId: 'gold', name: 'amt' },
        { datasetId: 'gold', name: 'cost' },
        { datasetId: 'orders', name: 'revenue', sourceName: 'amt' },
        { datasetId: 'orders', name: 'cost' },
        { datasetId: 'orders', name: 'region' },
      ],
      calcDatasets: new Map([['analysis:a1:share', 'orders']]),
    });
  }

  const names = (hits: Array<{ entity: { id: string } }>) => hits.map((h) => h.entity.id).sort();

  it('traces a visual down to the source column, through fields and a rename', () => {
    const graph = lineage();
    const visual = entityId('visual', 'analysis:a1:v1');
    expect(names(graph.related(visual, { relations: ['shows'], direction: 'out' }))).toEqual([
      'calculated-field:k-share',
      'dataset-column:orders/region',
    ]);
    expect(
      names(
        graph.related('calculated-field:k-share', { relations: ['reads-field'], direction: 'out' })
      )
    ).toEqual(['calculated-field:k-margin', 'dataset-column:orders/revenue']);
    expect(
      graph.related('dataset-column:orders/revenue', {
        relations: ['derived-from'],
        direction: 'out',
      })
    ).toEqual([
      expect.objectContaining({
        entity: expect.objectContaining({ id: 'dataset-column:gold/amt' }),
        via: [{ relation: 'derived-from', direction: 'out', note: 'renamed' }],
      }),
    ]);
  });

  it('a visual names the asset it sits on', () => {
    expect(lineage().get(entityId('visual', 'analysis:a1:v1'))?.attributes).toMatchObject({
      assetType: 'analysis',
      assetId: 'a1',
      assetName: 'Sales',
    });
  });

  it('answers what a change to a source column touches, three hops up', () => {
    const graph = lineage();
    const touched = graph.related('dataset-column:orders/revenue', {
      relations: ['reads-field', 'shows'],
      direction: 'in',
      depth: 3,
    });
    expect(names(touched)).toEqual([
      'calculated-field:k-margin',
      'calculated-field:k-share',
      'visual:analysis:a1:v1',
    ]);
  });
});

describe('themes in the graph', () => {
  it('links each dashboard and analysis to the theme it wears', () => {
    const doc = (type: string, id: string, name: string) =>
      ({
        type,
        id,
        name,
        columns: [],
        calculatedFields: [],
        tags: [],
        context: [],
        summary: name,
        path: '',
      }) as unknown as SearchDocument;
    const entry = (assetId: string, metadata: Record<string, unknown> = {}) => ({
      assetId,
      metadata,
    });
    const graph = buildContextGraph({
      docs: [
        doc('theme', 'brand', 'Brand'),
        doc('dashboard', 'd1', 'Sales'),
        doc('analysis', 'a1', 'Draft'),
      ],
      entries: {
        theme: [entry('brand')],
        dashboard: [entry('d1', { themeArn: 'arn:aws:quicksight:us-east-1:1:theme/brand' })],
        analysis: [entry('a1')],
      },
      listings: [],
      calculatedFields: new Map(),
      visuals: new Map(),
    });
    expect(graph.related('theme:brand', { direction: 'in' }).map((h) => h.entity.id)).toEqual([
      'dashboard:d1',
    ]);
    expect(graph.relationCounts('dashboard:d1')).toContainEqual({
      relation: 'uses-theme',
      direction: 'out',
      count: 1,
    });
  });
});
