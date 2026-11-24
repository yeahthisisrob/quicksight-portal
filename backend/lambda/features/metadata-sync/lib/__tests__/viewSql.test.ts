import { describe, expect, it } from 'vitest';

import { isView, referencedTables, viewSql } from '../viewSql';

const presto = (sql: string) =>
  `/* Presto View: ${Buffer.from(JSON.stringify({ originalSql: sql })).toString('base64')} */`;

describe('viewSql', () => {
  it('reads an Athena view out of its Presto envelope', () => {
    expect(viewSql({ Name: 'v', ViewOriginalText: presto('SELECT * FROM sales.orders') })).toBe(
      'SELECT * FROM sales.orders'
    );
  });

  it('reads a Data Catalog view from its representations', () => {
    expect(
      viewSql({
        Name: 'v',
        ViewDefinition: { Representations: [{ ViewOriginalText: 'SELECT 1 FROM sales.orders' }] },
      })
    ).toBe('SELECT 1 FROM sales.orders');
  });

  it('keeps text that only looks like the envelope', () => {
    const text = '/* Presto View: bm90IGpzb24= */';
    expect(viewSql({ Name: 'v', ViewOriginalText: text })).toBe(text);
  });
});

describe('isView', () => {
  it('knows both kinds of view from a table', () => {
    expect(isView({ Name: 'v', TableType: 'VIRTUAL_VIEW' })).toBe(true);
    expect(isView({ Name: 'v', ViewDefinition: {} })).toBe(true);
    expect(isView({ Name: 't', TableType: 'EXTERNAL_TABLE' })).toBe(false);
  });
});

describe('referencedTables', () => {
  it('finds the tables of a database, quoted or not, once each', () => {
    const sql =
      'SELECT a.x FROM "awsdatacatalog"."sales"."orders" a JOIN sales.Customers c ON 1=1 JOIN `sales` . `orders` o ON 1=1';
    expect(referencedTables(sql, 'sales').sort()).toEqual(['customers', 'orders']);
  });

  it('does not take a longer database name for this one', () => {
    expect(referencedTables('SELECT * FROM presales.orders', 'sales')).toEqual([]);
  });
});
