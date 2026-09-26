import { describe, expect, it } from 'vitest';

import type { ReferencedColumn } from '../../types';
import { normalizeColumnName, resolveColumns } from '../columnResolution';
import { emptyUsage } from '../definitionColumns';

const ref = (name: string): ReferencedColumn => ({ name, usage: emptyUsage() });

const TARGET = [
  { name: 'status', type: 'STRING' },
  { name: 'net_revenue', type: 'DECIMAL' },
  { name: 'Order Date', type: 'DATETIME' },
  { name: 'customer_id', type: 'STRING' },
];

describe('normalizeColumnName', () => {
  it('ignores case, spaces and separators', () => {
    expect(normalizeColumnName('Order Date')).toBe('orderdate');
    expect(normalizeColumnName('order_date')).toBe('orderdate');
    expect(normalizeColumnName('ORDER-DATE')).toBe('orderdate');
  });
});

describe('resolveColumns', () => {
  it('matches identical names', () => {
    const result = resolveColumns([ref('status')], TARGET);
    expect(result.columns).toEqual([
      {
        name: 'status',
        status: 'matched',
        resolvedTo: 'status',
        targetType: 'STRING',
        usage: emptyUsage(),
      },
    ]);
    expect(result.canApply).toBe(true);
  });

  it('maps through the column map', () => {
    const result = resolveColumns([ref('revenue')], TARGET, { revenue: 'net_revenue' });
    expect(result.columns[0]).toMatchObject({
      status: 'mapped',
      resolvedTo: 'net_revenue',
      targetType: 'DECIMAL',
    });
    expect(result.canApply).toBe(true);
  });

  it('suggests a near match but does not apply it', () => {
    const result = resolveColumns([ref('order_date')], TARGET);
    expect(result.columns[0]).toMatchObject({
      status: 'suggested',
      suggestion: 'Order Date',
      targetType: 'DATETIME',
    });
    expect(result.columns[0]?.resolvedTo).toBeUndefined();
    expect(result.canApply).toBe(false);
  });

  it('flags a column with nothing close as missing', () => {
    const result = resolveColumns([ref('cost')], TARGET);
    expect(result.columns[0]).toEqual({ name: 'cost', status: 'missing', usage: emptyUsage() });
    expect(result.canApply).toBe(false);
  });

  it('treats a mapping to a column the target lacks as missing, with a hint', () => {
    const result = resolveColumns([ref('order_date')], TARGET, { order_date: 'ORDER_DATE' });
    expect(result.columns[0]).toMatchObject({ status: 'missing', suggestion: 'Order Date' });
  });

  it('only suggests when the near match is unambiguous', () => {
    const ambiguous = [...TARGET, { name: 'order-date', type: 'STRING' }];
    const result = resolveColumns([ref('order_date')], ambiguous);
    expect(result.columns[0]?.status).toBe('missing');
    expect(result.columns[0]?.suggestion).toBeUndefined();
  });

  it('summarises and lists target columns nothing uses', () => {
    const result = resolveColumns(
      [ref('status'), ref('revenue'), ref('order_date'), ref('cost')],
      TARGET,
      { revenue: 'net_revenue' }
    );
    expect(result.summary).toEqual({ matched: 1, mapped: 1, suggested: 1, missing: 1 });
    expect(result.unusedTargetColumns).toEqual(['Order Date', 'customer_id']);
  });
});
