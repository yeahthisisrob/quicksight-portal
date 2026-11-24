import type { Table } from '@aws-sdk/client-glue';
import { describe, expect, it } from 'vitest';

import { TABLE_KEY } from '../../types';
import { glueShown, glueTableInput, isGlueView } from '../glueText';

const table: Table = {
  Name: 'orders',
  Description: 'Every order.',
  Owner: 'someone',
  TableType: 'EXTERNAL_TABLE',
  Parameters: { table_type: 'ICEBERG', metadata_location: 's3://lake/orders/metadata/7.json' },
  StorageDescriptor: {
    Location: 's3://lake/orders',
    Columns: [
      {
        Name: 'order_id',
        Type: 'bigint',
        Comment: 'The order.',
        Parameters: { 'iceberg.field.id': '1' },
      },
      { Name: 'placed_at', Type: 'timestamp' },
    ],
  },
  PartitionKeys: [{ Name: 'region', Type: 'string' }],
  VersionId: '12',
};

describe('glueShown', () => {
  it('reads each column comment, partition keys included, and the table description', () => {
    expect(glueShown(table)).toEqual({
      order_id: { description: 'The order.' },
      placed_at: {},
      region: {},
      [TABLE_KEY]: { description: 'Every order.' },
    });
  });
});

describe('glueTableInput', () => {
  it('writes the comments and the description and sends everything else back as read', () => {
    const input = glueTableInput(table, [
      { key: 'placed_at', field: 'description', value: 'When it was placed.' },
      { key: 'region', field: 'description', value: 'Where it shipped.' },
      { key: TABLE_KEY, field: 'description', value: 'One row per order.' },
    ]);
    expect(input.Description).toBe('One row per order.');
    expect(input.Parameters).toEqual(table.Parameters);
    expect(input.StorageDescriptor?.Location).toBe('s3://lake/orders');
    expect(input.StorageDescriptor?.Columns).toEqual([
      {
        Name: 'order_id',
        Type: 'bigint',
        Comment: 'The order.',
        Parameters: { 'iceberg.field.id': '1' },
      },
      { Name: 'placed_at', Type: 'timestamp', Comment: 'When it was placed.' },
    ]);
    expect(input.PartitionKeys).toEqual([
      { Name: 'region', Type: 'string', Comment: 'Where it shipped.' },
    ]);
    expect(input).not.toHaveProperty('VersionId');
  });

  it('keeps the description when only a column is written', () => {
    const input = glueTableInput(table, [{ key: 'order_id', field: 'description', value: 'New.' }]);
    expect(input.Description).toBe('Every order.');
  });
});

describe('isGlueView', () => {
  it('knows a Data Catalog view, which is never written', () => {
    expect(isGlueView({ ...table, ViewDefinition: { IsProtected: false } })).toBe(true);
    expect(isGlueView(table)).toBe(false);
  });
});
