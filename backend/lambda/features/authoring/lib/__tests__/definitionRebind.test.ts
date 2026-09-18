import { describe, expect, it } from 'vitest';

import { walkColumnIdentifiers } from '../definitionColumns';
import { rebindDefinition, rewriteExpression } from '../definitionRebind';
import { ORDERS_ARN, REGIONS_ARN, sampleDefinition } from './fixtures';

const GOLD_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/orders-gold';

describe('rewriteExpression', () => {
  it('renames mapped column tokens and leaves the rest', () => {
    expect(rewriteExpression('{revenue} - {cost}', { revenue: 'net_revenue' })).toBe(
      '{net_revenue} - {cost}'
    );
  });

  it('never touches ${parameter} tokens even when a column has the same name', () => {
    expect(rewriteExpression('{scale} * ${scale}', { scale: 'factor' })).toBe(
      '{factor} * ${scale}'
    );
  });

  it('returns the input unchanged when nothing maps', () => {
    const expression = 'sum({revenue})';
    expect(rewriteExpression(expression, { cost: 'x' })).toBe(expression);
  });
});

describe('rebindDefinition', () => {
  it('repoints the declaration and keeps the identifier', () => {
    const out = rebindDefinition(sampleDefinition(), [
      { identifier: 'orders', targetDataSetArn: GOLD_ARN },
    ]);

    expect(out.DataSetIdentifierDeclarations).toEqual([
      { Identifier: 'orders', DataSetArn: GOLD_ARN },
      { Identifier: 'regions', DataSetArn: REGIONS_ARN },
    ]);
  });

  it('does not mutate the input', () => {
    const input = sampleDefinition();
    const snapshot = JSON.stringify(input);
    rebindDefinition(input, [
      { identifier: 'orders', targetDataSetArn: GOLD_ARN, columnMap: { revenue: 'net' } },
    ]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('renames columns everywhere under that identifier only', () => {
    const out = rebindDefinition(sampleDefinition(), [
      {
        identifier: 'orders',
        targetDataSetArn: GOLD_ARN,
        columnMap: { revenue: 'net_revenue', order_date: 'Order Date' },
      },
    ]);

    const seen: string[] = [];
    walkColumnIdentifiers(out, (column) =>
      seen.push(`${column.DataSetIdentifier}.${column.ColumnName}`)
    );
    expect(seen).toContain('orders.net_revenue');
    expect(seen).toContain('orders.Order Date');
    expect(seen).not.toContain('orders.revenue');
    expect(seen).not.toContain('orders.order_date');
    // Other datasets are untouched even if they had a column of the same name
    expect(seen).toContain('regions.region_name');
    // Column formatting (ColumnConfigurations) follows the rename too
    expect(out.ColumnConfigurations[0].Column.ColumnName).toBe('net_revenue');
  });

  it('rewrites calculated-field expressions for that identifier', () => {
    const out = rebindDefinition(sampleDefinition(), [
      { identifier: 'orders', targetDataSetArn: GOLD_ARN, columnMap: { revenue: 'net_revenue' } },
    ]);

    expect(out.CalculatedFields[0].Expression).toBe('{net_revenue} - {cost}');
    expect(out.CalculatedFields[1].Expression).toBe(
      'ifelse({net_revenue} = 0, 0, {margin} / {net_revenue}) * ${scale}'
    );
  });

  it('leaves field ids alone', () => {
    const out = rebindDefinition(sampleDefinition(), [
      { identifier: 'orders', targetDataSetArn: GOLD_ARN, columnMap: { revenue: 'net_revenue' } },
    ]);
    const values =
      out.Sheets[0].Visuals[0].BarChartVisual.ChartConfiguration.FieldWells
        .BarChartAggregatedFieldWells.Values;
    expect(values[0].NumericalMeasureField.FieldId).toBe('v1.revenue.1');
  });

  it('applies several rebinds in one pass', () => {
    const out = rebindDefinition(sampleDefinition(), [
      { identifier: 'orders', targetDataSetArn: GOLD_ARN },
      { identifier: 'regions', targetDataSetArn: 'arn:x/regions-gold', columnMap: { region_name: 'name' } },
    ]);
    expect(out.DataSetIdentifierDeclarations[1].DataSetArn).toBe('arn:x/regions-gold');
    expect(
      out.ParameterDeclarations[0].StringParameterDeclaration.DefaultValues.DynamicValue
        .DefaultValueColumn.ColumnName
    ).toBe('name');
  });

  it('throws for an identifier the definition does not declare', () => {
    expect(() =>
      rebindDefinition(sampleDefinition(), [{ identifier: 'ghost', targetDataSetArn: GOLD_ARN }])
    ).toThrow("no dataset identifier 'ghost'");
  });

  it('is a no-op rename when the map is empty', () => {
    const out = rebindDefinition(sampleDefinition(), [
      { identifier: 'orders', targetDataSetArn: ORDERS_ARN, columnMap: {} },
    ]);
    expect(out).toEqual(sampleDefinition());
  });
});
