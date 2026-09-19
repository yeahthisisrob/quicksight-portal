/**
 * "Start from what works": order the source list by how much it is used.
 *
 * Templates first (someone chose them on purpose), then the popular ones
 * (top quartile by views), then the rest. Pure functions over the activity
 * summary the asset lists already carry, so the ranking costs no extra call.
 */
import type { components } from '@shared/generated/types';

import { isTemplate } from '../model/templateTag';

export type ViewActivitySummary = components['schemas']['ViewActivitySummary'];

export interface RankableSource {
  id: string;
  name: string;
  tags?: Array<{ key: string; value: string }>;
  activity?: ViewActivitySummary | null;
}

export type SourceSort = 'views' | 'recent' | 'name';

export const SOURCE_SORTS: ReadonlyArray<{ value: SourceSort; label: string }> = [
  { value: 'views', label: 'Most viewed' },
  { value: 'recent', label: 'Recently viewed' },
  { value: 'name', label: 'Name' },
];

export type SourceBadge = 'template' | 'popular' | 'unused';

export type SourceGroup = 'templates' | 'popular' | 'rest';

export interface RankedSource<T extends RankableSource = RankableSource> {
  item: T;
  group: SourceGroup;
  badges: SourceBadge[];
}

/** Nothing viewed for this long counts as unused. */
export const UNUSED_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const QUARTILE = 4;

export const views = (item: RankableSource): number => item.activity?.totalViews ?? 0;
export const viewers = (item: RankableSource): number => item.activity?.uniqueViewers ?? 0;

export function lastViewedMs(item: RankableSource): number | null {
  const raw = item.activity?.lastViewed;
  if (!raw) {
    return null;
  }
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The view count at the 75th percentile among sources that have views at all.
 * Zero when nothing has been viewed, so nothing is "popular".
 */
export function popularThreshold(items: RankableSource[]): number {
  const counts = items
    .map(views)
    .filter((n) => n > 0)
    .sort((a, b) => b - a);
  if (counts.length === 0) {
    return 0;
  }
  const size = Math.max(1, Math.floor(counts.length / QUARTILE));
  return counts[size - 1] ?? 0;
}

export function isUnused(item: RankableSource, now = Date.now()): boolean {
  const last = lastViewedMs(item);
  return last === null || now - last > UNUSED_AFTER_DAYS * DAY_MS;
}

export function badgesFor(
  item: RankableSource,
  threshold: number,
  now = Date.now()
): SourceBadge[] {
  const out: SourceBadge[] = [];
  if (isTemplate(item.tags)) {
    out.push('template');
  }
  if (threshold > 0 && views(item) >= threshold) {
    out.push('popular');
  } else if (isUnused(item, now)) {
    out.push('unused');
  }
  return out;
}

function compare(sort: SourceSort) {
  return (a: RankableSource, b: RankableSource): number => {
    if (sort === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sort === 'recent') {
      const diff = (lastViewedMs(b) ?? 0) - (lastViewedMs(a) ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    }
    const diff = views(b) - views(a);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  };
}

/** Templates, then popular, then the rest; each group in the chosen order. */
export function rankSources<T extends RankableSource>(
  items: T[],
  sort: SourceSort = 'views',
  now = Date.now()
): RankedSource<T>[] {
  const threshold = popularThreshold(items);
  const ranked = items.map((item) => {
    const badges = badgesFor(item, threshold, now);
    const group: SourceGroup = badges.includes('template')
      ? 'templates'
      : badges.includes('popular')
        ? 'popular'
        : 'rest';
    return { item, group, badges };
  });
  const order: Record<SourceGroup, number> = { templates: 0, popular: 1, rest: 2 };
  const by = compare(sort);
  return ranked.sort((a, b) => order[a.group] - order[b.group] || by(a.item, b.item));
}

export const GROUP_LABELS: Record<SourceGroup, string> = {
  templates: 'Templates',
  popular: 'Popular',
  rest: 'Everything else',
};

const THOUSAND = 1000;
const MILLION = 1_000_000;

/** 1234 -> "1.2k", 1_200_000 -> "1.2m". */
export function compactNumber(n: number): string {
  if (n >= MILLION) {
    return `${trimZero((n / MILLION).toFixed(1))}m`;
  }
  if (n >= THOUSAND) {
    return `${trimZero((n / THOUSAND).toFixed(1))}k`;
  }
  return String(n);
}

function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const MONTH_DAYS = 30;
const YEAR_DAYS = 365;

/** "just now", "3 hours ago", "2 days ago", "4 months ago". Never a date. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) {
    return null;
  }
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) {
    return null;
  }
  const elapsed = Math.max(0, now - then);
  if (elapsed < MINUTE_MS) {
    return 'just now';
  }
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'} ago`;
  if (elapsed < HOUR_MS) {
    return unit(Math.floor(elapsed / MINUTE_MS), 'minute');
  }
  if (elapsed < DAY_MS) {
    return unit(Math.floor(elapsed / HOUR_MS), 'hour');
  }
  const days = Math.floor(elapsed / DAY_MS);
  if (days < MONTH_DAYS) {
    return unit(days, 'day');
  }
  if (days < YEAR_DAYS) {
    return unit(Math.floor(days / MONTH_DAYS), 'month');
  }
  return unit(Math.floor(days / YEAR_DAYS), 'year');
}
