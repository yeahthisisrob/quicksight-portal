import { describe, expect, it } from 'vitest';

import { DEFAULT_NAMING, followsStandard, standardName } from '../namingStandard';

describe('the calculated-field naming standard', () => {
  it('knows where a field lives by its prefix, the longer one first', () => {
    expect(followsStandard('c_margin', 'exploration', DEFAULT_NAMING)).toBe(true);
    expect(followsStandard('c_ds_margin', 'dataset', DEFAULT_NAMING)).toBe(true);
    // c_ds_ starts with c_, but a dataset-named field is not an exploration field.
    expect(followsStandard('c_ds_margin', 'exploration', DEFAULT_NAMING)).toBe(false);
    expect(followsStandard('c_margin', 'dataset', DEFAULT_NAMING)).toBe(false);
    expect(followsStandard('Net Margin', 'exploration', DEFAULT_NAMING)).toBe(false);
  });

  it('gives a field its standard name wherever it came from', () => {
    expect(standardName('Net Margin %', 'exploration', DEFAULT_NAMING)).toBe('c_net_margin');
    expect(standardName('netMargin', 'dataset', DEFAULT_NAMING)).toBe('c_ds_net_margin');
    // Moving a field from the analysis into the dataset swaps the prefix.
    expect(standardName('c_margin', 'dataset', DEFAULT_NAMING)).toBe('c_ds_margin');
    expect(standardName('c_ds_margin', 'exploration', DEFAULT_NAMING)).toBe('c_margin');
    expect(standardName('c_margin', 'exploration', DEFAULT_NAMING)).toBe('c_margin');
  });

  it('follows a custom standard', () => {
    const custom = { calcFieldPrefix: 'calc_', datasetCalcFieldPrefix: 'ds_' };
    expect(standardName('c_margin', 'dataset', custom)).toBe('ds_c_margin');
    expect(standardName('calc_margin', 'dataset', custom)).toBe('ds_margin');
    expect(followsStandard('ds_margin', 'dataset', custom)).toBe(true);
  });
});
