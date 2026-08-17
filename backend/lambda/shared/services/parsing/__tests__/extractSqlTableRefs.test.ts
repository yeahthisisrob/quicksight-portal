import { describe, expect, it } from 'vitest';

import { extractSqlTableRefs } from '../DatasetParser';

describe('extractSqlTableRefs', () => {
  it('extracts db.table from FROM clauses', () => {
    expect(extractSqlTableRefs('SELECT * FROM analytics.sales_orders')).toEqual([
      'analytics.sales_orders',
    ]);
  });

  it('extracts refs from JOIN clauses and dedupes', () => {
    const sql = `
      SELECT a.*, b.region
      FROM analytics.sales_orders a
      JOIN reference.regions b ON a.region_id = b.id
      LEFT JOIN analytics.sales_orders c ON a.parent_id = c.id
    `;
    expect(extractSqlTableRefs(sql)).toEqual(['analytics.sales_orders', 'reference.regions']);
  });

  it('extracts catalog.db.table three-part refs', () => {
    expect(extractSqlTableRefs('SELECT 1 FROM awsdatacatalog.analytics.events')).toEqual([
      'awsdatacatalog.analytics.events',
    ]);
  });

  it('unwraps quoted and backticked identifiers', () => {
    expect(extractSqlTableRefs('SELECT 1 FROM "analytics"."sales_orders"')).toEqual([
      'analytics.sales_orders',
    ]);
    expect(extractSqlTableRefs('SELECT 1 FROM `analytics`.`sales_orders`')).toEqual([
      'analytics.sales_orders',
    ]);
  });

  it('lowercases refs for stable matching', () => {
    expect(extractSqlTableRefs('SELECT 1 FROM Analytics.Sales_Orders')).toEqual([
      'analytics.sales_orders',
    ]);
  });

  it('skips subqueries and unqualified single-word targets', () => {
    const sql = 'SELECT * FROM (SELECT id FROM staging) t JOIN lookup ON t.id = lookup.id';
    // `staging` and `lookup` are unqualified; `FROM (` is a subquery
    expect(extractSqlTableRefs(sql)).toEqual([]);
  });

  it('handles case-insensitive keywords and newlines', () => {
    expect(extractSqlTableRefs('select *\nfrom\n  analytics.daily_kpis')).toEqual([
      'analytics.daily_kpis',
    ]);
  });

  it('returns empty for non-string or empty input', () => {
    expect(extractSqlTableRefs(undefined)).toEqual([]);
    expect(extractSqlTableRefs(null)).toEqual([]);
    expect(extractSqlTableRefs('')).toEqual([]);
    expect(extractSqlTableRefs({ SqlQuery: 'not-a-string' })).toEqual([]);
  });
});
