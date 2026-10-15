import { describe, expect, it } from 'vitest';

import {
  type FilterDataset,
  type FilterSheet,
  isScopeAnswer,
  MAX_SCOPE_OPTIONS,
  resolveFilterChange,
  selectedOf,
  sheetsOf,
} from '../filterChange';

const orders: FilterDataset = {
  identifier: 'orders',
  dataSetId: 'ds-1',
  name: 'Orders',
  columns: [
    { name: 'Region', type: 'STRING' },
    { name: 'Order date', type: 'DATETIME' },
    { name: 'Amount', type: 'DECIMAL' },
  ],
};
const returns: FilterDataset = {
  identifier: 'returns',
  dataSetId: 'ds-2',
  name: 'Returns',
  columns: [{ name: 'Region', type: 'STRING' }],
};

const overview: FilterSheet = {
  sheetId: 's1',
  name: 'Overview',
  visuals: [
    { id: 'v1', title: 'Sales by region', type: 'BarChart' },
    { id: 'v2', title: 'Orders by month', type: 'LineChart' },
  ],
};
const detail: FilterSheet = {
  sheetId: 's2',
  name: 'Detail',
  visuals: [{ id: 'v3', title: '', type: 'Table' }],
};

describe('resolveFilterChange', () => {
  it('places a filter on the one dataset that has the column and on a lone sheet with one visual, asking nothing', () => {
    const change = resolveFilterChange({
      filters: [{ column: 'region', control: 'dropdown' }],
      scope: {},
      sheets: [detail],
      datasets: [orders],
    });
    expect(change).toEqual({
      ops: [
        {
          op: 'addFilter',
          sheetId: 's2',
          identifier: 'orders',
          column: 'Region',
          columnType: 'STRING',
          control: 'dropdown',
        },
      ],
      summary: 'A filter on Region (as a dropdown) goes on Detail (every visual).',
    });
  });

  it('asks which visuals when the asset leaves the choice, with every sheet, each sheet and each visual as options', () => {
    const change = resolveFilterChange({
      filters: [{ column: 'region' }],
      scope: {},
      sheets: [overview, detail],
      datasets: [orders],
    });
    expect(change).toEqual({
      ask: {
        question: 'Which visuals should the Region filter narrow?',
        multi: true,
        allowOther: false,
        options: [
          { id: 'all', label: 'Every visual on every sheet', description: '2 sheets, 3 visuals' },
          { id: 'sheet:s1', label: 'Every visual on Overview', description: '2 visuals' },
          { id: 'sheet:s2', label: 'Every visual on Detail', description: '1 visual' },
          { id: 'visual:s1/v1', label: 'Sales by region', description: 'BarChart on Overview' },
          { id: 'visual:s1/v2', label: 'Orders by month', description: 'LineChart on Overview' },
          { id: 'visual:s2/v3', label: 'Untitled Table', description: 'Table on Detail' },
        ],
      },
    });
  });

  it('builds from the answer: a whole sheet, named visuals on another, or everything', () => {
    const input = {
      filters: [{ column: 'Region' }],
      scope: {},
      sheets: [overview, detail],
      datasets: [orders],
    };
    const mixed = resolveFilterChange({ ...input, chosen: ['sheet:s2', 'visual:s1/v2'] });
    expect(mixed).toMatchObject({
      ops: [
        { sheetId: 's1', column: 'Region', appliesTo: ['v2'] },
        { sheetId: 's2', column: 'Region' },
      ],
      summary: 'A filter on Region goes on Overview (Orders by month) and Detail (every visual).',
    });
    expect((mixed as any).ops[1].appliesTo).toBeUndefined();
    const all = resolveFilterChange({ ...input, chosen: ['all'] });
    expect((all as any).ops.map((o: any) => o.sheetId)).toEqual(['s1', 's2']);
  });

  it('takes the sheets and visuals the person named, and a named visual picks its sheet', () => {
    const bySheet = resolveFilterChange({
      filters: [{ column: 'region' }],
      scope: { sheets: ['overview'], visuals: 'all' },
      sheets: [overview, detail],
      datasets: [orders],
    });
    expect(bySheet).toMatchObject({ ops: [{ sheetId: 's1', column: 'Region' }] });
    const byVisual = resolveFilterChange({
      filters: [{ column: 'region' }],
      scope: { visuals: ['orders by month'] },
      sheets: [overview, detail],
      datasets: [orders],
    });
    expect(byVisual).toMatchObject({ ops: [{ sheetId: 's1', appliesTo: ['v2'] }] });
    // A name that matches nothing is asked about rather than guessed.
    expect(
      resolveFilterChange({
        filters: [{ column: 'region' }],
        scope: { visuals: ['the funnel'] },
        sheets: [overview, detail],
        datasets: [orders],
      })
    ).toHaveProperty('ask');
  });

  it('asks which dataset when two have the column, then uses the one chosen', () => {
    const input = {
      filters: [{ column: 'region' }],
      scope: { sheets: 'all' as const, visuals: 'all' as const },
      sheets: [overview],
      datasets: [orders, returns],
    };
    expect(resolveFilterChange(input)).toEqual({
      ask: {
        question: "Which dataset's Region should the filter use?",
        multi: false,
        allowOther: false,
        options: [
          {
            id: 'dataset:orders',
            label: 'Orders',
            description: 'Declared as orders',
            entityId: 'dataset:ds-1',
          },
          {
            id: 'dataset:returns',
            label: 'Returns',
            description: 'Declared as returns',
            entityId: 'dataset:ds-2',
          },
        ],
      },
    });
    expect(resolveFilterChange({ ...input, chosen: ['dataset:returns'] })).toMatchObject({
      ops: [{ identifier: 'returns', column: 'Region' }],
    });
    // Naming the dataset settles it too.
    expect(
      resolveFilterChange({ ...input, filters: [{ column: 'region', dataset: 'Returns' }] })
    ).toMatchObject({ ops: [{ identifier: 'returns' }] });
  });

  it('says what is in the way: no such column, no such dataset, a slider without bounds, no sheet', () => {
    expect(
      resolveFilterChange({
        filters: [{ column: 'regions' }],
        scope: {},
        sheets: [detail],
        datasets: [orders],
      })
    ).toEqual({
      problem: 'No dataset it reads has a column named regions; the nearest are Region.',
    });
    expect(
      resolveFilterChange({
        filters: [{ column: 'region', dataset: 'Shipments' }],
        scope: {},
        sheets: [detail],
        datasets: [orders],
      })
    ).toEqual({
      problem: 'It does not read a dataset called Shipments; it reads Orders.',
    });
    expect(
      resolveFilterChange({
        filters: [{ column: 'amount' }],
        scope: {},
        sheets: [detail],
        datasets: [orders],
      })
    ).toEqual({
      problem:
        'A filter on Amount is a range slider, which needs its bounds: say between what and what.',
    });
    expect(
      resolveFilterChange({
        filters: [{ column: 'amount', min: 0, max: 100 }],
        scope: {},
        sheets: [detail],
        datasets: [orders],
      })
    ).toMatchObject({ ops: [{ column: 'Amount', min: 0, max: 100 }] });
    expect(
      resolveFilterChange({ filters: [{ column: 'region' }], scope: {}, sheets: [], datasets: [] })
    ).toEqual({ problem: 'It has no sheets to put a filter on.' });
  });

  it('names the visuals instead of listing them when there are too many for cards', () => {
    const busy: FilterSheet = {
      sheetId: 's9',
      name: 'Busy',
      visuals: Array.from({ length: MAX_SCOPE_OPTIONS }, (_, i) => ({
        id: `v${i}`,
        title: `Chart ${i}`,
      })),
    };
    const change = resolveFilterChange({
      filters: [{ column: 'region' }],
      scope: {},
      sheets: [busy],
      datasets: [orders],
    });
    expect(change).toMatchObject({
      ask: {
        allowOther: true,
        options: [{ id: 'sheet:s9' }],
      },
    });
    expect((change as any).ask.question).toContain('type the names');
  });

  it('reads sheets from an outline and ids from an answer', () => {
    expect(
      sheetsOf([
        {
          sheetId: 's1',
          name: 'Overview',
          elements: [
            { elementId: 'v1', kind: 'visual', visualType: 'BarChart', title: 'Sales' },
            { elementId: 'c1', kind: 'filterControl', title: 'Region' },
          ],
        },
      ])
    ).toEqual([
      {
        sheetId: 's1',
        name: 'Overview',
        visuals: [{ id: 'v1', title: 'Sales', type: 'BarChart' }],
      },
    ]);
    expect(selectedOf({ selected: ['all', 3] })).toEqual(['all']);
    expect(selectedOf('no')).toEqual([]);
    expect(isScopeAnswer(['sheet:s1', 'visual:s1/v1'])).toBe(true);
    expect(isScopeAnswer(['order_date'])).toBe(false);
    expect(isScopeAnswer([])).toBe(false);
  });
});
