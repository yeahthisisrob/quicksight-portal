import { describe, expect, it } from 'vitest';

import {
  badgesFor,
  compactNumber,
  isUnused,
  popularThreshold,
  rankSources,
  timeAgo,
} from '../ranking';

const NOW = new Date('2026-09-18T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();
const TEMPLATE = { key: 'quicksight-portal:template', value: 'true' };

const ITEMS = [
  {
    id: 'a',
    name: 'Alpha',
    activity: { totalViews: 1000, uniqueViewers: 40, lastViewed: daysAgo(1) },
  },
  {
    id: 'b',
    name: 'Bravo',
    activity: { totalViews: 500, uniqueViewers: 20, lastViewed: daysAgo(3) },
  },
  {
    id: 'c',
    name: 'Charlie',
    activity: { totalViews: 200, uniqueViewers: 9, lastViewed: daysAgo(10) },
  },
  {
    id: 'd',
    name: 'Delta',
    activity: { totalViews: 50, uniqueViewers: 3, lastViewed: daysAgo(40) },
  },
  {
    id: 'e',
    name: 'Echo',
    activity: { totalViews: 10, uniqueViewers: 1, lastViewed: daysAgo(120) },
  },
  {
    id: 'f',
    name: 'Foxtrot',
    tags: [TEMPLATE],
    activity: { totalViews: 5, lastViewed: daysAgo(2) },
  },
  { id: 'g', name: 'Golf' },
  {
    id: 'h',
    name: 'Hotel',
    activity: { totalViews: 900, uniqueViewers: 30, lastViewed: daysAgo(2) },
  },
];

describe('ranking', () => {
  it('popular is the top quartile by views, among sources with views', () => {
    // 7 sources have views; floor(7/4) = 1 → only the top one is popular.
    expect(popularThreshold(ITEMS)).toBe(1000);
    expect(popularThreshold([{ id: 'x', name: 'x' }])).toBe(0);
    expect(popularThreshold([])).toBe(0);
  });

  it('badges: template, popular, unused (nothing in 90 days or never)', () => {
    const t = popularThreshold(ITEMS);
    expect(badgesFor(ITEMS[0]!, t, NOW)).toEqual(['popular']);
    expect(badgesFor(ITEMS[1]!, t, NOW)).toEqual([]);
    expect(badgesFor(ITEMS[4]!, t, NOW)).toEqual(['unused']);
    expect(badgesFor(ITEMS[5]!, t, NOW)).toEqual(['template']);
    expect(badgesFor(ITEMS[6]!, t, NOW)).toEqual(['unused']);
    expect(isUnused({ id: 'x', name: 'x', activity: { lastViewed: daysAgo(89) } }, NOW)).toBe(
      false
    );
    expect(isUnused({ id: 'x', name: 'x', activity: { lastViewed: daysAgo(91) } }, NOW)).toBe(true);
  });

  it('ranks templates first, then popular, then the rest, most viewed within each', () => {
    const ranked = rankSources(ITEMS, 'views', NOW);
    expect(ranked.map((r) => r.item.id)).toEqual(['f', 'a', 'h', 'b', 'c', 'd', 'e', 'g']);
    expect(ranked.map((r) => r.group)).toEqual([
      'templates',
      'popular',
      'rest',
      'rest',
      'rest',
      'rest',
      'rest',
      'rest',
    ]);
  });

  it('sorts by recency and by name inside the groups', () => {
    expect(rankSources(ITEMS, 'recent', NOW).map((r) => r.item.id)).toEqual([
      'f',
      'a',
      'h',
      'b',
      'c',
      'd',
      'e',
      'g',
    ]);
    expect(rankSources(ITEMS, 'name', NOW).map((r) => r.item.id)).toEqual([
      'f',
      'a',
      'b',
      'c',
      'd',
      'e',
      'g',
      'h',
    ]);
  });

  it('formats counts compactly', () => {
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(1000)).toBe('1k');
    expect(compactNumber(1840)).toBe('1.8k');
    expect(compactNumber(1_250_000)).toBe('1.3m');
  });

  it('says how long ago in words', () => {
    expect(timeAgo(undefined, NOW)).toBeNull();
    expect(timeAgo('not a date', NOW)).toBeNull();
    expect(timeAgo(new Date(NOW - 10_000).toISOString(), NOW)).toBe('just now');
    expect(timeAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5 minutes ago');
    expect(timeAgo(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe('3 hours ago');
    expect(timeAgo(daysAgo(1), NOW)).toBe('1 day ago');
    expect(timeAgo(daysAgo(12), NOW)).toBe('12 days ago');
    expect(timeAgo(daysAgo(70), NOW)).toBe('2 months ago');
    expect(timeAgo(daysAgo(800), NOW)).toBe('2 years ago');
  });
});
