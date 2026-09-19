import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ActivityService } from '../ActivityService';

const PORTAL_USER =
  'QuicksightPortalStack-LambdaExecutionRole7E2A/QuicksightPortalStack-ApiLambda1A2B';

const cache = {
  version: '1',
  lastUpdated: '2026-09-19T12:00:00.000Z',
  dateRange: { start: '2026-09-01', end: '2026-09-19' },
  events: {
    '2026-09-19': [
      {
        timestamp: '2026-09-19T10:00:04.000Z',
        eventName: 'UpdateDashboard',
        user: PORTAL_USER,
        resourceId: 'd-1',
        name: 'Sales',
        kind: 'mutation',
        action: 'update',
        resourceType: 'dashboard',
      },
      {
        timestamp: '2026-09-19T09:00:00.000Z',
        eventName: 'UpdateAnalysis',
        user: 'AWSReservedSSO_Admin_0123456789abcdef/rob@example.com',
        resourceId: 'a-1',
        name: 'Draft',
        kind: 'mutation',
        action: 'update',
        resourceType: 'analysis',
      },
      {
        timestamp: '2026-09-19T08:00:00.000Z',
        eventName: 'UpdateDashboard',
        user: PORTAL_USER,
        resourceId: 'd-9',
        name: 'Orphan',
        kind: 'mutation',
        action: 'update',
        resourceType: 'dashboard',
      },
    ],
  },
};

describe('ActivityService timeline provenance', () => {
  const cacheService = { getActivityCache: vi.fn(), getCacheEntries: vi.fn() };
  const audit = { list: vi.fn() };
  const service = () =>
    new ActivityService(cacheService as any, {} as any, undefined, audit as any, {
      functionNames: ['QuicksightPortalStack-ApiLambda1A2B'],
      stackPrefix: 'QuicksightPortalStack',
    });

  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.getActivityCache.mockResolvedValue(cache);
    cacheService.getCacheEntries.mockResolvedValue([]);
    audit.list.mockResolvedValue([
      {
        id: 'r1',
        at: '2026-09-19T10:00:00.000Z',
        actor: { kind: 'api-key', id: 'k1', label: 'claude cli' },
        channel: 'api',
        action: 'authoring.update',
        assetType: 'dashboard',
        assetId: 'd-1',
      },
    ]);
  });

  it("names the portal, attributes its write to the API key, and leaves people's console changes alone", async () => {
    const page = await service().getTimelinePage({});
    const [portalHit, person, orphan] = page.items;

    expect(portalHit).toMatchObject({
      actor: { kind: 'portal', label: 'Portal' },
      origin: 'portal-api',
      provenance: {
        actor: { label: 'claude cli' },
        channel: 'api',
        action: 'authoring.update',
        distanceMs: 4000,
      },
    });
    expect(person).toMatchObject({
      actor: { kind: 'role', label: 'Admin / rob@example.com' },
      origin: 'console',
    });
    expect(person!.provenance).toBeUndefined();
    expect(orphan).toMatchObject({ actor: { kind: 'portal' }, origin: 'portal' });
  });

  it('filters by origin', async () => {
    const agents = await service().getTimelinePage({ origins: ['portal-api'] });
    expect(agents.items.map((i) => i.assetId)).toEqual(['d-1']);
    const console = await service().getTimelinePage({ origins: ['console'] });
    expect(console.items.map((i) => i.assetId)).toEqual(['a-1']);
  });

  it('keeps working when the audit log cannot be read', async () => {
    audit.list.mockRejectedValue(new Error('no table'));
    const page = await service().getTimelinePage({});
    expect(page.items[0]).toMatchObject({ actor: { kind: 'portal' }, origin: 'portal' });
  });
});
