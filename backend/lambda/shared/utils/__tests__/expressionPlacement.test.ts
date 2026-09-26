import { describe, expect, it } from 'vitest';

import { placementOf, sameFieldName } from '../../../../../shared/lib/expressionPlacement';

describe('placementOf', () => {
  it('keeps row-level logic materialisable', () => {
    expect(placementOf('{revenue} - {cost}')).toEqual({ placement: 'row-level', reasons: [] });
    expect(placementOf("ifelse({status} = 'closed', 1, 0)").placement).toBe('row-level');
    expect(placementOf("concat({first}, ' ', {last})").placement).toBe('row-level');
  });

  it('puts aggregates, table calculations, level-aware calcs and parameters in the analysis', () => {
    expect(placementOf('sum({revenue}) / sum({cost})')).toEqual({
      placement: 'query-time',
      reasons: ['sum'],
    });
    expect(placementOf('runningSum(sum({revenue}), [{order_date} ASC])').reasons).toContain(
      'runningSum'
    );
    expect(placementOf('sumIf({revenue}, {region} = "EU")').placement).toBe('query-time');
    expect(placementOf('sum({revenue}, [{region}])').placement).toBe('query-time');
    expect(placementOf('{revenue} * ${fx_rate}')).toEqual({
      placement: 'query-time',
      reasons: ['a parameter'],
    });
  });

  it('ignores function-like text inside strings and column names', () => {
    expect(placementOf("ifelse({sum (legacy)} > 0, 'sum(x)', 'none')").placement).toBe('row-level');
  });
});

describe('sameFieldName', () => {
  it('matches the way people write column names', () => {
    expect(sameFieldName('net_margin', 'Net Margin')).toBe(true);
    expect(sameFieldName('margin', 'margin_pct')).toBe(false);
  });
});
