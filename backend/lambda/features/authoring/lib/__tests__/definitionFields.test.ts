import { describe, expect, it } from 'vitest';

import { calculatedFieldUses } from '../definitionFields';
import { applyOps, parseOps } from '../definitionOps';

const col = (name: string) => ({ DataSetIdentifier: 'orders', ColumnName: name });

/** Three fields: one on a visual and a filter, one read by another field, one unused. */
function definition() {
  return {
    DataSetIdentifierDeclarations: [{ Identifier: 'orders', DataSetArn: 'arn:ds/orders' }],
    CalculatedFields: [
      { DataSetIdentifier: 'orders', Name: 'IsClosed', Expression: "ifelse({status} = 'C', 1, 0)" },
      {
        DataSetIdentifier: 'orders',
        Name: 'c_closed_rate',
        Expression: 'sum({IsClosed}) / count({order_id})',
      },
      { DataSetIdentifier: 'orders', Name: 'old_margin', Expression: '{revenue} - {cost}' },
    ],
    Sheets: [
      {
        SheetId: 's1',
        Visuals: [
          {
            BarChartVisual: {
              ChartConfiguration: {
                FieldWells: {
                  BarChartAggregatedFieldWells: {
                    Values: [{ NumericalMeasureField: { FieldId: 'v1', Column: col('IsClosed') } }],
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
    FilterGroups: [{ Filters: [{ CategoryFilter: { Column: col('IsClosed') } }] }],
  };
}

describe('calculated field uses', () => {
  it('counts where each field is read, and which are unused', () => {
    const uses = Object.fromEntries(calculatedFieldUses(definition()).map((u) => [u.name, u]));
    expect(uses.IsClosed!.usage).toMatchObject({ visual: 1, filter: 1, calculatedField: 1 });
    expect(uses.IsClosed!.readBy).toEqual(['c_closed_rate']);
    expect(uses.c_closed_rate!.unused).toBe(true);
    expect(uses.old_margin!.unused).toBe(true);
    expect(uses.IsClosed!.unused).toBe(false);
  });
});

describe('definition-scope ops on calculated fields', () => {
  it('replace: every reference reads the column, readers are rewritten, the field goes', () => {
    const { definition: out, changes } = applyOps(definition(), [
      { op: 'replaceCalculatedField', identifier: 'orders', name: 'IsClosed', column: 'is_closed' },
    ]);
    expect(out.CalculatedFields.map((f: any) => f.Name)).toEqual(['c_closed_rate', 'old_margin']);
    expect(out.CalculatedFields[0].Expression).toBe('sum({is_closed}) / count({order_id})');
    expect(JSON.stringify(out)).not.toContain('"IsClosed"');
    expect(changes[0]).toMatchObject({ kind: 'calculatedField' });
    expect(changes[0]!.description).toContain('2 references');
  });

  it('rename: the field, every reference and every reader take the new name', () => {
    const { definition: out } = applyOps(definition(), [
      { op: 'renameCalculatedField', identifier: 'orders', name: 'IsClosed', to: 'c_is_closed' },
    ]);
    const text = JSON.stringify(out);
    expect(text).not.toContain('"IsClosed"');
    expect(text).toContain('"ColumnName":"c_is_closed"');
    expect(out.CalculatedFields[1].Expression).toBe('sum({c_is_closed}) / count({order_id})');
  });

  it('rename refuses a name a field or a column already has', () => {
    expect(() =>
      applyOps(definition(), [
        { op: 'renameCalculatedField', identifier: 'orders', name: 'IsClosed', to: 'old_margin' },
      ])
    ).toThrow('already has a field or column named old_margin');
    expect(() =>
      applyOps(definition(), [
        { op: 'renameCalculatedField', identifier: 'orders', name: 'IsClosed', to: 'region' },
      ])
    ).toThrow('already has a field or column named region');
  });

  it('drop: only a field nothing reads', () => {
    const { definition: out } = applyOps(definition(), [
      { op: 'dropCalculatedField', identifier: 'orders', name: 'old_margin' },
    ]);
    expect(out.CalculatedFields.map((f: any) => f.Name)).toEqual(['IsClosed', 'c_closed_rate']);
    expect(() =>
      applyOps(definition(), [
        { op: 'dropCalculatedField', identifier: 'orders', name: 'IsClosed' },
      ])
    ).toThrow('still read (1 visual, 1 filter, 1 calculated field)');
  });

  it('parses them without a sheet, and refuses a missing name', () => {
    expect(
      parseOps([{ op: 'renameCalculatedField', identifier: 'orders', name: 'a', to: 'c_a' }])
    ).toEqual([{ op: 'renameCalculatedField', identifier: 'orders', name: 'a', to: 'c_a' }]);
    expect(() => parseOps([{ op: 'dropCalculatedField', identifier: 'orders' }])).toThrow(
      'ops[0].name is required'
    );
  });
});
