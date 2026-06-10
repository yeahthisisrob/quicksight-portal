import { describe, expect, it } from 'vitest';

import {
  detectConflict,
  expressionLength,
  extractFieldReferences,
  hasComments,
  normalizeExpression,
} from '../expressionAnalysis';

describe('extractFieldReferences', () => {
  it('extracts distinct brace field references', () => {
    expect(extractFieldReferences('sum({Sales}) / {Sales} + {Cost}')).toEqual(['Sales', 'Cost']);
  });

  it('trims whitespace inside braces', () => {
    expect(extractFieldReferences('{ Net Revenue }')).toEqual(['Net Revenue']);
  });

  it('excludes the field itself', () => {
    expect(extractFieldReferences('{Total} - {Total}', 'Total')).toEqual([]);
  });

  it('returns empty for null/empty expressions', () => {
    expect(extractFieldReferences(undefined)).toEqual([]);
    expect(extractFieldReferences('')).toEqual([]);
    expect(extractFieldReferences('1 + 2')).toEqual([]);
  });

  it('is stable across repeated calls (no stateful regex leakage)', () => {
    const expr = '{A} + {B}';
    expect(extractFieldReferences(expr)).toEqual(['A', 'B']);
    expect(extractFieldReferences(expr)).toEqual(['A', 'B']);
  });
});

describe('hasComments', () => {
  it('detects block comments', () => {
    expect(hasComments('sum({Sales}) /* yearly */')).toBe(true);
  });

  it('detects line comments', () => {
    expect(hasComments('sum({Sales}) // total')).toBe(true);
  });

  it('returns false when there are no comments', () => {
    expect(hasComments('sum({Sales})')).toBe(false);
    expect(hasComments(undefined)).toBe(false);
  });
});

describe('expressionLength', () => {
  it('returns trimmed length', () => {
    expect(expressionLength('  abc  ')).toBe('abc'.length);
    expect(expressionLength(null)).toBe(0);
  });
});

describe('normalizeExpression', () => {
  it('collapses whitespace', () => {
    expect(normalizeExpression('sum(  {Sales} )')).toBe('sum( {Sales} )');
  });
});

describe('detectConflict', () => {
  it('flags a conflict when distinct expressions exist', () => {
    expect(detectConflict(['sum({A})', 'avg({A})'])).toEqual({
      hasExpressionConflict: true,
      conflictCount: 2,
    });
  });

  it('treats whitespace-run differences as the same expression', () => {
    expect(detectConflict(['{A} +  {B}', '{A} + {B}', '  {A} + {B}'])).toEqual({
      hasExpressionConflict: false,
      conflictCount: 1,
    });
  });

  it('ignores empty expressions', () => {
    expect(detectConflict(['', null, undefined])).toEqual({
      hasExpressionConflict: false,
      conflictCount: 0,
    });
  });
});
