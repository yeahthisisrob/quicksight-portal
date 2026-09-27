import { describe, expect, it } from 'vitest';

import {
  classifyExpression,
  classifyFields,
  functionSpans,
} from '../../../../../shared/lib/expressionKinds';
import {
  expressionFields,
  parseExpression,
  renameFields,
} from '../../../../../shared/lib/expressionParser';

describe('parseExpression', () => {
  it('binds the way QuickSight does', () => {
    const parsed = parseExpression('{a} + {b} * 2 > 3 AND NOT {c} = 1');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.ast).toMatchObject({
      type: 'binary',
      op: 'AND',
      left: {
        op: '>',
        left: { op: '+', left: { name: 'a' }, right: { op: '*', left: { name: 'b' } } },
      },
      right: { type: 'unary', op: 'NOT', arg: { op: '=' } },
    });
  });

  it('reads calls, lists with sort orders, calc levels, parameters and bare columns', () => {
    const parsed = parseExpression(
      'rank([sum({sales}) DESC], [{region}], PRE_AGG) + ${bonus} - revenue'
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const rank = (parsed.ast as any).left.left;
    expect(rank).toMatchObject({
      type: 'call',
      name: 'rank',
      args: [
        { type: 'list', items: [{ order: 'DESC', expression: { type: 'call', name: 'sum' } }] },
        { type: 'list', items: [{ expression: { type: 'field', name: 'region' } }] },
        { type: 'keyword', name: 'PRE_AGG' },
      ],
    });
    expect((parsed.ast as any).left.right).toMatchObject({ type: 'parameter', name: 'bonus' });
    expect((parsed.ast as any).right).toMatchObject({ type: 'field', name: 'revenue' });
  });

  it('says where it stopped', () => {
    expect(parseExpression('sum({revenue}')).toEqual({
      ok: false,
      error: { message: 'Expected ) to close sum( before the end', position: 13 },
    });
    expect(parseExpression("concat('a, {b})")).toMatchObject({ ok: false });
    expect(parseExpression('   ')).toMatchObject({
      ok: false,
      error: { message: 'The expression is empty' },
    });
  });
});

describe('classifyExpression', () => {
  it('row-level logic is materialised by SPICE', () => {
    const verdict = classifyExpression("ifelse({status} = 'C', {revenue} - {cost}, 0)");
    expect(verdict).toMatchObject({
      kind: 'row-level',
      stage: 'simple-calculations',
      materialisable: true,
      fields: ['status', 'revenue', 'cost'],
    });
    expect(verdict.functions.map((f) => f.name)).toEqual(['ifelse']);
  });

  it('a list argument alone does not make a LAC-A: in() is row-level', () => {
    expect(classifyExpression("in({region}, ['EU', 'US'])").kind).toBe('row-level');
  });

  it('aggregates, LAC-A, LAC-W by level, and table calculations', () => {
    expect(classifyExpression('sum({revenue}) / sum({cost})')).toMatchObject({
      kind: 'aggregate',
      stage: 'visual-aggregations',
      materialisable: false,
    });
    expect(classifyExpression('sum({revenue}, [{region}])')).toMatchObject({
      kind: 'lac-a',
      stage: 'lac-a',
    });
    expect(classifyExpression('sumOver({revenue}, [{region}], PRE_FILTER)')).toMatchObject({
      kind: 'lac-w',
      stage: 'lac-w-pre-filter',
      calcLevel: 'PRE_FILTER',
    });
    expect(classifyExpression('sumOver({revenue}, [{region}], PRE_AGG)')).toMatchObject({
      kind: 'lac-w',
      calcLevel: 'PRE_AGG',
    });
    // No level: the documented default runs after aggregation.
    expect(classifyExpression('sumOver(sum({revenue}), [{region}])')).toMatchObject({
      kind: 'table-calc',
      stage: 'table-calculations',
      calcLevel: 'POST_AGG_FILTER',
    });
    expect(classifyExpression('runningSum(sum({revenue}), [{order_date} ASC])').kind).toBe(
      'table-calc'
    );
    expect(classifyExpression('rank([{sales} DESC], [{region}], PRE_FILTER)')).toMatchObject({
      kind: 'lac-w',
      stage: 'lac-w-pre-filter',
    });
  });

  it('a window that cannot run after aggregation defaults to the latest level it allows', () => {
    expect(classifyExpression('distinctCountOver({customer}, [{region}])')).toMatchObject({
      kind: 'lac-w',
      calcLevel: 'PRE_AGG',
    });
  });

  it('takes the latest stage any part needs', () => {
    const verdict = classifyExpression('runningSum(sum({revenue}, [{region}]), [{month} ASC])');
    expect(verdict.kind).toBe('table-calc');
    expect(verdict.reasons).toEqual([
      'runningSum runs over the aggregated result',
      'sum with its own group-by level (LAC-A)',
    ]);
  });

  it('a parameter keeps a row-level field out of SPICE', () => {
    expect(classifyExpression('{revenue} * ${fx_rate}')).toMatchObject({
      kind: 'row-level',
      materialisable: false,
      parameters: ['fx_rate'],
    });
  });

  it('follows fields that are calculated themselves', () => {
    const kindOf = (field: string) =>
      field === 'margin'
        ? ({ kind: 'aggregate', stage: 'visual-aggregations', materialisable: false } as const)
        : undefined;
    expect(classifyExpression('{margin} / 2', { kindOf })).toMatchObject({
      kind: 'aggregate',
      materialisable: false,
      reasons: ['reads margin (aggregate)'],
    });
  });

  it('ignores function-like text in strings and field names, and names what it does not know', () => {
    expect(classifyExpression("ifelse({sum (legacy)} > 0, 'sum(x)', 'none')").kind).toBe(
      'row-level'
    );
    expect(classifyExpression('mystery({x})').unknownFunctions).toEqual(['mystery']);
  });

  it('still classifies an expression that does not parse, from the names it calls', () => {
    const verdict = classifyExpression('sum({revenue}');
    expect(verdict.kind).toBe('aggregate');
    expect(verdict.error?.message).toContain('Expected )');
  });
});

describe('classifyFields', () => {
  it('resolves fields that read fields, and survives a cycle', () => {
    const verdicts = classifyFields([
      { name: 'total', expression: 'sum({revenue})' },
      { name: 'share', expression: '{total} / 2' },
      { name: 'plain', expression: '{revenue} - {cost}' },
      { name: 'a', expression: '{b} + 1' },
      { name: 'b', expression: '{a} + 1' },
      { name: 'revenue' },
    ]);
    expect(verdicts.get('share')?.kind).toBe('aggregate');
    expect(verdicts.get('plain')?.materialisable).toBe(true);
    expect(verdicts.get('a')?.kind).toBe('row-level');
    expect(verdicts.has('revenue')).toBe(false);
  });
});

describe('expressionFields and renameFields', () => {
  it('reads and renames fields, never parameters or text in strings', () => {
    const expression = "ifelse({ margin } > ${floor}, concat('{margin}', {status}), {margin})";
    expect(expressionFields(expression)).toEqual(['margin', 'status']);
    expect(renameFields(expression, { margin: 'c_margin' })).toBe(
      "ifelse({c_margin} > ${floor}, concat('{margin}', {status}), {c_margin})"
    );
    expect(renameFields(expression, { other: 'x' })).toBe(expression);
  });

  it('falls back to the tokens it can see when the text will not tokenize', () => {
    expect(expressionFields("{a} + 'unclosed")).toEqual(['a']);
    expect(renameFields("{a} + 'unclosed", { a: 'b' })).toBe("{b} + 'unclosed");
  });
});

describe('functionSpans', () => {
  it('finds calls outside strings and fields, with doc links for known ones', () => {
    const expression = "sum({x}) + mystery({y}) + len('sum(z)')";
    expect(functionSpans(expression)).toEqual([
      expect.objectContaining({
        name: 'sum',
        start: 0,
        end: 3,
        docUrl: expect.stringContaining('sum'),
      }),
      { name: 'mystery', start: 11, end: 18 },
      expect.objectContaining({ name: 'len', start: 26 }),
    ]);
  });
});
