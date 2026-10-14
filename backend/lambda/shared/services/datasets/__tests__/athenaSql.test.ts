import { describe, expect, it } from 'vitest';

import { stripGlueCatalogIds } from '../athenaSql';

describe('stripGlueCatalogIds', () => {
  it('drops a Glue catalog id in front of a table, quoted or not, wherever it appears', () => {
    expect(
      stripGlueCatalogIds(
        'SELECT * FROM "123456789012"."published_prod"."dim_customer" c JOIN 123456789012.published_prod.fct_orders o ON c.id = o.customer_id'
      )
    ).toEqual({
      sql: 'SELECT * FROM "published_prod"."dim_customer" c JOIN published_prod.fct_orders o ON c.id = o.customer_id',
      stripped: true,
    });
  });

  it('leaves a query alone when nothing looks like a catalog id', () => {
    for (const sql of [
      'SELECT * FROM "AwsDataCatalog"."published_prod"."dim_customer"',
      'SELECT * FROM published_prod.dim_customer',
      'SELECT 123456789012.5 AS n FROM t',
      "SELECT * FROM t WHERE id = '123456789012.a.b'",
    ]) {
      expect(stripGlueCatalogIds(sql), sql).toEqual({ sql, stripped: false });
    }
  });
});
