import { describe, expect, it } from 'vitest';

import { orderColumns } from '../columnOrder';

const cols = (...ids: string[]) => ids.map((id) => ({ id, label: id }) as any);
const idsOf = (columns: Array<{ id: string }>) => columns.map((c) => c.id);

describe('orderColumns', () => {
  it('puts dashboard columns in the stated order whatever order they arrive in', () => {
    const shuffled = cols(
      'folders',
      'status',
      'errors',
      'healthLoad',
      'uses',
      'tags',
      'activity',
      'name',
      'enrichmentStatus',
      'sheetCount',
      'actions',
      'healthCount',
      'visualCount',
      'permissions',
      'healthErrors',
      'createdTime',
      'id',
      'lastModified'
    );
    expect(idsOf(orderColumns('dashboard', shuffled))).toEqual([
      'actions',
      'name',
      'id',
      'lastModified',
      'createdTime',
      'permissions',
      'tags',
      'folders',
      'uses',
      'activity',
      'healthCount',
      'healthLoad',
      'healthErrors',
      'sheetCount',
      'visualCount',
      'errors',
      'status',
      'enrichmentStatus',
    ]);
  });

  it('places folders and usage right after tags, then activity and health', () => {
    const ordered = idsOf(
      orderColumns('dataset', cols('activity', 'healthLoad', 'usedBy', 'uses', 'folders', 'tags'))
    );
    expect(ordered).toEqual(['tags', 'folders', 'usedBy', 'uses', 'activity', 'healthLoad']);
  });

  it('keeps ids it does not know, in their own order, after the known ones', () => {
    const ordered = idsOf(orderColumns('dashboard', cols('mystery', 'name', 'other', 'actions')));
    expect(ordered).toEqual(['actions', 'name', 'mystery', 'other']);
  });

  it('leaves a type with no stated order alone', () => {
    const ordered = idsOf(orderColumns('namespace', cols('b', 'a')));
    expect(ordered).toEqual(['b', 'a']);
  });
});
