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
        {
          type: 'LineChart',
          title: 'Revenue over time',
          identifier: 'orders',
          category: 'order_date',
          granularity: 'WEEK',
          values: [{ column: 'revenue' }],
        },
        {
          type: 'KPI',
          title: 'Orders',
          identifier: 'orders',
          values: [{ column: 'order_id', aggregation: 'DISTINCT_COUNT' }],
        },
        {
          type: 'ColumnChart',
          title: 'Revenue by region',
          identifier: 'orders',
          category: 'region',
          values: [{ column: 'revenue', aggregation: 'AVERAGE' }],
          color: 'region',
        },
        {
          type: 'PivotTable',
          title: 'Region x month',
          identifier: 'orders',
          category: 'region',
          color: 'order_date',
          values: [{ column: 'revenue' }],
        },
      ],
    });

    expect(warnings).toEqual([]);
    const sheet = definition.Sheets[0];
    expect(sheet.Name).toBe('Sales');
    const kinds = sheet.Visuals.map((w: any) => Object.keys(w)[0]);
    expect(kinds).toEqual(['LineChartVisual', 'KPIVisual', 'BarChartVisual', 'PivotTableVisual']);

    const line =
      sheet.Visuals[0].LineChartVisual.ChartConfiguration.FieldWells.LineChartAggregatedFieldWells;
    expect(line.Category[0].DateDimensionField.DateGranularity).toBe('WEEK');
    expect(line.Values[0].NumericalMeasureField.AggregationFunction).toEqual({
      SimpleNumericalAggregation: 'SUM',
    });

    const kpi = sheet.Visuals[1].KPIVisual.ChartConfiguration.FieldWells;
    expect(kpi.Values[0].CategoricalMeasureField.AggregationFunction).toBe('DISTINCT_COUNT');

    const column = sheet.Visuals[2].BarChartVisual;
    expect(column.ChartConfiguration.Orientation).toBe('VERTICAL');
    expect(column.ChartConfiguration.FieldWells.BarChartAggregatedFieldWells.Colors).toHaveLength(
      1
    );

    const pivot =
      sheet.Visuals[3].PivotTableVisual.ChartConfiguration.FieldWells
        .PivotTableAggregatedFieldWells;
    expect(Object.keys(pivot).sort()).toEqual(['Columns', 'Rows', 'Values']);

    const elements = sheet.Layouts[0].Configuration.GridLayout.Elements;
    const at = (id: string) => elements.find((e: any) => e.ElementId === id);
    // A lone KPI takes the band; two charts share a row; the pivot is full width and tall, last.
    expect(at(sheet.Visuals[1].KPIVisual.VisualId)).toMatchObject({
      ColumnIndex: 0,
      ColumnSpan: 36,
      RowSpan: 6,
      RowIndex: 0,
    });
    expect(at(sheet.Visuals[0].LineChartVisual.VisualId)).toMatchObject({
      ColumnIndex: 0,
      ColumnSpan: 18,
      RowIndex: 6,
    });
    expect(at(sheet.Visuals[2].BarChartVisual.VisualId)).toMatchObject({
      ColumnIndex: 18,
      ColumnSpan: 18,
      RowIndex: 6,
    });
    expect(at(sheet.Visuals[3].PivotTableVisual.VisualId)).toMatchObject({
      ColumnIndex: 0,
      ColumnSpan: 36,
      RowSpan: 18,
      RowIndex: 18,
    });
    expect(elements.every((e: any) => e.ColumnIndex + e.ColumnSpan <= 36)).toBe(true);

    expect(collectDefinitionDatasets(definition).map((d) => d.identifier)).toEqual(['orders']);
    expect(buildOutline(definition)[0]!.elements).toHaveLength(4);
  });

  it('refuses what it cannot build as asked, each with the reason, rather than leaving it out', () => {
    const { errors } = buildDefinition({
      datasets,
      visuals: [
        {
          type: 'BarChart',
          title: 'Ghost',
          identifier: 'customers',
          category: 'x',
          values: [{ column: 'y' }],
        },
        {
          type: 'Table',
          title: 'Partial',
          identifier: 'orders',
          category: 'nope',
          values: [{ column: 'revenue' }, { column: 'gone' }],
        },
        {
          type: 'Sparkline' as any,
          title: 'Odd',
          identifier: 'orders',
          values: [{ column: 'revenue' }],
        },
      ],
      filters: [
        { identifier: 'orders', column: 'revenue' },
        { identifier: 'orders', column: 'nope' },
        { identifier: 'orders', column: 'region', control: 'slider' },
      ],
    });
    expect(errors).toEqual([
      expect.stringContaining("no dataset 'customers'"),
      "'Partial': 'nope', 'gone' are not in 'orders'.",
      expect.stringContaining('is not a type that can be built'),
      "Filter on 'revenue': a slider on 'revenue' needs min and max (min below max).",
      "Filter on 'nope': 'orders' has no such column.",
      "Filter on 'region': a slider control does not fit a text column; use dropdown or singleSelect or list.",
    ]);
    expect(() => buildDefinition({ datasets: [], visuals: [] })).toThrow('At least one dataset');
    expect(buildDefinition({ datasets, visuals: [] }).warnings).toEqual([
      'No visuals were asked for; the sheet is empty.',
    ]);
  });

  it('puts a lone table across the page and every filter in the control bar, typed by its column', () => {
    const { definition, warnings, errors } = buildDefinition({
      datasets,
      visuals: [
        {
          type: 'Table',
          title: 'Orders',
          identifier: 'orders',
          category: 'order_id',
          values: [{ column: 'revenue' }],
        },
      ],
      filters: [
        { identifier: 'orders', column: 'Region', values: ['West'] },
        { identifier: 'orders', column: 'order_date' },
        { identifier: 'orders', column: 'revenue', min: 0, max: 1000 },
      ],
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    const sheet = definition.Sheets[0];
    const grid = sheet.Layouts[0].Configuration.GridLayout.Elements;
    expect(grid).toEqual([
      expect.objectContaining({
        ElementType: 'VISUAL',
        ColumnIndex: 0,
        ColumnSpan: 36,
        RowSpan: 18,
        RowIndex: 0,
      }),
    ]);

    expect(sheet.FilterControls.map((c: any) => Object.keys(c)[0])).toEqual([
      'Dropdown',
      'DateTimePicker',
      'Slider',
    ]);
    const bar = sheet.SheetControlLayouts[0].Configuration.GridLayout.Elements;
    expect(bar.map((e: any) => e.ElementId)).toEqual(
      sheet.FilterControls.map((c: any) => (Object.values(c)[0] as any).FilterControlId)
    );
    expect(bar.every((e: any) => e.ElementType === 'FILTER_CONTROL')).toBe(true);

    const [region, date] = definition.FilterGroups.map((g: any) => g.Filters[0]);
    expect(region.CategoryFilter.Column).toEqual({
      DataSetIdentifier: 'orders',
      ColumnName: 'region',
    });
    expect(region.CategoryFilter.Configuration.FilterListConfiguration.CategoryValues).toEqual([
      'West',
    ]);
    expect(date.TimeRangeFilter.NullOption).toBe('ALL_VALUES');
    expect(
      definition.FilterGroups[0].ScopeConfiguration.SelectedSheets.SheetVisualScopingConfigurations
    ).toEqual([{ SheetId: sheet.SheetId, Scope: 'ALL_VISUALS' }]);

    const outline = buildOutline(definition)[0]!.elements;
    expect(outline.filter((e) => e.kind === 'filterControl').map((e) => e.placement)).toEqual([
      'controlBar',
      'controlBar',
      'controlBar',
    ]);
  });

  it('builds the control asked for, on the canvas when placed there, narrowing only the visuals named', () => {
    const { definition, errors } = buildDefinition({
      datasets,
      visuals: [
        {
          key: 'trend',
          type: 'LineChart',
          title: 'Revenue over time',
          identifier: 'orders',
          category: 'order_date',
          values: [{ column: 'revenue' }],
        },
        {
          key: 'detail',
          type: 'Table',
          title: 'Orders',
          identifier: 'orders',
          category: 'order_id',
          values: [{ column: 'revenue' }],
        },
      ],
      filters: [
        { identifier: 'orders', column: 'region', control: 'singleSelect', placement: 'canvas' },
        {
          identifier: 'orders',
          column: 'order_date',
          control: 'relativeDate',
          lastDays: 90,
          appliesTo: ['detail'],
        },
        { identifier: 'orders', column: 'order_id', control: 'list', appliesTo: ['nothing'] },
      ],
    });
    expect(errors).toEqual([
      "Filter on 'order_id' applies to 'nothing', which is not a visual on the sheet.",
    ]);
    const sheet = definition.Sheets[0];
    const [region, date] = sheet.FilterControls;
    expect(region.Dropdown.Type).toBe('SINGLE_SELECT');
    expect(date.RelativeDateTime.Title).toBe('order_date');
    expect(definition.FilterGroups[1].Filters[0].RelativeDatesFilter).toMatchObject({
      RelativeDateType: 'LAST',
      RelativeDateValue: 90,
    });

    // The canvas control sits above the visuals; the date control is in the bar.
    const grid = sheet.Layouts[0].Configuration.GridLayout.Elements;
    expect(grid[0]).toMatchObject({
      ElementId: region.Dropdown.FilterControlId,
      ElementType: 'FILTER_CONTROL',
      RowIndex: 0,
    });
    expect(grid.slice(1).every((e: any) => e.RowIndex >= 3)).toBe(true);
    expect(sheet.SheetControlLayouts[0].Configuration.GridLayout.Elements).toEqual([
      expect.objectContaining({ ElementId: date.RelativeDateTime.FilterControlId }),
    ]);

    const detailId = sheet.Visuals[1].TableVisual.VisualId;
    expect(
      definition.FilterGroups[1].ScopeConfiguration.SelectedSheets.SheetVisualScopingConfigurations
    ).toEqual([{ SheetId: sheet.SheetId, Scope: 'SELECTED_VISUALS', VisualIds: [detailId] }]);
  });

  it('gives a visual its interactions: a click that filters the others, or the visuals named', () => {
    const { definition, errors } = buildDefinition({
      datasets,
      sheetName: 'Sales',
      visuals: [
        {
          key: 'byRegion',
          type: 'BarChart',
          title: 'Revenue by region',
          identifier: 'orders',
          category: 'region',
          values: [{ column: 'revenue' }],
          actions: [
            { kind: 'filter', targets: ['detail'], fields: ['region'] },
            { kind: 'navigate', trigger: 'menu', sheet: 'Sales' },
          ],
        },
        {
          key: 'detail',
          type: 'Table',
          title: 'Orders',
          identifier: 'orders',
          category: 'order_id',
          values: [{ column: 'revenue' }],
          actions: [{ kind: 'filter' }, { kind: 'filter' }],
        },
      ],
    });
    expect(errors).toEqual([
      "'detail' has more than one action on select; a visual runs one on click, so make the others 'menu'.",
    ]);
    const [bar, table] = definition.Sheets[0].Visuals;
    const [filter, navigate] = bar.BarChartVisual.Actions;
    expect(filter).toMatchObject({
      Trigger: 'DATA_POINT_CLICK',
      Status: 'ENABLED',
      ActionOperations: [
        {
          FilterOperation: {
            SelectedFieldsConfiguration: {
              SelectedColumns: [{ DataSetIdentifier: 'orders', ColumnName: 'region' }],
            },
            TargetVisualsConfiguration: {
              SameSheetTargetVisualConfiguration: { TargetVisuals: [table.TableVisual.VisualId] },
            },
          },
        },
      ],
    });
    expect(navigate).toMatchObject({
      Trigger: 'DATA_POINT_MENU',
      ActionOperations: [
        {
          NavigationOperation: {
            LocalNavigationConfiguration: { TargetSheetId: definition.Sheets[0].SheetId },
          },
        },
      ],
    });
    expect(table.TableVisual.Actions).toHaveLength(1);
  });

  it('gives a number filter a slider when its bounds are known', () => {
    const { definition } = buildDefinition({
      datasets,
      visuals: [
        { type: 'KPI', title: 'Revenue', identifier: 'orders', values: [{ column: 'revenue' }] },
      ],
      filters: [{ identifier: 'orders', column: 'revenue', min: 0, max: 1000 }],
    });
    expect(definition.Sheets[0].FilterControls[0].Slider).toMatchObject({
      MinimumValue: 0,
      MaximumValue: 1000,
      StepSize: 10,
    });
    expect(definition.FilterGroups[0].Filters[0].NumericRangeFilter.RangeMaximum).toEqual({
      StaticValue: 1000,
    });
  });
});
