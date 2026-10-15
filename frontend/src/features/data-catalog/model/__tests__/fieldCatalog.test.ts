import { describe, expect, it } from 'vitest';

import type { CalculatedFieldSummary } from '@/shared/api/modules/data-catalog';

import { readCatalogState, writeCatalogState } from '../catalogState';
import { isUnused, prettyExpression, totalUsage } from '../fieldCatalog';

const item = (over: Partial<CalculatedFieldSummary>): CalculatedFieldSummary => ({
  key: 'k',
  name: 'f',
  expression: '{a}',
  definedIn: [],
  datasets: [],
  references: [],
  usedBy: { dashboards: 0, analyses: 0, visuals: 0 },
  hasNote: false,
  ...over,
});

describe('prettyExpression', () => {
  it('leaves short expressions on one line', () => {
    expect(prettyExpression('{revenue} -   {cost}')).toBe('{revenue} - {cost}');
  });

  it('breaks a long call at its arguments and indents by depth', () => {
    expect(
      prettyExpression(
        "ifelse({status} = 'closed', ({revenue} - {cost}) / {revenue}, sumOver({revenue}, [{region}], PRE_AGG))"
      )
    ).toBe(
      [
        'ifelse(',
        "  {status} = 'closed',",
        '  (',
        '    {revenue} - {cost}',
        '  ) / {revenue},',
        '  sumOver(',
        '    {revenue},',
        '    [{region}],',
        '    PRE_AGG',
        '  )',
        ')',
      ].join('\n')
    );
  });

  it('never splits inside a string literal', () => {
    const out = prettyExpression(
      "ifelse({channel} = 'web, mobile (app)', 'online, direct', 'other channel (unknown)')"
    );
    expect(out).toContain("'web, mobile (app)'");
    expect(out).toContain("'other channel (unknown)'");
    expect(out.split('\n')).toHaveLength(5);
  });
});

describe('usage', () => {
  const a = item({ key: 'a', name: 'alpha', usedBy: { dashboards: 1, analyses: 0, visuals: 0 } });
  const b = item({ key: 'b', name: 'beta', usedBy: { dashboards: 0, analyses: 0, visuals: 9 } });
  const c = item({ key: 'c', name: 'alpha', expression: '{b}' });

  it('counts usage and unused', () => {
    expect(totalUsage(b)).toBe(9);
    expect(isUnused(c)).toBe(true);
    expect(isUnused(a)).toBe(false);
  });
});

describe('catalog URL state', () => {
  it('reads the tab, field and conflicts flags, ignoring an unknown tab', () => {
    const params = new URLSearchParams('tab=columns&project=p&field=cf_1&conflicts=1&q=margin');
    expect(readCatalogState(params)).toMatchObject({
      tab: 'columns',
      project: 'p',
      field: 'cf_1',
      conflicts: '1',
      q: 'margin',
    });
    expect(readCatalogState(new URLSearchParams('tab=nope')).tab).toBeUndefined();
    // Templates moved to the Author Studio.
    expect(readCatalogState(new URLSearchParams('tab=templates')).tab).toBeUndefined();
  });

  it('writes and clears keys', () => {
    const next = writeCatalogState(new URLSearchParams('tab=smus&asset=l1'), {
      tab: 'calculated-fields',
      asset: undefined,
      field: 'cf_2',
    });
    expect(next.toString()).toBe('tab=calculated-fields&field=cf_2');
  });
});
