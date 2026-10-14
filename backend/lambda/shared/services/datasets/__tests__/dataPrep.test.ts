import { describe, expect, it } from 'vitest';

import { dataPrepForTable, dataPrepFromLegacy } from '../dataPrep';

/** Deterministic ids: s1, s2, ... in the order they are asked for. */
const ids = () => {
  let n = 0;
  return () => `id-${++n}`;
};

describe('dataPrepForTable', () => {
  it('imports the one physical table, projects its columns and models the result', () => {
    const spec = dataPrepForTable(
      { physicalTableId: 'p1', alias: 'Signups by month', columns: ['month', 'signups'] },
      ids()
    );
    expect(spec.dataPrepConfiguration).toEqual({
      SourceTableMap: { 'id-1': { PhysicalTableId: 'p1' } },
      TransformStepMap: {
        'id-2': {
          ImportTableStep: { Alias: 'Signups by month', Source: { SourceTableId: 'id-1' } },
        },
        'id-3': {
          ProjectStep: {
            Alias: 'Columns',
            ProjectedColumns: ['month', 'signups'],
            Source: { TransformOperationId: 'id-2' },
          },
        },
      },
      DestinationTableMap: {
        'id-4': { Alias: 'Signups by month', Source: { TransformOperationId: 'id-3' } },
      },
    });
    expect(spec.semanticModelConfiguration).toEqual({
      TableMap: { 'id-5': { Alias: 'Signups by month', DestinationTableId: 'id-4' } },
    });
  });
});

describe('dataPrepFromLegacy', () => {
  const legacy = {
    LogicalTableMap: {
      orders: {
        Alias: 'orders',
        Source: { PhysicalTableId: 'p-orders' },
        DataTransforms: [
          { ProjectOperation: { ProjectedColumns: ['id', 'amt', 'region'] } },
          { RenameColumnOperation: { ColumnName: 'amt', NewColumnName: 'revenue' } },
          { RenameColumnOperation: { ColumnName: 'region', NewColumnName: 'market' } },
          { CastColumnTypeOperation: { ColumnName: 'revenue', NewColumnType: 'DECIMAL' } },
          {
            CreateColumnsOperation: {
              Columns: [{ ColumnName: 'margin', ColumnId: 'c1', Expression: '{revenue} * 0.3' }],
            },
          },
          {
            TagColumnOperation: {
              ColumnName: 'market',
              Tags: [
                { ColumnGeographicRole: 'STATE' },
                { ColumnDescription: { Text: 'Sales region' } },
              ],
            },
          },
          { FilterOperation: { ConditionExpression: '{revenue} > 0' } },
        ],
      },
    },
    RowLevelPermissionDataSet: { Arn: 'arn:rls', PermissionPolicy: 'GRANT_ACCESS' },
  };

  it('turns one logical table into an import followed by its transforms in order', () => {
    const out = dataPrepFromLegacy(legacy, ids());
    expect(out.refused).toEqual([]);
    const steps = out.dataPrepConfiguration.TransformStepMap;
    const order = Object.keys(steps);
    expect(order.map((k) => Object.keys(steps[k])[0])).toEqual([
      'ImportTableStep',
      'ProjectStep',
      'RenameColumnsStep',
      'CastColumnTypesStep',
      'CreateColumnsStep',
      'FiltersStep',
    ]);
    // Each step reads the one before it; the two renames share a step.
    expect(steps[order[2]!].RenameColumnsStep).toEqual({
      Alias: 'Renames',
      RenameColumnOperations: [
        { ColumnName: 'amt', NewColumnName: 'revenue' },
        { ColumnName: 'region', NewColumnName: 'market' },
      ],
      Source: { TransformOperationId: order[1] },
    });
    expect(steps[order[5]!].FiltersStep.Source).toEqual({ TransformOperationId: order[4] });
    expect(out.dataPrepConfiguration.SourceTableMap).toEqual({
      'id-1': { PhysicalTableId: 'p-orders' },
    });
    expect(Object.values(out.dataPrepConfiguration.DestinationTableMap)).toEqual([
      { Alias: 'orders', Source: { TransformOperationId: order[5] } },
    ]);
    // Column tags and row-level security live on the semantic model now.
    const [table] = Object.values(out.semanticModelConfiguration.TableMap) as any[];
    expect(table).toMatchObject({
      Alias: 'orders',
      RowLevelPermissionConfiguration: {
        RowLevelPermissionDataSet: { Arn: 'arn:rls', PermissionPolicy: 'GRANT_ACCESS' },
      },
      SemanticMetadata: {
        ColumnMetadata: [
          {
            ColumnNames: ['market'],
            ColumnProperties: [
              {
                Description: { Text: 'Sales region' },
                SemanticType: { GeographicalRole: 'STATE' },
              },
            ],
          },
        ],
      },
    });
    expect(out.carried).toEqual([
      '1 source table',
      '1 calculated field',
      '2 renames',
      '1 type cast',
      '1 filter',
      'descriptions and roles on 1 column',
      'row-level security',
    ]);
  });

  it('turns a join of two logical tables into a join step over their chains', () => {
    const out = dataPrepFromLegacy(
      {
        LogicalTableMap: {
          left: { Alias: 'orders', Source: { PhysicalTableId: 'p1' } },
          right: {
            Alias: 'customers',
            Source: { PhysicalTableId: 'p2' },
            DataTransforms: [{ ProjectOperation: { ProjectedColumns: ['id', 'name'] } }],
          },
          joined: {
            Alias: 'orders with customers',
            Source: {
              JoinInstruction: {
                LeftOperand: 'left',
                RightOperand: 'right',
                Type: 'LEFT',
                OnClause: '{id} = {customer_id}',
                LeftJoinKeyProperties: { UniqueKey: true },
              },
            },
            DataTransforms: [{ ProjectOperation: { ProjectedColumns: ['id', 'name', 'amt'] } }],
          },
        },
      },
      ids()
    );
    expect(out.refused).toEqual([]);
    const steps = out.dataPrepConfiguration.TransformStepMap;
    const join = Object.values(steps).find((s: any) => s.JoinStep) as any;
    expect(join.JoinStep).toMatchObject({
      Alias: 'orders with customers',
      Type: 'LEFT',
      OnClause: '{id} = {customer_id}',
    });
    const leftEnd = steps[join.JoinStep.LeftOperand.TransformOperationId];
    const rightEnd = steps[join.JoinStep.RightOperand.TransformOperationId];
    expect(leftEnd.ImportTableStep.Alias).toBe('orders');
    expect(rightEnd.ProjectStep.ProjectedColumns).toEqual(['id', 'name']);
    expect(out.dropped).toEqual([
      "The unique-key hint on the join 'orders with customers': the new shape has no such property.",
    ]);
    expect(out.carried).toContain('1 join');
  });

  it('refuses what the new shape cannot hold, naming it', () => {
    const onParent = dataPrepFromLegacy({
      LogicalTableMap: {
        child: {
          Alias: 'child',
          Source: { DataSetArn: 'arn:aws:quicksight:us-east-1:1:dataset/p' },
        },
      },
    });
    expect(onParent.refused[0]).toContain('built on another dataset');
    const parameter = dataPrepFromLegacy({
      LogicalTableMap: {
        t: {
          Alias: 't',
          Source: { PhysicalTableId: 'p' },
          DataTransforms: [{ OverrideDatasetParameterOperation: { ParameterName: 'x' } }],
        },
      },
    });
    expect(parameter.refused).toEqual([
      "'t' has a OverrideDatasetParameterOperation the new shape cannot carry.",
    ]);
    expect(dataPrepFromLegacy({ LogicalTableMap: {} }).refused[0]).toContain('no logical table');
  });
});
