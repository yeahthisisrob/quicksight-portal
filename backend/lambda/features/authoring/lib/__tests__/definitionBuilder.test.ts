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
    const at = (id: string) => elements.find((e: any) => e.ElementId === id);
    // A lone KPI takes the band; two charts share a row; the pivot is full width and tall, last.
    expect(at(sheet.Visuals[1].KPIVisual.VisualId)).toMatchObject({ ColumnIndex: 0, ColumnSpan: 36, RowSpan: 6, RowIndex: 0 });
    expect(at(sheet.Visuals[0].LineChartVisual.VisualId)).toMatchObject({ ColumnIndex: 0, ColumnSpan: 18, RowIndex: 6 });
    expect(at(sheet.Visuals[2].BarChartVisual.VisualId)).toMatchObject({ ColumnIndex: 18, ColumnSpan: 18, RowIndex: 6 });
    expect(at(sheet.Visuals[3].PivotTableVisual.VisualId)).toMatchObject({ ColumnIndex: 0, ColumnSpan: 36, RowSpan: 18, RowIndex: 18 });
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

  it('puts a lone table across the page and every filter in the control bar, typed by its column', () => {
    const { definition, warnings } = buildDefinition({
      datasets,
      visuals: [{ type: 'Table', title: 'Orders', identifier: 'orders', category: 'order_id', values: [{ column: 'revenue' }] }],
      filters: [
        { identifier: 'orders', column: 'Region', values: ['West'] },
        { identifier: 'orders', column: 'order_date' },
        { identifier: 'orders', column: 'revenue' },
        { identifier: 'orders', column: 'nope' },
      ],
    });
    const sheet = definition.Sheets[0];
    const grid = sheet.Layouts[0].Configuration.GridLayout.Elements;
    expect(grid).toEqual([
      expect.objectContaining({ ElementType: 'VISUAL', ColumnIndex: 0, ColumnSpan: 36, RowSpan: 18, RowIndex: 0 }),
    ]);

    expect(sheet.FilterControls.map((c: any) => Object.keys(c)[0])).toEqual(['Dropdown', 'DateTimePicker']);
    const bar = sheet.SheetControlLayouts[0].Configuration.GridLayout.Elements;
    expect(bar.map((e: any) => e.ElementId)).toEqual(sheet.FilterControls.map((c: any) => (Object.values(c)[0] as any).FilterControlId));
    expect(bar.every((e: any) => e.ElementType === 'FILTER_CONTROL')).toBe(true);

    const [region, date] = definition.FilterGroups.map((g: any) => g.Filters[0]);
    expect(region.CategoryFilter.Column).toEqual({ DataSetIdentifier: 'orders', ColumnName: 'region' });
    expect(region.CategoryFilter.Configuration.FilterListConfiguration.CategoryValues).toEqual(['West']);
    expect(date.TimeRangeFilter.NullOption).toBe('ALL_VALUES');
    expect(definition.FilterGroups[0].ScopeConfiguration.SelectedSheets.SheetVisualScopingConfigurations).toEqual([
      { SheetId: sheet.SheetId, Scope: 'ALL_VISUALS' },
    ]);
    expect(warnings).toEqual([
      "Filter on 'revenue' left out: a number filter needs min and max for its slider.",
      "Filter on 'nope' left out: 'orders' has no such column.",
    ]);

    const outline = buildOutline(definition)[0]!.elements;
    expect(outline.filter((e) => e.kind === 'filterControl').map((e) => e.placement)).toEqual(['controlBar', 'controlBar']);
  });

  it('gives a number filter a slider when its bounds are known', () => {
    const { definition } = buildDefinition({
      datasets,
      visuals: [{ type: 'KPI', title: 'Revenue', identifier: 'orders', values: [{ column: 'revenue' }] }],
      filters: [{ identifier: 'orders', column: 'revenue', min: 0, max: 1000 }],
    });
    expect(definition.Sheets[0].FilterControls[0].Slider).toMatchObject({ MinimumValue: 0, MaximumValue: 1000, StepSize: 10 });
    expect(definition.FilterGroups[0].Filters[0].NumericRangeFilter.RangeMaximum).toEqual({ StaticValue: 1000 });
  });
});
