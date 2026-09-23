import { describe, expect, it } from 'vitest';

import {
  collectDefinitionDatasets,
  expressionColumns,
  unresolvedCalculatedFieldColumns,
  walkColumnIdentifiers,
} from '../definitionColumns';
import { ORDERS_ARN, sampleDefinition } from './fixtures';

describe('expressionColumns', () => {
  it('finds {column} tokens once each, in order', () => {
    expect(expressionColumns('{revenue} - {cost} + {revenue}')).toEqual(['revenue', 'cost']);
  });

  it('skips ${parameter} tokens', () => {
    expect(expressionColumns('{margin} / {revenue} * ${scale}')).toEqual(['margin', 'revenue']);
  });

  it('keeps names with spaces and trims padding', () => {
    expect(expressionColumns('sum({ Order Total })')).toEqual(['Order Total']);
  });

  it('returns nothing for an expression without columns', () => {
    expect(expressionColumns('1 + 1')).toEqual([]);
  });
});

describe('walkColumnIdentifiers', () => {
  it('reports every ColumnIdentifier with the section it sits in', () => {
    const seen: string[] = [];
    walkColumnIdentifiers(sampleDefinition(), (column, site) =>
      seen.push(`${site}:${column.DataSetIdentifier}.${column.ColumnName}`)
    );

    expect(seen).toEqual([
      'parameter:regions.region_name',
      'filter:orders.status',
      'control:regions.region_name',
      'visual:orders.status',
      'visual:orders.revenue',
      'visual:orders.margin_pct',
      'visual:orders.order_date',
      'other:orders.revenue',
    ]);
  });

  it('tolerates an empty or malformed definition', () => {
    const visit = () => {
      throw new Error('should not be called');
    };
    expect(() => walkColumnIdentifiers(undefined, visit)).not.toThrow();
    expect(() => walkColumnIdentifiers({ Sheets: 'nope', FilterGroups: 3 }, visit)).not.toThrow();
  });
});

describe('collectDefinitionDatasets', () => {
  it('lists each declared dataset with the columns read from it', () => {
    const datasets = collectDefinitionDatasets(sampleDefinition());

    expect(datasets.map((d) => d.identifier)).toEqual(['orders', 'regions']);
    expect(datasets[0]).toMatchObject({
      dataSetArn: ORDERS_ARN,
      dataSetId: 'orders-silver',
      calculatedFields: ['margin', 'margin_pct'],
    });
    expect(datasets[0]?.columns.map((c) => c.name)).toEqual([
      'cost',
      'order_date',
      'revenue',
      'status',
    ]);
  });

  it('excludes calculated fields from the columns a dataset must provide', () => {
    const [orders] = collectDefinitionDatasets(sampleDefinition());
    const names = orders?.columns.map((c) => c.name) ?? [];
    expect(names).not.toContain('margin');
    expect(names).not.toContain('margin_pct');
  });

  it('counts usage per site, one per calculated field that depends on the column', () => {
    const [orders] = collectDefinitionDatasets(sampleDefinition());
    const revenue = orders?.columns.find((c) => c.name === 'revenue');
    // margin_pct mentions {revenue} twice but depends on it once
    expect(revenue?.usage).toEqual({
      visual: 1,
      filter: 0,
      calculatedField: 2,
      parameter: 0,
      control: 0,
      other: 1,
    });

    const status = orders?.columns.find((c) => c.name === 'status');
    expect(status?.usage).toMatchObject({ visual: 1, filter: 1 });
  });

  it('reports a dataset that is declared but unused with no columns', () => {
    const definition = sampleDefinition();
    definition.DataSetIdentifierDeclarations.push({
      Identifier: 'spare',
      DataSetArn: 'arn:aws:quicksight:us-east-1:1:dataset/spare',
    });
    const spare = collectDefinitionDatasets(definition).find((d) => d.identifier === 'spare');
    expect(spare).toEqual({
      identifier: 'spare',
      dataSetArn: 'arn:aws:quicksight:us-east-1:1:dataset/spare',
      dataSetId: 'spare',
      columns: [],
      calculatedFields: [],
    });
  });

  it('returns nothing when there are no declarations', () => {
    expect(collectDefinitionDatasets({})).toEqual([]);
    expect(collectDefinitionDatasets(null)).toEqual([]);
  });
});

describe('unresolvedCalculatedFieldColumns', () => {
  const columns = new Map([['orders', new Set(['revenue', 'cost', 'region'])]]);

  it('names the columns an added field reads that the dataset does not have', () => {
    const unresolved = unresolvedCalculatedFieldColumns(
      [
        { identifier: 'orders', name: 'profit', expression: '{revenue} - {cost}' },
        { identifier: 'orders', name: 'per_unit', expression: '{revenue} / {units} - {tax}' },
      ],
      sampleDefinition(),
      columns
    );
    expect(unresolved).toEqual([
      { identifier: 'orders', name: 'per_unit', columns: ['units', 'tax'] },
    ]);
  });

  it('lets a field read another calculated field, existing or in the same batch', () => {
    const unresolved = unresolvedCalculatedFieldColumns(
      [
        { identifier: 'orders', name: 'margin_pct', expression: '{margin} / {revenue}' },
        { identifier: 'orders', name: 'net', expression: '{revenue} - {tax}' },
        { identifier: 'orders', name: 'net_pct', expression: '{net} / {revenue} * ${scale}' },
      ],
      sampleDefinition(),
      columns
    );
    expect(unresolved).toEqual([{ identifier: 'orders', name: 'net', columns: ['tax'] }]);
  });

  it('skips a dataset whose columns are not known', () => {
    expect(
      unresolvedCalculatedFieldColumns(
        [{ identifier: 'regions', name: 'x', expression: '{nothing}' }],
        sampleDefinition(),
        columns
      )
    ).toEqual([]);
  });
});
