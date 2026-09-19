import { describe, expect, it } from 'vitest';

import { applyOps, parseOps } from '../definitionOps';
import { buildOutline } from '../definitionOutline';
import { sampleDefinition } from './fixtures';

const grid = (d: any) => d.Sheets[0].Layouts[0].Configuration.GridLayout.Elements;
const visual = (d: any, id: string) =>
  d.Sheets[0].Visuals.map((w: any) => Object.values(w)[0] as any).find((v: any) => v.VisualId === id);

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
    expect(grid(definition).find((e: any) => e.ElementId === 'v2')).toMatchObject({ ColumnIndex: 0, RowIndex: 12 });
    expect(grid(definition).find((e: any) => e.ElementId === 'v1')).toMatchObject({ ColumnSpan: 36, RowSpan: 8 });
    expect(changes.map((c) => c.description)).toEqual([
      "Moved the KPI to column 0, row 12 on Overview",
      "Resized 'Revenue by status' to 36 columns by 8 rows on Overview",
    ]);
  });

  it('refuses a move that leaves the 36-column grid or an unknown element', () => {
    expect(() => applyOps(sampleDefinition(), [{ op: 'move', sheetId: 's1', elementId: 'v1', col: 30, row: 0 }])).toThrow('exceeds the 36-column grid');
    expect(() => applyOps(sampleDefinition(), [{ op: 'move', sheetId: 's1', elementId: 'nope', col: 0, row: 0 }])).toThrow("no element 'nope'");
    expect(() => applyOps(sampleDefinition(), [{ op: 'move', sheetId: 'zz', elementId: 'v1', col: 0, row: 0 }])).toThrow("no sheet 'zz'");
  });

  it('changes a bar chart to a line chart keeping the wells, then to a table and a pivot', () => {
    const asLine = applyOps(sampleDefinition(), [{ op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'LineChart' }]);
    const line = asLine.definition.Sheets[0].Visuals[0].LineChartVisual;
    expect(line.VisualId).toBe('v1');
    expect(line.Title.FormatText.PlainText).toBe('Revenue by status');
    expect(Object.keys(line.ChartConfiguration.FieldWells)).toEqual(['LineChartAggregatedFieldWells']);
    expect(line.ChartConfiguration.FieldWells.LineChartAggregatedFieldWells.Category[0].CategoricalDimensionField.Column.ColumnName).toBe('status');
    expect(asLine.changes[0]?.description).toContain("Changed 'Revenue by status' from a bar chart to a line chart");

    const asTable = applyOps(asLine.definition, [{ op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'Table' }]);
    const table = asTable.definition.Sheets[0].Visuals[0].TableVisual;
    expect(table.ChartConfiguration.FieldWells.TableAggregatedFieldWells.GroupBy).toHaveLength(1);
    expect(table.ChartConfiguration.FieldWells.TableAggregatedFieldWells.Values).toHaveLength(1);

    const asPivot = applyOps(asTable.definition, [{ op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'PivotTable' }]);
    const pivot = asPivot.definition.Sheets[0].Visuals[0].PivotTableVisual;
    expect(pivot.ChartConfiguration.FieldWells.PivotTableAggregatedFieldWells.Rows).toHaveLength(1);

    const asColumn = applyOps(sampleDefinition(), [{ op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'ColumnChart' }]);
    expect(asColumn.definition.Sheets[0].Visuals[0].BarChartVisual.ChartConfiguration.Orientation).toBe('VERTICAL');
    const asDonut = applyOps(sampleDefinition(), [{ op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'DonutChart' }]);
    expect(asDonut.definition.Sheets[0].Visuals[0].PieChartVisual.ChartConfiguration.DonutOptions.ArcOptions.ArcThickness).toBe('MEDIUM');
  });

  it('refuses to retype a KPI and refuses unsupported target types', () => {
    expect(() => applyOps(sampleDefinition(), [{ op: 'retype', sheetId: 's1', elementId: 'v2', visualType: 'LineChart' }])).toThrow('a KPI cannot be changed');
    expect(() => applyOps(sampleDefinition(), [{ op: 'retype', sheetId: 's1', elementId: 'v1', visualType: 'Gauge' as any }])).toThrow('not a type visuals can be changed to');
  });

  it('retitles, removes (also from filter scopes) and duplicates with fresh ids', () => {
    const base = sampleDefinition();
    base.FilterGroups[0].ScopeConfiguration = { SelectedSheets: { SheetVisualScopingConfigurations: [{ SheetId: 's1', Scope: 'SELECTED_VISUALS', VisualIds: ['v1', 'v2'] }] } };
    const { definition, changes } = applyOps(base, [
      { op: 'retitle', sheetId: 's1', elementId: 'v2', title: 'Margin %', subtitle: 'of revenue' },
      { op: 'duplicate', sheetId: 's1', elementId: 'v1', title: 'Revenue by status (copy)', col: 0, row: 24 },
      { op: 'remove', sheetId: 's1', elementId: 'v1' },
      { op: 'renameSheet', sheetId: 's1', name: 'Sales' },
    ]);
    expect(visual(definition, 'v2').Title.FormatText.PlainText).toBe('Margin %');
    expect(visual(definition, 'v2').Subtitle.FormatText.PlainText).toBe('of revenue');
    expect(visual(definition, 'v1')).toBeUndefined();
    expect(grid(definition).some((e: any) => e.ElementId === 'v1')).toBe(false);
    expect(definition.FilterGroups[0].ScopeConfiguration.SelectedSheets.SheetVisualScopingConfigurations[0].VisualIds).toEqual(['v2']);
    const copy = definition.Sheets[0].Visuals.map((w: any) => Object.values(w)[0] as any).find((v: any) => v.Title?.FormatText?.PlainText === 'Revenue by status (copy)');
    expect(copy).toBeDefined();
    expect(copy.VisualId).not.toBe('v1');
    const copiedFieldId = copy.ChartConfiguration.FieldWells.BarChartAggregatedFieldWells.Values[0].NumericalMeasureField.FieldId;
    expect(copiedFieldId).not.toBe('v1.revenue.1');
    expect(grid(definition).find((e: any) => e.ElementId === copy.VisualId)).toMatchObject({ ColumnIndex: 0, RowIndex: 24, ColumnSpan: 18, RowSpan: 12 });
    expect(definition.Sheets[0].Name).toBe('Sales');
    expect(changes.map((c) => c.kind)).toEqual(['visual', 'visual', 'visual', 'sheet']);
  });
});

describe('parseOps', () => {
  it('validates shapes and names the bad entry', () => {
    expect(parseOps(undefined)).toEqual([]);
    expect(parseOps([{ op: 'move', sheetId: 's', elementId: 'e', col: 1, row: 2 }])).toEqual([{ op: 'move', sheetId: 's', elementId: 'e', col: 1, row: 2 }]);
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
    expect(sheet!.elements[2]).toMatchObject({ kind: 'filterControl', visualType: 'Dropdown', title: 'Status' });
  });

  it('is total over garbage', () => {
    expect(buildOutline(null)).toEqual([]);
    expect(buildOutline({ Sheets: [{ SheetId: 'x' }] })).toEqual([{ sheetId: 'x', name: 'Sheet 1', layout: 'flow', elements: [] }]);
  });
});
