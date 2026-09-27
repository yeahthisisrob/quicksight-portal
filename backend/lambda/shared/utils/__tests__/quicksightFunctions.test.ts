import { describe, expect, it } from 'vitest';

import {
  EVALUATION_ORDER,
  QUICKSIGHT_FUNCTIONS,
} from '../../../../../shared/lib/quicksightFunctions';

const byName = (name: string) => QUICKSIGHT_FUNCTIONS.find((f) => f.name === name);

describe('QUICKSIGHT_FUNCTIONS', () => {
  it('has unique names, ignoring case', () => {
    const names = QUICKSIGHT_FUNCTIONS.map((f) => f.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only known kinds', () => {
    const kinds = new Set(['scalar', 'aggregate', 'table-calc', 'lac-w']);
    for (const f of QUICKSIGHT_FUNCTIONS) {
      expect(kinds.has(f.kind), f.name).toBe(true);
    }
  });

  it('links every window function to its docs page', () => {
    for (const f of QUICKSIGHT_FUNCTIONS.filter((fn) => fn.kind !== 'scalar')) {
      expect(f.docUrl, f.name).toMatch(/^https:\/\/docs\.aws\.amazon\.com\/quicksight\/.+\.html$/);
    }
  });

  it('classifies the anchors the way the docs do', () => {
    expect(byName('sumOver')?.kind).toBe('lac-w');
    expect(byName('sumOver')?.calcLevels).toContain('PRE_AGG');
    expect(byName('sum')).toMatchObject({ kind: 'aggregate', lacA: true });
    expect(byName('sumIf')?.lacA).toBeUndefined();
    expect(byName('ifelse')?.kind).toBe('scalar');
  });

  it('gives every stage of the evaluation order a unique id', () => {
    const ids = EVALUATION_ORDER.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
