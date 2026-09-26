/**
 * Grouping for the feed: events fall under day headers, and inside a day a
 * burst - the same actor doing things to the same asset within a few
 * minutes - collapses to one row that opens to its events. Pure, so the
 * feed only renders what this returns.
 */
import type { TimelineEvent } from '@/shared/api/modules/activity';

import { actorKey } from './actorDisplay';

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const BURST_WINDOW_MINUTES = 10;

/** Events by the same actor on the same asset closer than this become one row. */
const BURST_WINDOW_MS = BURST_WINDOW_MINUTES * MS_PER_MINUTE;

export interface TimelineGroup {
  id: string;
  /** Newest first, as the feed shows them. */
  events: TimelineEvent[];
  /** The newest event; what a collapsed row describes. */
  lead: TimelineEvent;
  /** Oldest and newest timestamps in the burst. */
  from: string;
  to: string;
  /** Distinct action categories in the burst, in first-seen order. */
  actions: string[];
}

export interface TimelineDay {
  /** YYYY-MM-DD in the viewer's timezone. */
  key: string;
  label: string;
  groups: TimelineGroup[];
  eventCount: number;
}

const TWO_DIGITS = 10;

function pad(n: number): string {
  return n < TWO_DIGITS ? `0${n}` : String(n);
}

/** Local calendar day of a timestamp. */
export function dayKeyOf(timestamp: string): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Today", "Yesterday", then a readable date; the year only when it differs. */
export function dayLabel(key: string, now: Date = new Date()): string {
  const todayKey = dayKeyOf(now.toISOString());
  if (key === todayKey) {
    return 'Today';
  }
  const yesterday = new Date(now.getTime() - MS_PER_DAY);
  if (key === dayKeyOf(yesterday.toISOString())) {
    return 'Yesterday';
  }
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const sameYear = y === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** What a burst is "about": the asset, or the event name when there is none. */
function subjectKey(event: TimelineEvent): string {
  return event.assetId
    ? `${event.assetType ?? event.resourceType ?? ''}:${event.assetId}`
    : `event:${event.eventName}`;
}

function sameBurst(previous: TimelineEvent, next: TimelineEvent): boolean {
  if (actorKey(previous) !== actorKey(next) || subjectKey(previous) !== subjectKey(next)) {
    return false;
  }
  return Math.abs(Date.parse(previous.timestamp) - Date.parse(next.timestamp)) <= BURST_WINDOW_MS;
}

function toGroup(events: TimelineEvent[]): TimelineGroup {
  const lead = events[0]!;
  const actions: string[] = [];
  for (const e of events) {
    const a = e.action ?? e.eventName;
    if (!actions.includes(a)) {
      actions.push(a);
    }
  }
  return {
    id: events.length === 1 ? lead.id : `${lead.id}+${events.length}`,
    events,
    lead,
    from: events[events.length - 1]!.timestamp,
    to: lead.timestamp,
    actions,
  };
}

/**
 * Group newest-first events into days and bursts. A burst never crosses a
 * day boundary, so a collapsed row always sits under one header.
 */
export function groupTimeline(events: TimelineEvent[], now: Date = new Date()): TimelineDay[] {
  const days: TimelineDay[] = [];
  let day: TimelineDay | null = null;
  let burst: TimelineEvent[] = [];

  const flushBurst = () => {
    if (burst.length > 0 && day) {
      day.groups.push(toGroup(burst));
    }
    burst = [];
  };

  for (const event of events) {
    const key = dayKeyOf(event.timestamp);
    if (!day || day.key !== key) {
      flushBurst();
      day = { key, label: dayLabel(key, now), groups: [], eventCount: 0 };
      days.push(day);
    }
    day.eventCount += 1;
    const previous = burst[burst.length - 1];
    if (previous && sameBurst(previous, event)) {
      burst.push(event);
    } else {
      flushBurst();
      burst = [event];
    }
  }
  flushBurst();
  return days;
}

/** "10:02–10:09" for a burst, "10:02" for one event. */
export function timeSpan(group: TimelineGroup): string {
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (group.events.length === 1) {
    return time(group.to);
  }
  const from = time(group.from);
  const to = time(group.to);
  return from === to ? from : `${from}–${to}`;
}
