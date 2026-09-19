import { describe, expect, it } from 'vitest';

import { matchListingColumn, normalizeColumnName } from '../columnIdentity';

describe('normalizeColumnName', () => {
  it('treats case, separators and camel humps as noise', () => {
    const forms = ['customer_id', 'Customer ID', 'customer-id', 'CustomerId', '  CUSTOMER_ID  '];
    expect(new Set(forms.map(normalizeColumnName)).size).toBe(1);
    expect(normalizeColumnName('Customer ID')).toBe('customer_id');
  });

  it('keeps columns that really are different apart', () => {
    expect(normalizeColumnName('customer_id')).not.toBe(normalizeColumnName('customerid2'));
    expect(normalizeColumnName('net_revenue')).not.toBe(normalizeColumnName('gross_revenue'));
  });
});

describe('matchListingColumn', () => {
  const columns = [
    { name: 'customer_id', type: 'bigint', description: 'Surrogate key' },
    { name: 'net_revenue', type: 'decimal' },
  ];

  it('matches the exact name first, whatever else normalizes the same', () => {
    const hit = matchListingColumn('customer_id', [{ name: 'Customer ID' }, ...columns]);
    expect(hit).toMatchObject({ match: 'exact', column: { name: 'customer_id' } });
  });

  it('matches a renamed column through normalization', () => {
    expect(matchListingColumn('Customer ID', columns)).toMatchObject({
      match: 'normalized',
      column: { name: 'customer_id', description: 'Surrogate key' },
    });
    expect(matchListingColumn('NetRevenue', columns)?.column.name).toBe('net_revenue');
  });

  it('is undefined when the listing has no columns, no name, or nothing close', () => {
    expect(matchListingColumn('customer_id', undefined)).toBeUndefined();
    expect(matchListingColumn('customer_id', [])).toBeUndefined();
    expect(matchListingColumn('', columns)).toBeUndefined();
    expect(matchListingColumn('customer_id', [{ name: '' }])).toBeUndefined();
    expect(matchListingColumn('order_date', columns)).toBeUndefined();
  });
});
