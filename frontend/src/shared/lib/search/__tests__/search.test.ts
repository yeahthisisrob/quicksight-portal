import { describe, expect, it } from 'vitest';

import type { SearchHit } from '@/shared/api/modules/search';

import { describeIndexed, flattenGroups, groupHits, SEARCH_FILTERS } from '../groupHits';
import { moveSelection } from '../keyboard';

const hit = (type: SearchHit['type'], id: string, score: number): SearchHit => ({
  type,
  id,
  name: id,
  score,
  why: [],
  summary: `${type}: ${id}`,
  path: '/',
});

describe('groupHits', () => {
  it('groups by type in presentation order and keeps score order inside a group', () => {
    const groups = groupHits([
      hit('visual', 'v1', 9),
      hit('dashboard', 'd-low', 2),
      hit('calculated-field', 'cf', 8),
      hit('dashboard', 'd-high', 7),
    ]);
    expect(groups.map((g) => g.type)).toEqual(['dashboard', 'calculated-field', 'visual']);
    expect(groups[0]!.label).toBe('Dashboards');
    expect(groups[0]!.hits.map((h) => h.id)).toEqual(['d-low', 'd-high']);
    expect(flattenGroups(groups).map((h) => h.id)).toEqual(['d-low', 'd-high', 'cf', 'v1']);
  });

  it('drops empty groups and describes what was indexed', () => {
    expect(groupHits([])).toEqual([]);
    expect(describeIndexed({ dashboard: 1, 'calculated-field': 12, folder: 0 })).toBe(
      '1 dashboard, 12 calculated fields'
    );
  });

  it('offers an All filter first with no types', () => {
    expect(SEARCH_FILTERS[0]).toEqual({ id: 'all', label: 'All', types: [] });
    expect(SEARCH_FILTERS.find((f) => f.id === 'calculated')?.types).toEqual(['calculated-field']);
  });
});

describe('moveSelection', () => {
  it('wraps in both directions and starts from the right end', () => {
    expect(moveSelection(-1, 1, 3)).toBe(0);
    expect(moveSelection(-1, -1, 3)).toBe(2);
    expect(moveSelection(2, 1, 3)).toBe(0);
    expect(moveSelection(0, -1, 3)).toBe(2);
    expect(moveSelection(1, 1, 3)).toBe(2);
  });

  it('has nothing to select on an empty list', () => {
    expect(moveSelection(0, 1, 0)).toBe(-1);
  });
});
