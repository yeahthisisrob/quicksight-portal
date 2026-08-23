import { describe, expect, it } from 'vitest';

import { DatasetParser } from '../DatasetParser';

const ACCOUNT_ARN_PREFIX = 'arn:aws:quicksight:us-east-1:123456789012';

function assetDataWithDescribe(describePayload: any): any {
  return {
    apiResponses: {
      list: {
        data: {
          DataSetId: describePayload.DataSetId,
          Name: describePayload.Name,
          ImportMode: 'SPICE',
        },
      },
      describe: { data: describePayload },
    },
  };
}

describe('DatasetParser composite dataset lineage', () => {
  const parser = new DatasetParser();

  it('extracts source dataset ids from LogicalTableMap Source.DataSetArn', () => {
    const metadata = parser.extractMetadata(
      assetDataWithDescribe({
        DataSetId: 'composite-1',
        Name: 'Composite',
        PhysicalTableMap: {},
        LogicalTableMap: {
          lt1: { Source: { DataSetArn: `${ACCOUNT_ARN_PREFIX}:dataset/source-a` }, Alias: 'A' },
          lt2: { Source: { DataSetArn: `${ACCOUNT_ARN_PREFIX}:dataset/source-b` }, Alias: 'B' },
          lt3: {
            Source: { JoinInstruction: { LeftOperand: 'lt1', RightOperand: 'lt2' } },
            Alias: 'Joined',
          },
        },
      })
    );

    expect(metadata.lineageData).toBeDefined();
    expect(metadata.lineageData.datasetIds.sort()).toEqual(['source-a', 'source-b']);
    expect(metadata.lineageData.datasetArns).toHaveLength(2);
    // Composite has no direct datasources - lineage must still be kept
    expect(metadata.lineageData.datasourceIds).toEqual([]);
  });

  it('extracts source dataset ids from PhysicalTableMap DataSetArn', () => {
    const metadata = parser.extractMetadata(
      assetDataWithDescribe({
        DataSetId: 'composite-2',
        Name: 'Composite 2',
        PhysicalTableMap: {
          pt1: { DataSetArn: `${ACCOUNT_ARN_PREFIX}:dataset/source-c` },
        },
        LogicalTableMap: {},
      })
    );

    expect(metadata.lineageData).toBeDefined();
    expect(metadata.lineageData.datasetIds).toEqual(['source-c']);
  });

  it('dedupes repeated source dataset references', () => {
    const metadata = parser.extractMetadata(
      assetDataWithDescribe({
        DataSetId: 'composite-3',
        Name: 'Composite 3',
        LogicalTableMap: {
          lt1: { Source: { DataSetArn: `${ACCOUNT_ARN_PREFIX}:dataset/source-a` } },
          lt2: { Source: { DataSetArn: `${ACCOUNT_ARN_PREFIX}:dataset/source-a` } },
        },
      })
    );

    expect(metadata.lineageData.datasetIds).toEqual(['source-a']);
  });

  it('still returns undefined lineage when nothing at all is found (flat files)', () => {
    const metadata = parser.extractMetadata(
      assetDataWithDescribe({
        DataSetId: 'flat-1',
        Name: 'Flat file',
        PhysicalTableMap: {},
        LogicalTableMap: {},
      })
    );

    expect(metadata.lineageData).toBeUndefined();
  });

  it('keeps datasource lineage untouched for regular datasets', () => {
    const metadata = parser.extractMetadata(
      assetDataWithDescribe({
        DataSetId: 'regular-1',
        Name: 'Regular',
        PhysicalTableMap: {
          pt1: {
            RelationalTable: {
              DataSourceArn: `${ACCOUNT_ARN_PREFIX}:datasource/ds-1`,
              Schema: 'analytics',
              Name: 'orders',
            },
          },
        },
        LogicalTableMap: {
          lt1: { Source: { PhysicalTableId: 'pt1' }, Alias: 'orders' },
        },
      })
    );

    expect(metadata.lineageData.datasourceIds).toEqual(['ds-1']);
    expect(metadata.lineageData.datasetIds).toEqual([]);
  });
});
