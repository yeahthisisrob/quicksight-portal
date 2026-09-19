import { describe, expect, it } from 'vitest';

import {
  applyCastRenames,
  applyTypeRules,
  castExpression,
  castPlan,
  currentEditableType,
} from '../definitionTypeRules';
import { sampleDefinition } from './fixtures';

const kinds = (d: any) => d.Sheets[0].Visuals.map((w: any) => Object.keys(w)[0]);

describe('currentEditableType', () => {
  it('tells bars from columns and pies from donuts', () => {
    expect(currentEditableType('BarChartVisual', { ChartConfiguration: { Orientation: 'VERTICAL' } })).toBe('ColumnChart');
    expect(currentEditableType('BarChartVisual', {})).toBe('BarChart');
    expect(currentEditableType('PieChartVisual', { ChartConfiguration: { DonutOptions: { ArcOptions: { ArcThickness: 'MEDIUM' } } } })).toBe('DonutChart');
    expect(currentEditableType('PieChartVisual', {})).toBe('PieChart');
    expect(currentEditableType('KPIVisual', {})).toBeNull();
  });
});

describe('applyTypeRules', () => {
  it('swaps a chart family across every matching visual, leaving the rest alone', () => {
    const { definition, changes, warnings } = applyTypeRules(sampleDefinition(), {
      chartFamily: [{ from: 'BarChart', to: 'ColumnChart' }],
    });
    const bar = definition.Sheets[0].Visuals.find((w: any) => w.BarChartVisual)!.BarChartVisual;
    expect(bar.ChartConfiguration.Orientation).toBe('VERTICAL');
    expect(changes).toHaveLength(1);
    expect(changes[0]!.description).toContain('column chart');
    expect(warnings).toEqual([]);
    expect(kinds(definition)).toEqual(kinds(sampleDefinition()));
  });

  it('refuses unknown types and skips a rule that changes nothing', () => {
    expect(() => applyTypeRules(sampleDefinition(), { chartFamily: [{ from: 'Bar' as any, to: 'Table' }] })).toThrow('must be one of');
    expect(applyTypeRules(sampleDefinition(), { chartFamily: [{ from: 'Table', to: 'Table' }] }).changes).toEqual([]);
  });

  it('turns gauges into KPIs and gives every KPI the template options', () => {
    const source = sampleDefinition();
    source.Sheets[0].Visuals.push({
      GaugeChartVisual: {
        VisualId: 'g1',
        Title: { Visibility: 'VISIBLE', FormatText: { PlainText: 'Attainment' } },
        ChartConfiguration: {
          FieldWells: {
            Values: [{ MeasureField: { NumericalMeasureField: { FieldId: 'f', Column: { DataSetIdentifier: 'orders', ColumnName: 'revenue' } } } }],
            TargetValues: [{ MeasureField: { NumericalMeasureField: { FieldId: 't', Column: { DataSetIdentifier: 'orders', ColumnName: 'cost' } } } }],
          },
          GaugeChartOptions: { Arc: {} },
        },
      },
    });
    const options = { Sparkline: { Visibility: 'VISIBLE', Type: 'AREA' }, Comparison: { ComparisonMethod: 'PERCENT_DIFFERENCE' } };
    const { definition, changes } = applyTypeRules(source, { kpi: true }, { templateKpiOptions: options });

    const kpis = definition.Sheets[0].Visuals.filter((w: any) => w.KPIVisual).map((w: any) => w.KPIVisual);
    expect(kpis.map((k: any) => k.VisualId)).toEqual(['v2', 'g1']);
    expect(kpis.every((k: any) => k.ChartConfiguration.KPIOptions?.Sparkline?.Type === 'AREA')).toBe(true);
    const converted = kpis.find((k: any) => k.VisualId === 'g1');
    expect(converted.ChartConfiguration.FieldWells.Values).toHaveLength(1);
    expect(converted.ChartConfiguration.FieldWells.TargetValues).toHaveLength(1);
    expect(converted.ChartConfiguration.GaugeChartOptions).toBeUndefined();
    expect(definition.Sheets[0].Visuals.some((w: any) => w.GaugeChartVisual)).toBe(false);
    expect(changes.map((c) => c.description)).toEqual([
      expect.stringContaining("takes the template's KPI options"),
      expect.stringContaining('from a gauge to a KPI'),
    ]);
  });
});

describe('casts', () => {
  it('knows which casts exist and which type changes need none', () => {
    expect(castExpression('order_date', 'STRING', 'DATETIME')).toBe('parseDate({order_date})');
    expect(castExpression('revenue', 'STRING', 'DECIMAL')).toBe('parseDecimal({revenue})');
    expect(castExpression('qty', 'STRING', 'INTEGER')).toBe('parseInt({qty})');
    expect(castExpression('code', 'INTEGER', 'STRING')).toBe('toString({code})');
    expect(castExpression('ts', 'INTEGER', 'DATETIME')).toBe('epochDate({ts})');
    expect(castExpression('x', 'INTEGER', 'DECIMAL')).toBeNull();
    expect(castExpression('x', 'DECIMAL', 'DECIMAL')).toBeNull();
    expect(castExpression('x', 'DATETIME', 'DECIMAL')).toBeNull();
  });

  it('plans a cast field and a rename for every column whose type changed, and rewrites the references', () => {
    const datasets = [
      {
        identifier: 'orders',
        current: { dataSetId: 'ds-old', dataSetArn: 'arn:old' },
        target: { dataSetId: 'ds-new', dataSetArn: 'arn:new', name: 'orders_gold', columnCount: 3 },
        columns: [
          { name: 'revenue', status: 'matched', resolvedTo: 'revenue', targetType: 'STRING', usage: {} },
          { name: 'order_date', status: 'mapped', resolvedTo: 'Order Date', targetType: 'STRING', usage: {} },
          { name: 'cost', status: 'matched', resolvedTo: 'cost', targetType: 'DECIMAL', usage: {} },
          { name: 'note', status: 'matched', resolvedTo: 'note', targetType: 'DECIMAL', usage: {} },
        ],
        unusedTargetColumns: [],
        summary: { matched: 3, mapped: 1, suggested: 0, missing: 0 },
      },
    ] as any;
    const current = new Map([
      ['orders', [
        { name: 'revenue', type: 'DECIMAL' },
        { name: 'order_date', type: 'DATETIME' },
        { name: 'cost', type: 'INTEGER' },
        { name: 'note', type: 'DATETIME' },
      ]],
    ]);

    const plan = castPlan(datasets, current);

    expect(plan.addCalculatedFields).toEqual([
      { identifier: 'orders', name: 'revenue_as_decimal', expression: 'parseDecimal({revenue})' },
      { identifier: 'orders', name: 'Order Date_as_datetime', expression: 'parseDate({Order Date})' },
    ]);
    expect(plan.renames.get('orders')).toEqual({ revenue: 'revenue_as_decimal', 'Order Date': 'Order Date_as_datetime' });
    expect(plan.warnings).toEqual([expect.stringContaining('note was DATETIME and is now DECIMAL')]);

    const definition = sampleDefinition();
    applyCastRenames(definition, new Map([['orders', { revenue: 'revenue_as_decimal' }]]));
    const text = JSON.stringify(definition.Sheets);
    expect(text).toContain('"ColumnName":"revenue_as_decimal"');
    expect(text).not.toMatch(/"ColumnName":"revenue"/);
    expect(definition.CalculatedFields[0].Expression).toBe('{revenue} - {cost}');
  });
});
