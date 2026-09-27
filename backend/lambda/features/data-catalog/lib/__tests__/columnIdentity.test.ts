import { describe, expect, it } from 'vitest';

import { matchListingColumn } from '../columnIdentity';

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
