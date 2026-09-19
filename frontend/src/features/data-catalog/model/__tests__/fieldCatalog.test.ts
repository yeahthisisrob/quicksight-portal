import { describe, expect, it } from 'vitest';

import type { CalculatedFieldSummary } from '@/shared/api/modules/data-catalog';

import { readCatalogState, writeCatalogState } from '../catalogState';
import {
  describeDefinedIn,
  isUnused,
  prettyExpression,
  sortCalculatedFields,
  totalUsage,
} from '../fieldCatalog';

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

describe('sortCalculatedFields', () => {
  const a = item({ key: 'a', name: 'alpha', usedBy: { dashboards: 1, analyses: 0, visuals: 0 } });
  const b = item({
    key: 'b',
    name: 'beta',
    usedBy: { dashboards: 0, analyses: 0, visuals: 9 },
    conflict: { variants: 2 },
    definedIn: [
      { type: 'dataset', id: 'd', name: 'd' },
      { type: 'dashboard', id: 'x', name: 'x' },
    ],
  });
  const c = item({ key: 'c', name: 'alpha', expression: '{b}', conflict: { variants: 1 } });

  it('sorts by name then expression, by usage, by conflicts, by definers, without mutating', () => {
    const input = [b, c, a];
    expect(sortCalculatedFields(input, 'name').map((i) => i.key)).toEqual(['a', 'c', 'b']);
    expect(sortCalculatedFields(input, 'usage').map((i) => i.key)).toEqual(['b', 'a', 'c']);
    expect(sortCalculatedFields(input, 'conflicts').map((i) => i.key)).toEqual(['b', 'c', 'a']);
    expect(sortCalculatedFields(input, 'definedIn').map((i) => i.key)).toEqual(['b', 'a', 'c']);
    expect(input.map((i) => i.key)).toEqual(['b', 'c', 'a']);
  });

  it('counts usage and unused', () => {
    expect(totalUsage(b)).toBe(9);
    expect(isUnused(c)).toBe(true);
    expect(isUnused(a)).toBe(false);
  });
});

describe('describeDefinedIn', () => {
  it('reads dataset, dashboard, analysis in that order with plurals', () => {
    expect(
      describeDefinedIn([
        { type: 'dashboard', id: '1', name: 'A' },
        { type: 'dataset', id: '2', name: 'B' },
        { type: 'dashboard', id: '3', name: 'C' },
        { type: 'analysis', id: '4', name: 'D' },
      ])
    ).toBe('1 dataset · 2 dashboards · 1 analysis');
    expect(describeDefinedIn([])).toBe('nowhere');
  });
});

describe('catalog URL state', () => {
  it('reads the tab, field, conflicts and templates flags, ignoring an unknown tab', () => {
    const params = new URLSearchParams(
      'tab=columns&project=p&field=cf_1&conflicts=1&q=margin&templates=1'
    );
    expect(readCatalogState(params)).toMatchObject({
      tab: 'columns',
      project: 'p',
      field: 'cf_1',
      conflicts: '1',
      q: 'margin',
      templates: '1',
    });
    expect(readCatalogState(new URLSearchParams('tab=nope')).tab).toBeUndefined();
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
