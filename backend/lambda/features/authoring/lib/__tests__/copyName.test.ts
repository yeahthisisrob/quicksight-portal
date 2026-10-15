import { describe, expect, it } from 'vitest';

import { nextVersionName, rootName } from '../copyName';

describe('nextVersionName', () => {
  it('starts at v2 and counts on from the highest version in use', () => {
    expect(nextVersionName('Sales review', [])).toBe('Sales review v2');
    expect(nextVersionName('Sales review', ['Sales review', 'Sales review v2'])).toBe(
      'Sales review v3'
    );
    expect(nextVersionName('Sales review v2', ['Sales review', 'Sales review v2'])).toBe(
      'Sales review v3'
    );
    expect(
      nextVersionName('Sales review', ['Sales review v4', 'sales review v7', 'Other v9'])
    ).toBe('Sales review v8');
  });

  it('treats an old "(copy)" as the first version, so copies never chain suffixes', () => {
    expect(nextVersionName('Sales review (copy)', ['Sales review (copy)'])).toBe('Sales review v3');
    expect(nextVersionName('Sales review', ['Sales review (copy)'])).toBe('Sales review v3');
    expect(rootName('Sales review (copy)')).toBe('Sales review');
    expect(rootName('Sales review v12')).toBe('Sales review');
    expect(rootName('Version 2 review')).toBe('Version 2 review');
  });
});
