import { describe, expect, it } from 'vitest';

import { collectDefinitionDatasets, walkColumnIdentifiers } from '../definitionColumns';
import {
  applyRepairs,
  declaredParameters,
  parseRepairs,
  referencedParameters,
} from '../definitionRepairs';
import { sampleDefinition } from './fixtures';

function references(definition: any, identifier: string, column: string): number {
  let n = 0;
  walkColumnIdentifiers(definition, (c) => {
    if (c.DataSetIdentifier === identifier && c.ColumnName === column) {
      n += 1;
    }
  });
  return n;
}

describe('applyRepairs', () => {
  it('does not touch the input', () => {
    const input = sampleDefinition();
    const snapshot = JSON.stringify(input);
    applyRepairs(input, [{ op: 'dropColumn', identifier: 'orders', columnName: 'status' }]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('dropColumn removes every reference, the calculated fields that read it, and empty filter groups', () => {
    const input = sampleDefinition();
    expect(references(input, 'orders', 'revenue')).toBeGreaterThan(0);

    const { definition, changes } = applyRepairs(input, [
      { op: 'dropColumn', identifier: 'orders', columnName: 'revenue' },
    ]);

    expect(references(definition, 'orders', 'revenue')).toBe(0);
    const calculated = definition.CalculatedFields.map((f: any) => f.Name);
    expect(calculated).not.toContain('margin');
    expect(calculated).not.toContain('margin_pct');
    // Other columns and the other dataset are untouched.
    expect(references(definition, 'regions', 'region_name')).toBe(
      references(input, 'regions', 'region_name')
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: 'repair' });
    expect(changes[0]!.description).toContain('margin');
    expect(changes[0]!.description).toContain('margin_pct');
    // The definition still lists the datasets it declared.
    expect(collectDefinitionDatasets(definition).map((d) => d.identifier)).toEqual([
      'orders',
      'regions',
    ]);
  });

  it('dropColumn on the only filter of a group removes the group', () => {
    const input = sampleDefinition();
    const { definition, changes } = applyRepairs(input, [
      { op: 'dropColumn', identifier: 'orders', columnName: 'status' },
    ]);
    expect(definition.FilterGroups).toEqual([]);
    expect(changes[0]!.description).toContain('1 empty filter group');
  });

  it('dropParameter removes the declaration, its controls and filters that read it', () => {
    const input = sampleDefinition();
    expect(declaredParameters(input)).toContain('region');
    const { definition, changes } = applyRepairs(input, [{ op: 'dropParameter', name: 'region' }]);
    expect(declaredParameters(definition)).not.toContain('region');
    expect(JSON.stringify(definition)).not.toContain('SourceParameterName');
    expect(changes[0]).toMatchObject({ kind: 'repair' });
  });

  it('declareParameter adds a declaration once and refuses a duplicate', () => {
    const input = sampleDefinition();
    const { definition } = applyRepairs(input, [
      { op: 'declareParameter', name: 'scale', type: 'INTEGER', defaultValue: '100' },
    ]);
    expect(declaredParameters(definition)).toEqual(expect.arrayContaining(['region', 'scale']));
    const added = definition.ParameterDeclarations.find(
      (d: any) => d.IntegerParameterDeclaration?.Name === 'scale'
    );
    expect(added.IntegerParameterDeclaration).toMatchObject({
      ParameterValueType: 'SINGLE_VALUED',
      DefaultValues: { StaticValues: [100] },
    });
    expect(() =>
      applyRepairs(definition, [{ op: 'declareParameter', name: 'scale', type: 'STRING' }])
    ).toThrow('already declared');
  });

  it('finds every parameter the definition uses, including ${name} in expressions', () => {
    const used = referencedParameters(sampleDefinition());
    expect(used).toEqual(expect.arrayContaining(['region', 'scale']));
  });

  it('parseRepairs validates shape and applyRepairs validates each op', () => {
    expect(parseRepairs(undefined)).toEqual([]);
    expect(() => parseRepairs({})).toThrow('array');
    expect(() => parseRepairs([{}])).toThrow('needs an op');
    expect(() => applyRepairs(sampleDefinition(), [{ op: 'dropColumn' } as any])).toThrow(
      'identifier and columnName'
    );
    expect(() =>
      applyRepairs(sampleDefinition(), [{ op: 'declareParameter', name: 'x', type: 'BOOL' } as any])
    ).toThrow('type');
    expect(() => applyRepairs(sampleDefinition(), [{ op: 'nope' } as any])).toThrow('unknown');
  });
});

describe('replaceCalculatedField', () => {
  const col = (name: string) => ({ DataSetIdentifier: 'orders', ColumnName: name });
  const definition = () => ({
    DataSetIdentifierDeclarations: [{ Identifier: 'orders', DataSetArn: 'arn:ds/orders' }],
    CalculatedFields: [
      {
        DataSetIdentifier: 'orders',
        Name: 'c_is_closed',
        Expression: "ifelse({status} = 'C', 1, 0)",
      },
      {
        DataSetIdentifier: 'orders',
        Name: 'c_closed_rate',
        Expression: 'sum({c_is_closed}) / count({order_id})',
      },
    ],
    Sheets: [
      {
        Visuals: [
          {
            BarChartVisual: {
              ChartConfiguration: {
                FieldWells: {
                  BarChartAggregatedFieldWells: {
                    Values: [
                      { NumericalMeasureField: { FieldId: 'v1', Column: col('c_is_closed') } },
                    ],
                    Category: [
                      { CategoricalDimensionField: { FieldId: 'c1', Column: col('region') } },
                    ],
                  },
                },
              },
            },
          },
        ],
      },
    ],
    FilterGroups: [{ Filters: [{ CategoryFilter: { Column: col('c_is_closed') } }] }],
  });

  it('points every reference at the column, rewrites fields that read it, and drops it', () => {
    const { definition: out, changes } = applyRepairs(definition(), [
      {
        op: 'replaceCalculatedField',
        identifier: 'orders',
        name: 'c_is_closed',
        column: 'is_closed',
      },
    ]);
    expect(out.CalculatedFields.map((f: any) => f.Name)).toEqual(['c_closed_rate']);
    expect(out.CalculatedFields[0].Expression).toBe('sum({is_closed}) / count({order_id})');
    const text = JSON.stringify(out);
    expect(text).not.toContain('"c_is_closed"');
    expect(text).toContain('"ColumnName":"is_closed"');
    expect(text).toContain('"ColumnName":"region"');
    expect(changes[0]!.description).toContain('2 references');
    expect(changes[0]!.description).toContain('c_closed_rate');
  });

  it('refuses a field that is not there, or a name another field has', () => {
    expect(() =>
      applyRepairs(definition(), [
        { op: 'replaceCalculatedField', identifier: 'orders', name: 'nope', column: 'x' },
      ])
    ).toThrow('has no calculated field nope');
    expect(() =>
      applyRepairs(definition(), [
        {
          op: 'replaceCalculatedField',
          identifier: 'orders',
          name: 'c_is_closed',
          column: 'c_closed_rate',
        },
      ])
    ).toThrow('already has a calculated field');
  });
});
