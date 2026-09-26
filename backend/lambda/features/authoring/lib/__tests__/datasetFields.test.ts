import { describe, expect, it } from 'vitest';

import {
  copyCalculatedField,
  datasetCalculatedFields,
  datasetShape,
  retireCalculatedField,
} from '../datasetFields';

/** A legacy dataset: margin, and margin_pct reading it, described, projected, foldered, restricted. */
function legacy(): Record<string, any> {
  return {
    Name: 'orders',
    ImportMode: 'SPICE',
    PhysicalTableMap: { p1: { RelationalTable: { Name: 'orders', InputColumns: [] } } },
    LogicalTableMap: {
      l1: {
        Alias: 'orders',
        Source: { PhysicalTableId: 'p1' },
        DataTransforms: [
          {
            CreateColumnsOperation: {
              Columns: [{ ColumnName: 'Margin', ColumnId: 'c1', Expression: '{revenue} - {cost}' }],
            },
          },
          {
            CreateColumnsOperation: {
              Columns: [
                { ColumnName: 'margin_pct', ColumnId: 'c2', Expression: '{Margin} / {revenue}' },
              ],
            },
          },
          {
            TagColumnOperation: {
              ColumnName: 'Margin',
              Tags: [{ ColumnDescription: { Text: 'Revenue less cost' } }],
            },
          },
          { ProjectOperation: { ProjectedColumns: ['revenue', 'cost', 'Margin', 'margin_pct'] } },
        ],
      },
    },
    FieldFolders: { Money: { columns: ['revenue', 'Margin'] } },
    ColumnLevelPermissionRules: [{ Principals: ['arn:group/finance'], ColumnNames: ['Margin'] }],
    OutputColumns: [
      { Name: 'revenue' },
      { Name: 'cost' },
      { Name: 'Margin' },
      { Name: 'margin_pct' },
    ],
  };
}

/** The same fields in the new data prep shape. */
function dataPrep(): Record<string, any> {
  return {
    Name: 'orders',
    ImportMode: 'SPICE',
    PhysicalTableMap: { p1: { RelationalTable: { Name: 'orders', InputColumns: [] } } },
    DataPrepConfiguration: {
      SourceTableMap: { s1: { PhysicalTableId: 'p1' } },
      TransformStepMap: {
        t1: { ImportTableStep: { Alias: 'import', Source: { SourceTableId: 's1' } } },
        t2: {
          CreateColumnsStep: {
            Alias: 'calcs',
            Source: { TransformOperationId: 't1' },
            Columns: [
              { ColumnName: 'Margin', ColumnId: 'c1', Expression: '{revenue} - {cost}' },
              { ColumnName: 'margin_pct', ColumnId: 'c2', Expression: '{Margin} / {revenue}' },
            ],
          },
        },
        t3: {
          ProjectStep: {
            Alias: 'project',
            Source: { TransformOperationId: 't2' },
            ProjectedColumns: ['revenue', 'Margin', 'margin_pct'],
          },
        },
      },
      DestinationTableMap: { d1: { Alias: 'out', Source: { TransformOperationId: 't3' } } },
    },
    SemanticModelConfiguration: {
      TableMap: {
        st: {
          Alias: 'out',
          DestinationTableId: 'd1',
          SemanticMetadata: {
            ColumnMetadata: [{ ColumnNames: ['Margin'], ColumnProperties: [] }],
          },
        },
      },
    },
    OutputColumns: [{ Name: 'revenue' }, { Name: 'Margin' }, { Name: 'margin_pct' }],
  };
}

describe('datasetCalculatedFields', () => {
  it('lists fields with their readers and restrictions, in either shape', () => {
    for (const spec of [legacy(), dataPrep()]) {
      const fields = datasetCalculatedFields(spec);
      expect(fields.map((f) => f.name)).toEqual(['Margin', 'margin_pct']);
      expect(fields[0]).toMatchObject({ readBy: ['margin_pct'], columnId: 'c1' });
    }
    expect(datasetCalculatedFields(legacy())[0]!.restricted).toBe(true);
    expect(datasetShape(dataPrep())).toBe('dataPrep');
    expect(datasetShape(legacy())).toBe('legacy');
  });
});

describe('copy then retire (legacy)', () => {
  it('copy serves both names and carries description, projection, folder and restriction', () => {
    const spec = legacy();
    expect(copyCalculatedField(spec, { name: 'Margin', to: 'c_ds_margin' })).toContain(
      'c_ds_margin'
    );
    const transforms = spec.LogicalTableMap.l1.DataTransforms;
    expect(transforms[0].CreateColumnsOperation.Columns.map((c: any) => c.ColumnName)).toEqual([
      'Margin',
      'c_ds_margin',
    ]);
    expect(transforms[0].CreateColumnsOperation.Columns[1].ColumnId).not.toBe('c1');
    expect(transforms[0].CreateColumnsOperation.Columns[1].Expression).toBe('{revenue} - {cost}');
    expect(
      transforms.filter((t: any) => t.TagColumnOperation).map((t: any) => t.TagColumnOperation)
    ).toEqual([
      { ColumnName: 'Margin', Tags: [{ ColumnDescription: { Text: 'Revenue less cost' } }] },
      { ColumnName: 'c_ds_margin', Tags: [{ ColumnDescription: { Text: 'Revenue less cost' } }] },
    ]);
    expect(transforms.at(-1).ProjectOperation.ProjectedColumns).toEqual([
      'revenue',
      'cost',
      'Margin',
      'c_ds_margin',
      'margin_pct',
    ]);
    expect(spec.FieldFolders.Money.columns).toEqual(['revenue', 'Margin', 'c_ds_margin']);
    expect(spec.ColumnLevelPermissionRules[0].ColumnNames).toEqual(['Margin', 'c_ds_margin']);
  });

  it('retire removes the old name everywhere and points the dataset’s own readers at the new one', () => {
    const spec = legacy();
    copyCalculatedField(spec, { name: 'Margin', to: 'c_ds_margin' });
    retireCalculatedField(spec, { name: 'Margin', replacedBy: 'c_ds_margin' });
    expect(JSON.stringify(spec.LogicalTableMap)).not.toMatch(/"Margin"|\{Margin\}/);
    expect(
      spec.LogicalTableMap.l1.DataTransforms[1].CreateColumnsOperation.Columns[0].Expression
    ).toBe('{c_ds_margin} / {revenue}');
    expect(spec.FieldFolders.Money.columns).toEqual(['revenue', 'c_ds_margin']);
    expect(spec.ColumnLevelPermissionRules[0].ColumnNames).toEqual(['c_ds_margin']);
  });
});

describe('copy then retire (new data prep)', () => {
  it('carries the projection and semantic metadata, and retires cleanly', () => {
    const spec = dataPrep();
    copyCalculatedField(spec, { name: 'Margin', to: 'c_ds_margin' });
    const steps = spec.DataPrepConfiguration.TransformStepMap;
    expect(steps.t2.CreateColumnsStep.Columns.map((c: any) => c.ColumnName)).toEqual([
      'Margin',
      'c_ds_margin',
      'margin_pct',
    ]);
    expect(steps.t3.ProjectStep.ProjectedColumns).toEqual([
      'revenue',
      'Margin',
      'c_ds_margin',
      'margin_pct',
    ]);
    expect(
      spec.SemanticModelConfiguration.TableMap.st.SemanticMetadata.ColumnMetadata[0].ColumnNames
    ).toEqual(['Margin', 'c_ds_margin']);

    retireCalculatedField(spec, { name: 'Margin', replacedBy: 'c_ds_margin' });
    expect(steps.t2.CreateColumnsStep.Columns.map((c: any) => c.ColumnName)).toEqual([
      'c_ds_margin',
      'margin_pct',
    ]);
    expect(steps.t2.CreateColumnsStep.Columns[1].Expression).toBe('{c_ds_margin} / {revenue}');
    expect(steps.t3.ProjectStep.ProjectedColumns).toEqual(['revenue', 'c_ds_margin', 'margin_pct']);
  });
});

describe('refusals', () => {
  it('refuses a name already taken, by a column or another field', () => {
    expect(() => copyCalculatedField(legacy(), { name: 'Margin', to: 'revenue' })).toThrow(
      'already has a column named revenue'
    );
    expect(() => copyCalculatedField(legacy(), { name: 'Margin', to: 'margin_pct' })).toThrow(
      'already has'
    );
    expect(() => copyCalculatedField(legacy(), { name: 'nope', to: 'x' })).toThrow(
      'no calculated field nope'
    );
  });

  it('refuses a rename it could not finish: a reference it does not know how to carry', () => {
    const spec = legacy();
    spec.LogicalTableMap.l1.DataTransforms.push({
      CastColumnTypeOperation: { ColumnName: 'Margin', NewColumnType: 'INTEGER' },
    });
    expect(() => copyCalculatedField(spec, { name: 'Margin', to: 'c_ds_margin' })).toThrow(
      'cannot follow (LogicalTableMap.l1.DataTransforms.CastColumnTypeOperation.ColumnName)'
    );

    const tagged = legacy();
    tagged.RowLevelPermissionTagConfiguration = {
      TagRules: [{ TagKey: 'k', ColumnName: 'Margin' }],
    };
    expect(() => copyCalculatedField(tagged, { name: 'Margin', to: 'c_ds_margin' })).toThrow(
      'cannot follow'
    );
  });

  it('refuses to retire onto a field that is not a faithful copy', () => {
    const spec = legacy();
    copyCalculatedField(spec, { name: 'Margin', to: 'c_ds_margin' });
    spec.LogicalTableMap.l1.DataTransforms[0].CreateColumnsOperation.Columns[1].Expression = '0';
    expect(() =>
      retireCalculatedField(spec, { name: 'Margin', replacedBy: 'c_ds_margin' })
    ).toThrow('no longer computes');
    expect(() => retireCalculatedField(legacy(), { name: 'Margin', replacedBy: 'ghost' })).toThrow(
      'not a calculated field'
    );
  });
});
