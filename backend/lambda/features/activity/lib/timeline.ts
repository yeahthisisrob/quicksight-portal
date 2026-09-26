/**
 * Timeline query helpers - extracted from ActivityService.getTimelinePage so
 * the public method stays under the lint complexity/statement limits and the
 * predicate logic is unit-testable on its own.
 */

import type { ActivityCache, MinimalEvent, TimelineQuery } from '../types';

export const TIMELINE_CONSTANTS = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
} as const;

interface TimelinePredicate {
  cursorMs: number | null;
  startMs: number | null;
  endMs: number | null;
  resourceTypes: Set<string> | null;
  eventNames: Set<string> | null;
  excludeEventNames: Set<string> | null;
  actions: Set<string> | null;
  users: Set<string> | null;
  origins: Set<string> | null;
  /** Supplied by the service: the origin of an event, used only when `origins` is set. */
  originFor?: (evt: MinimalEvent) => string;
  pinnedAssetType: string | undefined;
  pinnedAssetId: string | undefined;
}

/** Build an immutable predicate bundle from a TimelineQuery. */
export function buildTimelinePredicate(
  query: TimelineQuery,
  originFor?: (evt: MinimalEvent) => string
): TimelinePredicate {
  return {
    origins: query.origins && query.origins.length > 0 ? new Set(query.origins) : null,
    originFor,
    cursorMs: query.cursor ? Date.parse(query.cursor) : null,
    startMs: query.startDate ? Date.parse(query.startDate) : null,
    endMs: query.endDate ? Date.parse(query.endDate) : null,
    resourceTypes: query.resourceTypes ? new Set(query.resourceTypes) : null,
    eventNames: query.eventNames ? new Set(query.eventNames) : null,
    excludeEventNames: query.excludeEventNames ? new Set(query.excludeEventNames) : null,
    actions: query.actions ? new Set(query.actions) : null,
    users: query.users ? new Set(query.users.map((u) => u.toLowerCase())) : null,
    pinnedAssetType: query.assetType,
    pinnedAssetId: query.assetId,
  };
}

/** Flatten the date-grouped activity cache into a single list of mutation
 *  events, sorted newest-first. Views (kind !== 'mutation') are excluded — the timeline
 *  is mutations only. */
export function flattenMutations(cache: ActivityCache): MinimalEvent[] {
  const out: MinimalEvent[] = [];
  for (const dayEvents of Object.values(cache.events) as MinimalEvent[][]) {
    for (const evt of dayEvents) {
      if (evt.kind === 'mutation') {
        out.push(evt);
      }
    }
  }
  out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  return out;
}

/** Check a single event against the predicate. Returns true to keep. */
function eventMatchesPredicate(evt: MinimalEvent, p: TimelinePredicate): boolean {
  const evtMs = Date.parse(evt.timestamp);
  if (p.cursorMs !== null && evtMs >= p.cursorMs) {
    return false;
  }
  if (p.startMs !== null && evtMs < p.startMs) {
    return false;
  }
  if (p.endMs !== null && evtMs > p.endMs) {
    return false;
  }
  if (p.resourceTypes && (!evt.resourceType || !p.resourceTypes.has(evt.resourceType))) {
    return false;
  }
  if (p.eventNames && !p.eventNames.has(evt.eventName)) {
    return false;
  }
  if (p.excludeEventNames?.has(evt.eventName)) {
    return false;
  }
  if (p.origins && p.originFor && !p.origins.has(p.originFor(evt))) {
    return false;
  }
  if (p.actions && (!evt.action || !p.actions.has(evt.action))) {
    return false;
  }
  if (p.users && !p.users.has(evt.user.toLowerCase())) {
    return false;
  }
  if (p.pinnedAssetType && evt.resourceType !== p.pinnedAssetType) {
    return false;
  }
  if (p.pinnedAssetId && evt.resourceId !== p.pinnedAssetId) {
    return false;
  }
  return true;
}

/** Apply the predicate to a sorted stream, stopping once `limit + 1` matches
 *  are collected (the +1 lets the caller detect hasMore without a second
 *  query). Returns exactly `limit` events plus a hasMore flag. */
export function applyTimelinePredicate(
  sorted: MinimalEvent[],
  predicate: TimelinePredicate,
  limit: number
): { filtered: MinimalEvent[]; hasMore: boolean } {
  const matches: MinimalEvent[] = [];
  for (const evt of sorted) {
    if (!eventMatchesPredicate(evt, predicate)) {
      continue;
    }
    matches.push(evt);
    if (matches.length > limit) {
      break;
    }
  }
  const hasMore = matches.length > limit;
  const filtered = hasMore ? matches.slice(0, limit) : matches;
  return { filtered, hasMore };
}
