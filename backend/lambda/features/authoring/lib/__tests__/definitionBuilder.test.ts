import { describe, expect, it } from 'vitest';

import { buildDefinition } from '../definitionBuilder';
import { collectDefinitionDatasets } from '../definitionColumns';
import { buildOutline } from '../definitionOutline';

const datasets = [
  {
    identifier: 'orders',
    dataSetArn: 'arn:aws:quicksight:us-east-1:1:dataset/orders',
    columns: [
      { name: 'order_date', type: 'DATETIME' },
      { name: 'region', type: 'STRING' },
      { name: 'revenue', type: 'DECIMAL' },
      { name: 'order_id', type: 'STRING' },
    ],
  },
];

describe('buildDefinition', () => {
  it('builds typed field wells per visual, KPIs first on the grid, and an outline the rest of authoring understands', () => {
    const { definition, warnings } = buildDefinition({
      datasets,
      sheetName: 'Sales',
      visuals: [
        { type: 'LineChart', title: 'Revenue over time', identifier: 'orders', category: 'order_date', granularity: 'WEEK', values: [{ column: 'revenue' }] },
        { type: 'KPI', title: 'Orders', identifier: 'orders', values: [{ column: 'order_id', aggregation: 'DISTINCT_COUNT' }] },
        { type: 'ColumnChart', title: 'Revenue by region', identifier: 'orders', category: 'region', values: [{ column: 'revenue', aggregation: 'AVERAGE' }], color: 'region' },
        { type: 'PivotTable', title: 'Region x month', identifier: 'orders', category: 'region', color: 'order_date', values: [{ column: 'revenue' }] },
      ],
    });

    expect(warnings).toEqual([]);
    const sheet = definition.Sheets[0];
    expect(sheet.Name).toBe('Sales');
    const kinds = sheet.Visuals.map((w: any) => Object.keys(w)[0]);
    expect(kinds).toEqual(['LineChartVisual', 'KPIVisual', 'BarChartVisual', 'PivotTableVisual']);

    const line = sheet.Visuals[0].LineChartVisual.ChartConfiguration.FieldWells.LineChartAggregatedFieldWells;
    expect(line.Category[0].DateDimensionField.DateGranularity).toBe('WEEK');
    expect(line.Values[0].NumericalMeasureField.AggregationFunction).toEqual({ SimpleNumericalAggregation: 'SUM' });

    const kpi = sheet.Visuals[1].KPIVisual.ChartConfiguration.FieldWells;
    expect(kpi.Values[0].CategoricalMeasureField.AggregationFunction).toBe('DISTINCT_COUNT');

    const column = sheet.Visuals[2].BarChartVisual;
    expect(column.ChartConfiguration.Orientation).toBe('VERTICAL');
    expect(column.ChartConfiguration.FieldWells.BarChartAggregatedFieldWells.Colors).toHaveLength(1);

    const pivot = sheet.Visuals[3].PivotTableVisual.ChartConfiguration.FieldWells.PivotTableAggregatedFieldWells;
    expect(Object.keys(pivot).sort()).toEqual(['Columns', 'Rows', 'Values']);

    const elements = sheet.Layouts[0].Configuration.GridLayout.Elements;
    expect(elements[0]).toMatchObject({ ElementId: sheet.Visuals[1].KPIVisual.VisualId, ColumnSpan: 9, RowSpan: 6, RowIndex: 0 });
    expect(elements.every((e: any) => e.ColumnIndex + e.ColumnSpan <= 36)).toBe(true);

    expect(collectDefinitionDatasets(definition).map((d) => d.identifier)).toEqual(['orders']);
    expect(buildOutline(definition)[0]!.elements).toHaveLength(4);
  });

  it('leaves out what it cannot build and says why', () => {
    const { definition, warnings } = buildDefinition({
      datasets,
      visuals: [
        { type: 'BarChart', title: 'Ghost', identifier: 'customers', category: 'x', values: [{ column: 'y' }] },
        { type: 'Table', title: 'Missing values', identifier: 'orders', category: 'region', values: [{ column: 'nope' }] },
        { type: 'Table', title: 'Partial', identifier: 'orders', category: 'nope', values: [{ column: 'revenue' }, { column: 'nope' }] },
        { type: 'Sparkline' as any, title: 'Odd', identifier: 'orders', values: [{ column: 'revenue' }] },
      ],
    });
    expect(definition.Sheets[0].Visuals).toHaveLength(1);
    expect(warnings).toEqual([
      expect.stringContaining("no dataset 'customers'"),
      expect.stringContaining("'nope' is not in 'orders' and was left out"),
      expect.stringContaining('none of its values exist'),
      expect.stringContaining("so it has no category"),
      expect.stringContaining("'nope' is not in 'orders' and was left out"),
      expect.stringContaining('is not a type that can be built'),
    ]);
    expect(() => buildDefinition({ datasets: [], visuals: [] })).toThrow('At least one dataset');
    expect(buildDefinition({ datasets, visuals: [] }).warnings).toEqual(['No visual could be built; the sheet is empty.']);
  });
});
