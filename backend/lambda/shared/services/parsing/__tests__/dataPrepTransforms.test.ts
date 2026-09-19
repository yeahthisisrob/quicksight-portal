import { describe, expect, it } from 'vitest';

import { dataTransformsOf, isNewDataPrep, parentDataSetArnsOf } from '../dataPrepTransforms';

const NEW_EXPERIENCE = {
  OutputColumns: [{ Name: 'revenue', Type: 'DECIMAL' }],
  DataPrepConfiguration: {
    SourceTableMap: {
      's-1': { PhysicalTableId: 'p-1' },
      's-2': { DataSet: { DataSetArn: 'arn:aws:quicksight:us-east-1:1:dataset/parent' } },
    },
    TransformStepMap: {
      't-1': {
        CreateColumnsStep: {
          Alias: 'calcs',
          Columns: [
            { ColumnName: 'margin', ColumnId: 'c1', Expression: '{revenue} - {cost}' },
            { ColumnName: 'no_expression', ColumnId: 'c2' },
          ],
        },
      },
      't-2': {
        RenameColumnsStep: {
          RenameColumnOperations: [
            { ColumnName: 'amt', NewColumnName: 'revenue' },
            { ColumnName: 'qty', NewColumnName: 'units' },
          ],
        },
      },
      't-3': {
        CastColumnTypesStep: {
          CastColumnTypeOperations: [{ ColumnName: 'revenue', NewColumnType: 'DECIMAL' }],
        },
      },
      't-4': { AppendStep: { Alias: 'union' } },
    },
  },
};

describe('isNewDataPrep', () => {
  it('is the presence of the new configuration, nothing else', () => {
    expect(isNewDataPrep(NEW_EXPERIENCE)).toBe(true);
    expect(isNewDataPrep({ LogicalTableMap: {} })).toBe(false);
    expect(isNewDataPrep(undefined)).toBe(false);
  });
});

describe('dataTransformsOf', () => {
  it('reads legacy logical table transforms unchanged', () => {
    const legacy = {
      LogicalTableMap: {
        l1: {
          DataTransforms: [
            { CreateColumnsOperation: { Columns: [{ ColumnName: 'margin' }] } },
            { RenameColumnOperation: { ColumnName: 'a', NewColumnName: 'b' } },
          ],
        },
      },
    };
    expect(dataTransformsOf(legacy)).toEqual(legacy.LogicalTableMap.l1.DataTransforms);
  });

  it('flattens new data prep steps into the legacy shape, one entry per operation', () => {
    const transforms = dataTransformsOf(NEW_EXPERIENCE);
    expect(transforms).toContainEqual({
      CreateColumnsOperation: {
        Columns: [
          { ColumnName: 'margin', ColumnId: 'c1', Expression: '{revenue} - {cost}' },
          { ColumnName: 'no_expression', ColumnId: 'c2' },
        ],
      },
    });
    // A step carrying several renames becomes one legacy entry each.
    expect(transforms).toContainEqual({
      RenameColumnOperation: { ColumnName: 'amt', NewColumnName: 'revenue' },
    });
    expect(transforms).toContainEqual({
      RenameColumnOperation: { ColumnName: 'qty', NewColumnName: 'units' },
    });
    expect(transforms).toContainEqual({
      CastColumnTypeOperation: { ColumnName: 'revenue', NewColumnType: 'DECIMAL' },
    });
    // Steps with no legacy equivalent are skipped, not guessed at.
    expect(transforms).toHaveLength(4);
  });

  it('reads a dataset that carries both, and copes with neither', () => {
    const both = {
      LogicalTableMap: { l1: { DataTransforms: [{ TagColumnOperation: { ColumnName: 'x' } }] } },
      DataPrepConfiguration: NEW_EXPERIENCE.DataPrepConfiguration,
    };
    expect(dataTransformsOf(both)).toHaveLength(5);
    expect(dataTransformsOf({})).toEqual([]);
    expect(dataTransformsOf(undefined)).toEqual([]);
  });
});

describe('parentDataSetArnsOf', () => {
  it('finds the parents a new-experience composite is built on', () => {
    expect(parentDataSetArnsOf(NEW_EXPERIENCE)).toEqual([
      'arn:aws:quicksight:us-east-1:1:dataset/parent',
    ]);
  });

  it('is empty for a legacy dataset', () => {
    expect(parentDataSetArnsOf({ LogicalTableMap: {} })).toEqual([]);
    expect(parentDataSetArnsOf(undefined)).toEqual([]);
  });
});
