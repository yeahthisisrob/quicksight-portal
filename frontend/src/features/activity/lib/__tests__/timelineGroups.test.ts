import { describe, expect, it } from 'vitest';

import type { TimelineEvent } from '@/shared/api/modules/activity';

import { dayKeyOf, dayLabel, groupTimeline, timeSpan } from '../timelineGroups';

const NOW = new Date('2026-09-19T15:00:00.000Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const at = (iso: string, over: Partial<TimelineEvent> = {}): TimelineEvent =>
  ({
    id: `e-${iso}-${over.assetId ?? ''}-${over.user ?? 'rob'}`,
    timestamp: iso,
    eventName: 'UpdateDashboard',
    kind: 'mutation',
    action: 'update',
    user: 'rob',
    actor: { kind: 'user', label: 'rob', raw: 'rob' },
    origin: 'console',
    resourceType: 'dashboard',
    assetType: 'dashboard',
    assetId: 'd-1',
    assetName: 'Sales',
    ...over,
  }) as TimelineEvent;

const other = (iso: string, eventName: string): TimelineEvent =>
  at(iso, { assetId: undefined, assetType: undefined, resourceType: 'other', eventName });

describe('dayKeyOf and dayLabel', () => {
  it('labels today and yesterday by name, other days by date', () => {
    const today = dayKeyOf(NOW.toISOString());
    expect(dayLabel(today, NOW)).toBe('Today');
    const yesterday = dayKeyOf(new Date(NOW.getTime() - ONE_DAY_MS).toISOString());
    expect(dayLabel(yesterday, NOW)).toBe('Yesterday');
    expect(dayLabel('2026-09-01', NOW)).toMatch(/September 1/);
    expect(dayLabel('2025-12-25', NOW)).toMatch(/2025/);
  });
});

describe('groupTimeline', () => {
  it('collapses a burst by the same actor on the same asset within ten minutes', () => {
    const events = [
      at('2026-09-19T10:09:00.000Z'),
      at('2026-09-19T10:05:00.000Z'),
      at('2026-09-19T10:02:00.000Z', {
        action: 'publish',
        eventName: 'UpdateDashboardPublishedVersion',
      }),
      at('2026-09-19T09:30:00.000Z'),
    ];
    const [today] = groupTimeline(events, NOW);
    expect(today!.label).toBe('Today');
    expect(today!.eventCount).toBe(4);
    expect(today!.groups.map((g) => g.events.length)).toEqual([3, 1]);
    const burst = today!.groups[0]!;
    expect(burst.lead.timestamp).toBe('2026-09-19T10:09:00.000Z');
    expect(burst.from).toBe('2026-09-19T10:02:00.000Z');
    expect(burst.actions).toEqual(['update', 'publish']);
    expect(burst.id).toContain('+3');
  });

  it('does not merge different actors, different assets, or across a day boundary', () => {
    const events = [
      at('2026-09-19T10:01:00.000Z'),
      at('2026-09-19T10:00:30.000Z', {
        user: 'ann',
        actor: { kind: 'user', label: 'ann', raw: 'ann' },
      }),
      at('2026-09-19T10:00:00.000Z', { assetId: 'd-2', assetName: 'Ops' }),
      at('2026-09-18T23:59:00.000Z'),
      at('2026-09-18T23:55:00.000Z'),
    ];
    const days = groupTimeline(events, NOW);
    expect(days.map((d) => d.groups.length)).toEqual([3, 1]);
    expect(days[1]!.groups[0]!.events).toHaveLength(2);
  });

  it('groups portal events by the person or key behind them', () => {
    const provenance = (label: string, kind: 'user' | 'api-key') => ({
      actor: { kind, id: label, label },
      channel: kind === 'api-key' ? ('api' as const) : ('ui' as const),
      action: 'authoring.update',
      distanceMs: 0,
    });
    const portal = { kind: 'portal' as const, label: 'Portal', raw: 'r/s' };
    const events = [
      at('2026-09-19T10:03:00.000Z', {
        actor: portal,
        origin: 'portal-api',
        provenance: provenance('ci', 'api-key'),
      }),
      at('2026-09-19T10:02:00.000Z', {
        actor: portal,
        origin: 'portal-api',
        provenance: provenance('ci', 'api-key'),
      }),
      at('2026-09-19T10:01:00.000Z', {
        actor: portal,
        origin: 'portal-ui',
        provenance: provenance('rob', 'user'),
      }),
    ];
    const [today] = groupTimeline(events, NOW);
    expect(today!.groups.map((g) => g.events.length)).toEqual([2, 1]);
  });

  it('treats events without an asset as bursts by event name', () => {
    const events = [
      other('2026-09-19T10:01:00.000Z', 'UpdateAccountSettings'),
      other('2026-09-19T10:00:00.000Z', 'UpdateAccountSettings'),
      other('2026-09-19T09:59:00.000Z', 'CreateTheme'),
    ];
    expect(groupTimeline(events, NOW)[0]!.groups.map((g) => g.events.length)).toEqual([2, 1]);
  });

  it('formats a time span', () => {
    const [today] = groupTimeline(
      [at('2026-09-19T10:09:00.000Z'), at('2026-09-19T10:02:00.000Z')],
      NOW
    );
    const span = timeSpan(today!.groups[0]!);
    expect(span).toContain('–');
    expect(span.split('–')).toHaveLength(2);
    const [single] = groupTimeline([at('2026-09-19T10:09:00.000Z')], NOW);
    expect(timeSpan(single!.groups[0]!)).not.toContain('–');
    expect(timeSpan(single!.groups[0]!)).toMatch(/\d{1,2}:\d{2}/);
  });
});
