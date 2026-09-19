import { describe, expect, it } from 'vitest';

import type { TimelineEvent } from '@/shared/api/modules/activity';

import { actorDisplay, actorKey, AGENT_ORIGINS, ORIGIN_META } from '../actorDisplay';

const base = (over: Partial<TimelineEvent>): TimelineEvent =>
  ({
    id: 'e',
    timestamp: '2026-09-19T10:00:00.000Z',
    eventName: 'UpdateDashboard',
    kind: 'mutation',
    user: 'x',
    actor: { kind: 'user', label: 'x', raw: 'x' },
    origin: 'console',
    ...over,
  }) as TimelineEvent;

const PORTAL = { kind: 'portal' as const, label: 'Portal', raw: 'r/s' };

describe('actorDisplay', () => {
  it('shows the portal with the API key behind it, never the role string', () => {
    const raw = 'Stack-LambdaExecutionRole7E2A/Stack-ApiLambda1';
    const shown = actorDisplay(
      base({
        user: raw,
        actor: { kind: 'portal', label: 'Portal', raw },
        origin: 'portal-api',
        provenance: {
          actor: { kind: 'api-key', id: 'k1', label: 'claude cli' },
          channel: 'api',
          action: 'authoring.update',
          jobId: 'job-9',
          distanceMs: 1200,
        },
      })
    );
    expect(shown).toEqual({
      label: 'Portal',
      via: 'API key claude cli',
      icon: 'agent',
      tooltip: [`Portal role: ${raw}`, 'Action: authoring.update', 'Job: job-9'],
    });
  });

  it('shows the person behind a portal UI write, and a bare portal without provenance', () => {
    expect(
      actorDisplay(
        base({
          actor: PORTAL,
          origin: 'portal-ui',
          provenance: {
            actor: { kind: 'user', id: 'u1', label: 'rob@example.com' },
            channel: 'ui',
            action: 'asset.rename',
            distanceMs: 0,
          },
        })
      )
    ).toMatchObject({ label: 'Portal', via: 'rob@example.com', icon: 'portal' });
    expect(actorDisplay(base({ actor: PORTAL, origin: 'portal' }))).toEqual({
      label: 'Portal',
      icon: 'portal',
      tooltip: ['Portal role: r/s'],
    });
  });

  it('keeps the raw actor in the tooltip only when it differs from the label', () => {
    const raw = 'AWSReservedSSO_Admin_0123456789ab/rob';
    expect(actorDisplay(base({ actor: { kind: 'role', label: 'Admin / rob', raw } }))).toEqual({
      label: 'Admin / rob',
      icon: 'role',
      tooltip: [raw],
    });
    expect(actorDisplay(base({ actor: { kind: 'user', label: 'rob', raw: 'rob' } }))).toEqual({
      label: 'rob',
      icon: 'user',
      tooltip: [],
    });
    expect(actorDisplay(base({ actor: { kind: 'unknown', label: '', raw: '' } })).label).toBe(
      'Unknown'
    );
  });

  it('keys bursts by the person or key behind the portal, else by the raw actor', () => {
    const agent = base({
      actor: PORTAL,
      provenance: {
        actor: { kind: 'api-key', id: 'k1', label: 'ci' },
        channel: 'api',
        action: 'x',
        distanceMs: 0,
      },
    });
    expect(actorKey(agent)).toBe('api-key:k1');
    expect(actorKey(base({ actor: { kind: 'role', label: 'A / b', raw: 'A/b' } }))).toBe(
      'role:A/b'
    );
  });

  it('describes every origin and names the agent filter', () => {
    expect(Object.keys(ORIGIN_META)).toEqual([
      'portal-ui',
      'portal-api',
      'portal',
      'console',
      'automation',
      'unknown',
    ]);
    expect(ORIGIN_META['portal-api'].label).toBe('Agent');
    expect(AGENT_ORIGINS).toEqual(['portal-api']);
  });
});
