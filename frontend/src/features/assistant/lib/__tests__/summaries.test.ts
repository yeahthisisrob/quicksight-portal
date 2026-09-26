import { describe, expect, it } from 'vitest';

import type { WireframeElement, WireframeModel } from '@/entities/definition';

import { buildSummary, wireframeSummary } from '../summaries';

function element(
  id: string,
  kind: WireframeElement['kind'],
  visualType?: string
): WireframeElement {
  return { id, kind, visualType, position: { type: 'flow', index: 0 }, fieldWells: [] };
}

function model(sheets: Array<Pick<WireframeModel['sheets'][number], 'elements' | 'controlBar'>>) {
  return {
    sheets: sheets.map((s, i) => ({ id: `s${i}`, name: `Sheet ${i}`, layout: 'grid', ...s })),
    datasets: [],
    visualCount: 0,
    parameterCount: 0,
    filterGroupCount: 0,
    calculatedFieldCount: 0,
  } as WireframeModel;
}

describe('wireframeSummary', () => {
  it('counts visuals by type and the filters in the control bar', () => {
    expect(
      wireframeSummary(
        model([
          {
            elements: [
              element('t', 'visual', 'Table'),
              element('b1', 'visual', 'BarChart'),
              element('b2', 'visual', 'BarChart'),
            ],
            controlBar: [element('f', 'filterControl', 'Dropdown')],
          },
        ])
      )
    ).toBe('2 bar charts · 1 table · 1 filter in the control bar');
  });

  it('names the sheets when there are several, and folds rare types into "more"', () => {
    expect(
      wireframeSummary(
        model([
          {
            elements: [
              element('k', 'visual', 'KPI'),
              element('k2', 'visual', 'KPI'),
              element('l', 'visual', 'LineChart'),
            ],
            controlBar: [],
          },
          {
            elements: [element('p', 'visual', 'PieChart'), element('t', 'visual', 'PivotTable')],
            controlBar: [],
          },
        ])
      )
    ).toBe('2 sheets · 2 KPIs · 1 line chart · 1 pie chart · 1 more');
    expect(wireframeSummary(model([{ elements: [], controlBar: [] }]))).toBe('no visuals');
  });
});

describe('buildSummary', () => {
  const create = (body: Record<string, unknown>) =>
    ({ create: { assetType: 'analysis', name: 'x', datasets: [], ...body } }) as never;
  const edit = (request: Record<string, unknown>) =>
    ({ edit: { assetType: 'analysis', assetId: 'a1', request } }) as never;

  it('lists what a create builds: visuals, where its filters sit, its interactions', () => {
    expect(
      buildSummary(
        create({
          visuals: [
            { type: 'Table', title: 't', identifier: 'o', values: [] },
            {
              type: 'BarChart',
              title: 'b',
              identifier: 'o',
              values: [],
              actions: [{ kind: 'filter' }],
            },
          ],
          filters: [
            { identifier: 'o', column: 'region' },
            { identifier: 'o', column: 'status', placement: 'canvas' },
          ],
        })
      )
    ).toBe(
      '1 table · 1 bar chart · 1 filter in the control bar · 1 filter on the canvas · 1 interaction'
    );
    expect(buildSummary(create({ ask: 'margin by region' }))).toBe('visuals proposed from the ask');
  });

  it('counts what an edit changes, copies and swaps', () => {
    expect(
      buildSummary(
        edit({
          mode: 'update',
          rebinds: [],
          ops: [
            { op: 'addFilter', sheetId: 's' },
            { op: 'move', sheetId: 's' },
            { op: 'move', sheetId: 's' },
            { op: 'addVisual', sheetId: 's' },
          ],
        })
      )
    ).toBe('1 filter added · 2 elements moved · 1 visual added');
    expect(
      buildSummary(edit({ mode: 'clone', rebinds: [{ identifier: 'o', targetDataSetId: 'g' }] }))
    ).toBe('a copy · 1 dataset swapped');
  });

  it('says nothing about a build with nothing in it', () => {
    expect(buildSummary(undefined)).toBeUndefined();
    expect(buildSummary(edit({ mode: 'update', rebinds: [] }))).toBeUndefined();
  });
});
