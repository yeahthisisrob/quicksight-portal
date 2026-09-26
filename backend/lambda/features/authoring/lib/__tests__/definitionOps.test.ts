import { describe, expect, it } from 'vitest';

import { applyOps, parseOps } from '../definitionOps';
import { buildOutline } from '../definitionOutline';
import { sampleDefinition } from './fixtures';

const grid = (d: any) => d.Sheets[0].Layouts[0].Configuration.GridLayout.Elements;
const visual = (d: any, id: string) =>
  d.Sheets[0].Visuals.map((w: any) => Object.values(w)[0] as any).find(
    (v: any) => v.VisualId === id
  );

describe('applyOps', () => {
  it('never mutates the input', () => {
    const input = sampleDefinition();
    const snapshot = JSON.stringify(input);
    applyOps(input, [{ op: 'move', sheetId: 's1', elementId: 'v1', col: 18, row: 12 }]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('moves and resizes grid elements and describes it', () => {
    const { definition, changes } = applyOps(sampleDefinition(), [
      { op: 'move', sheetId: 's1', elementId: 'v2', col: 0, row: 12 },
      { op: 'resize', sheetId: 's1', elementId: 'v1', colSpan: 36, rowSpan: 8 },
    ]);
    expect(grid(definition).find((e: any) => e.ElementId === 'v2')).toMatchObject({
      ColumnIndex: 0,
      RowIndex: 12,
    });
    expect(grid(definition).find((e: any) => e.ElementId === 'v1')).toMatchObject({
      ColumnSpan: 36,
      RowSpan: 8,
    });
    expect(changes.map((c) => c.description)).toEqual([
      'Moved the KPI to column 0, row 12 on Overview',
      "Resized 'Revenue by status' to 36 columns by 8 rows on Overview",
    ]);
  });

  it('refuses a move that leaves the 36-column grid or an unknown element', () => {
    expect(() =>
      applyOps(sampleDefinition(), [
        { op: 'move', sheetId: 's1', elementId: 'v1', col: 30, row: 0 },
      ])
    ).toThrow('exceeds the 36-column grid');
    expect(() =>
      applyOps(sampleDefinition(), [
        { op: 'move', sheetId: 's1', elementId: 'nope', col: 0, row: 0 },
      ])
    ).toThrow("no element 'nope'");
    expect(() =>
      applyOps(sampleDefinition(), [{ op: 'move', sheetId: 'zz', elementId: 'v1', col: 0, row: 0 }])
    ).toThrow("no sheet 'zz'");
  });

  it('changes a bar chart to a line chart keeping the wells, then to a table and a pivot', () => {
    const asLine = applyOps(sampleDefinition(), [
      { op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'LineChart' },
    ]);
    const line = asLine.definition.Sheets[0].Visuals[0].LineChartVisual;
    expect(line.VisualId).toBe('v1');
    expect(line.Title.FormatText.PlainText).toBe('Revenue by status');
    expect(Object.keys(line.ChartConfiguration.FieldWells)).toEqual([
      'LineChartAggregatedFieldWells',
    ]);
    expect(
      line.ChartConfiguration.FieldWells.LineChartAggregatedFieldWells.Category[0]
        .CategoricalDimensionField.Column.ColumnName
    ).toBe('status');
    expect(asLine.changes[0]?.description).toContain(
      "Changed 'Revenue by status' from a bar chart to a line chart"
    );

    const asTable = applyOps(asLine.definition, [
      { op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'Table' },
    ]);
    const table = asTable.definition.Sheets[0].Visuals[0].TableVisual;
    expect(table.ChartConfiguration.FieldWells.TableAggregatedFieldWells.GroupBy).toHaveLength(1);
    expect(table.ChartConfiguration.FieldWells.TableAggregatedFieldWells.Values).toHaveLength(1);

    const asPivot = applyOps(asTable.definition, [
      { op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'PivotTable' },
    ]);
    const pivot = asPivot.definition.Sheets[0].Visuals[0].PivotTableVisual;
    expect(pivot.ChartConfiguration.FieldWells.PivotTableAggregatedFieldWells.Rows).toHaveLength(1);

    const asColumn = applyOps(sampleDefinition(), [
      { op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'ColumnChart' },
    ]);
    expect(
      asColumn.definition.Sheets[0].Visuals[0].BarChartVisual.ChartConfiguration.Orientation
    ).toBe('VERTICAL');
    const asDonut = applyOps(sampleDefinition(), [
      { op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'DonutChart' },
    ]);
    expect(
      asDonut.definition.Sheets[0].Visuals[0].PieChartVisual.ChartConfiguration.DonutOptions
        .ArcOptions.ArcThickness
    ).toBe('MEDIUM');
  });

  it('refuses to retype a KPI and refuses unsupported target types', () => {
    expect(() =>
      applyOps(sampleDefinition(), [
        { op: 'retype', sheetId: 's1', elementId: 'v2', visualType: 'LineChart' },
      ])
    ).toThrow('a KPI cannot be changed');
    expect(() =>
      applyOps(sampleDefinition(), [
        { op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'Gauge' as any },
      ])
    ).toThrow('not a type visuals can be changed to');
  });

  it('retitles, removes (also from filter scopes) and duplicates with fresh ids', () => {
    const base = sampleDefinition();
    base.FilterGroups[0].ScopeConfiguration = {
      SelectedSheets: {
        SheetVisualScopingConfigurations: [
          { SheetId: 's1', Scope: 'SELECTED_VISUALS', VisualIds: ['v1', 'v2'] },
        ],
      },
    };
    const { definition, changes } = applyOps(base, [
      { op: 'retitle', sheetId: 's1', elementId: 'v2', title: 'Margin %', subtitle: 'of revenue' },
      {
        op: 'duplicate',
        sheetId: 's1',
        elementId: 'v1',
        title: 'Revenue by status (copy)',
        col: 0,
        row: 24,
      },
      { op: 'remove', sheetId: 's1', elementId: 'v1' },
      { op: 'renameSheet', sheetId: 's1', name: 'Sales' },
    ]);
    expect(visual(definition, 'v2').Title.FormatText.PlainText).toBe('Margin %');
    expect(visual(definition, 'v2').Subtitle.FormatText.PlainText).toBe('of revenue');
    expect(visual(definition, 'v1')).toBeUndefined();
    expect(grid(definition).some((e: any) => e.ElementId === 'v1')).toBe(false);
    expect(
      definition.FilterGroups[0].ScopeConfiguration.SelectedSheets
        .SheetVisualScopingConfigurations[0].VisualIds
    ).toEqual(['v2']);
    const copy = definition.Sheets[0].Visuals.map((w: any) => Object.values(w)[0] as any).find(
      (v: any) => v.Title?.FormatText?.PlainText === 'Revenue by status (copy)'
    );
    expect(copy).toBeDefined();
    expect(copy.VisualId).not.toBe('v1');
    const copiedFieldId =
      copy.ChartConfiguration.FieldWells.BarChartAggregatedFieldWells.Values[0]
        .NumericalMeasureField.FieldId;
    expect(copiedFieldId).not.toBe('v1.revenue.1');
    expect(grid(definition).find((e: any) => e.ElementId === copy.VisualId)).toMatchObject({
      ColumnIndex: 0,
      RowIndex: 24,
      ColumnSpan: 18,
      RowSpan: 12,
    });
    expect(definition.Sheets[0].Name).toBe('Sales');
    expect(changes.map((c) => c.kind)).toEqual(['visual', 'visual', 'visual', 'sheet']);
  });
});

describe('parseOps', () => {
  it('validates shapes and names the bad entry', () => {
    expect(parseOps(undefined)).toEqual([]);
    expect(parseOps([{ op: 'move', sheetId: 's', elementId: 'e', col: 1, row: 2 }])).toEqual([
      { op: 'move', sheetId: 's', elementId: 'e', col: 1, row: 2 },
    ]);
    expect(() => parseOps([{ op: 'move', sheetId: 's' }])).toThrow('ops[0].elementId is required');
    expect(() => parseOps([{ op: 'explode', sheetId: 's' }])).toThrow("ops[0].op 'explode'");
    expect(() => parseOps('x')).toThrow('ops must be an array');
  });
});

describe('buildOutline', () => {
  it('lists each sheet with ids, types, titles, positions and field wells', () => {
    const [sheet] = buildOutline(sampleDefinition());
    expect(sheet).toMatchObject({ sheetId: 's1', name: 'Overview', layout: 'grid' });
    expect(sheet!.elements.map((e) => e.elementId)).toEqual(['v1', 'v2', 'c1', 'c2']);
    expect(sheet!.elements[0]).toMatchObject({
      kind: 'visual',
      visualType: 'BarChart',
      title: 'Revenue by status',
      col: 0,
      row: 0,
      colSpan: 18,
      rowSpan: 12,
      fieldWells: [
        { role: 'Category', fields: ['status'] },
        { role: 'Values', fields: ['SUM(revenue)'] },
      ],
    });
    expect(sheet!.elements[2]).toMatchObject({
      kind: 'filterControl',
      visualType: 'Dropdown',
      title: 'Status',
    });
  });

  it('is total over garbage', () => {
    expect(buildOutline(null)).toEqual([]);
    expect(buildOutline({ Sheets: [{ SheetId: 'x' }] })).toEqual([
      { sheetId: 'x', name: 'Sheet 1', layout: 'flow', elements: [] },
    ]);
  });

  it('adds a filter by column, typed by how the definition uses it, into the control bar, and removes it again', () => {
    const { definition, changes } = applyOps(sampleDefinition(), [
      { op: 'addFilter', sheetId: 's1', identifier: 'orders', column: 'order_date' },
      {
        op: 'addFilter',
        sheetId: 's1',
        identifier: 'orders',
        column: 'status',
        values: ['closed'],
      },
    ]);
    const sheet = definition.Sheets[0];
    const controls = sheet.FilterControls.slice(-2).map((c: any) => Object.keys(c)[0]);
    expect(controls).toEqual(['DateTimePicker', 'Dropdown']);
    const bar = sheet.SheetControlLayouts[0].Configuration.GridLayout.Elements.map(
      (e: any) => e.ElementId
    );
    const ids = sheet.FilterControls.slice(-2).map(
      (c: any) => (Object.values(c)[0] as any).FilterControlId
    );
    expect(bar).toEqual(ids);
    const statusFilter = definition.FilterGroups.at(-1).Filters[0].CategoryFilter;
    expect(statusFilter.Column).toEqual({ DataSetIdentifier: 'orders', ColumnName: 'status' });
    expect(changes.map((c) => c.kind)).toEqual(['filter', 'filter']);
    expect(
      buildOutline(definition)[0]!.elements.filter((e) => e.placement === 'controlBar')
    ).toHaveLength(2);

    const removed = applyOps(definition, [{ op: 'remove', sheetId: 's1', elementId: ids[0] }])
      .definition.Sheets[0];
    expect(
      removed.SheetControlLayouts[0].Configuration.GridLayout.Elements.map((e: any) => e.ElementId)
    ).toEqual([ids[1]]);
    expect(
      removed.FilterControls.some(
        (c: any) => (Object.values(c)[0] as any).FilterControlId === ids[0]
      )
    ).toBe(false);
  });

  it('refuses a filter on an ARN or an undeclared identifier, and a number filter without bounds', () => {
    expect(() =>
      applyOps(sampleDefinition(), [
        {
          op: 'addFilter',
          sheetId: 's1',
          identifier: 'arn:aws:quicksight:us-east-1:1:dataset/orders',
          column: 'status',
        },
      ])
    ).toThrow(
      "no dataset identifier 'arn:aws:quicksight:us-east-1:1:dataset/orders'; the definition declares orders, regions"
    );
    expect(() =>
      applyOps(sampleDefinition(), [
        { op: 'addFilter', sheetId: 's1', identifier: 'orders', column: 'revenue' },
      ])
    ).toThrow('needs min and max');
    expect(() => parseOps([{ op: 'addFilter', sheetId: 's1', column: 'x' }])).toThrow(
      'not its ARN'
    );
  });

  it('adds a filter with the control asked for, on the canvas, narrowing only the visual named', () => {
    const { definition, changes } = applyOps(sampleDefinition(), [
      {
        op: 'addFilter',
        sheetId: 's1',
        identifier: 'orders',
        column: 'status',
        control: 'list',
        placement: 'canvas',
        appliesTo: ['Revenue by status'],
      },
    ]);
    const sheet = definition.Sheets[0];
    const control = sheet.FilterControls.at(-1);
    expect(Object.keys(control)).toEqual(['List']);
    const cells = sheet.Layouts[0].Configuration.GridLayout.Elements;
    expect(cells.at(-1)).toMatchObject({
      ElementId: control.List.FilterControlId,
      ElementType: 'FILTER_CONTROL',
    });
    expect(
      definition.FilterGroups.at(-1).ScopeConfiguration.SelectedSheets
        .SheetVisualScopingConfigurations
    ).toEqual([{ SheetId: 's1', Scope: 'SELECTED_VISUALS', VisualIds: ['v1'] }]);
    expect(changes[0]!.description).toContain('to the canvas of Overview');
    expect(() =>
      applyOps(sampleDefinition(), [
        {
          op: 'addFilter',
          sheetId: 's1',
          identifier: 'orders',
          column: 'status',
          control: 'slider',
        },
      ])
    ).toThrow('a slider control does not fit a text column');
  });

  it('adds a visual from column names, typed by the dataset, below everything else', () => {
    const columns = new Map([
      ['order_date', 'DATETIME'],
      ['revenue', 'DECIMAL'],
    ]);
    const { definition, changes } = applyOps(
      sampleDefinition(),
      [
        {
          op: 'addVisual',
          sheetId: 's1',
          visual: {
            type: 'LineChart',
            title: 'Revenue over time',
            identifier: 'orders',
            category: 'order_date',
            values: [{ column: 'revenue' }],
          },
        },
      ],
      (identifier, name) =>
        identifier === 'orders' && columns.has(name)
          ? { name, type: columns.get(name) as string }
          : undefined
    );
    const sheet = definition.Sheets[0];
    const line = sheet.Visuals.at(-1).LineChartVisual;
    expect(
      line.ChartConfiguration.FieldWells.LineChartAggregatedFieldWells.Category[0]
        .DateDimensionField.Column
    ).toEqual({ DataSetIdentifier: 'orders', ColumnName: 'order_date' });
    const cells = sheet.Layouts[0].Configuration.GridLayout.Elements;
    const placed = cells.find((e: any) => e.ElementId === line.VisualId);
    const others = cells.filter((e: any) => e.ElementId !== line.VisualId);
    expect(placed.RowIndex).toBe(Math.max(...others.map((e: any) => e.RowIndex + e.RowSpan)));
    expect(changes[0]!.description).toBe("Added a line chart 'Revenue over time' to Overview");
    expect(() =>
      applyOps(sampleDefinition(), [
        {
          op: 'addVisual',
          sheetId: 's1',
          visual: { type: 'Table', title: 'X', identifier: 'orders', values: [{ column: 'nope' }] },
        },
      ])
    ).toThrow("'X': 'nope' is not in 'orders'.");
  });

  it('adds an action filter to a visual by its title, and refuses a second click action', () => {
    const { definition, changes } = applyOps(sampleDefinition(), [
      {
        op: 'addAction',
        sheetId: 's1',
        elementId: 'Revenue by status',
        action: { kind: 'filter' },
      },
    ]);
    const bar = definition.Sheets[0].Visuals.find((v: any) => v.BarChartVisual).BarChartVisual;
    expect(bar.Actions).toEqual([
      expect.objectContaining({
        Trigger: 'DATA_POINT_CLICK',
        ActionOperations: [
          {
            FilterOperation: {
              SelectedFieldsConfiguration: { SelectedFieldOptions: 'ALL_FIELDS' },
              TargetVisualsConfiguration: {
                SameSheetTargetVisualConfiguration: { TargetVisualOptions: 'ALL_VISUALS' },
              },
            },
          },
        ],
      }),
    ]);
    expect(changes[0]!.description).toBe(
      'Revenue by status now filters other visuals when a data point is clicked'
    );
    expect(() =>
      applyOps(definition, [
        { op: 'addAction', sheetId: 's1', elementId: 'v1', action: { kind: 'filter' } },
      ])
    ).toThrow('already runs an action on click');
    expect(() =>
      parseOps([{ op: 'addAction', sheetId: 's1', elementId: 'v1', action: { kind: 'drill' } }])
    ).toThrow('ops[0].action.kind must be one of filter, navigate');
  });
});
