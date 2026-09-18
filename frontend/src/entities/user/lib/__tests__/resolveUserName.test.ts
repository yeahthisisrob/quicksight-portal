import { describe, expect, it } from 'vitest';

import { resolveUserName, resolveUserNames } from '../resolveUserName';

describe('resolveUserName', () => {
  it('prefers userName, then name, then id', () => {
    expect(resolveUserName({ userName: 'alice', name: 'Alice', id: 'u1' })).toBe('alice');
    expect(resolveUserName({ name: 'alice', id: 'u1' })).toBe('alice');
    expect(resolveUserName({ id: 'u1' })).toBe('u1');
  });

  it('returns an empty string for blank or missing values', () => {
    expect(resolveUserName({ userName: '   ' })).toBe('');
    expect(resolveUserName({})).toBe('');
    expect(resolveUserName(null)).toBe('');
    expect(resolveUserName(undefined)).toBe('');
  });

  it('trims whitespace', () => {
    expect(resolveUserName({ name: '  bob ' })).toBe('bob');
  });
});

describe('resolveUserNames', () => {
  it('drops unresolvable entries so [null] never reaches the API', () => {
    // A users-grid row: name/id, no userName
    const gridRow = { id: 'u1', name: 'alice', type: 'user' };
    expect(resolveUserNames([gridRow, {}, null, { userName: '' }])).toEqual(['alice']);
  });

  it('de-duplicates', () => {
    expect(resolveUserNames([{ name: 'alice' }, { userName: 'alice' }, { id: 'bob' }])).toEqual([
      'alice',
      'bob',
    ]);
  });
});
