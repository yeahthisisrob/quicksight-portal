/**
 * A realistic few days of activity for the timeline stories: an agent's
 * burst through the API, a person through the portal UI, people in the
 * console, an AWS service, and older days. Plus a mock of the timeline
 * endpoints that pages, filters and paginates the way the API does.
 */
import { subDays, subHours, subMinutes } from 'date-fns';

import type { TimelineEvent } from '@/shared/api/modules/activity';

import type { MockRoute } from '../../../../../.storybook/mocks/api';

const NOW = new Date();

const PORTAL_RAW =
  'QuicksightPortalStack-LambdaExecutionRole7E2A/QuicksightPortalStack-ApiLambda1A2B';
const PORTAL = { kind: 'portal' as const, label: 'Portal', raw: PORTAL_RAW };

const AGENT = {
  actor: { kind: 'api-key' as const, id: 'k-cli', label: 'claude cli' },
  channel: 'api' as const,
};
const ROB = {
  actor: { kind: 'user' as const, id: 'u-rob', label: 'rob@example.com' },
  channel: 'ui' as const,
};

let counter = 0;
function event(over: Partial<TimelineEvent> & Pick<TimelineEvent, 'timestamp'>): TimelineEvent {
  counter += 1;
  return {
    id: `evt-${counter}`,
    eventName: 'UpdateDashboard',
    kind: 'mutation',
    action: 'update',
    user: 'rob',
    actor: { kind: 'user', label: 'rob', raw: 'rob' },
    origin: 'console',
    resourceType: 'dashboard',
    assetType: 'dashboard',
    assetId: 'sales-overview',
    assetName: 'Sales overview',
    ...over,
  } as TimelineEvent;
}

const minutesAgo = (m: number) => subMinutes(NOW, m).toISOString();
const hoursAgo = (h: number) => subHours(NOW, h).toISOString();
const daysAgo = (d: number, h = 0) => subHours(subDays(NOW, d), h).toISOString();

/** Newest first, as the API returns them. */
export const TIMELINE_EVENTS: TimelineEvent[] = [
  // An agent repairing and republishing Sales overview through the API: one burst.
  event({
    timestamp: minutesAgo(12),
    eventName: 'UpdateDashboardPublishedVersion',
    action: 'publish',
    user: PORTAL_RAW,
    actor: PORTAL,
    origin: 'portal-api',
    provenance: { ...AGENT, action: 'authoring.update', jobId: undefined, distanceMs: 800 },
  }),
  event({
    timestamp: minutesAgo(13),
    user: PORTAL_RAW,
    actor: PORTAL,
    origin: 'portal-api',
    provenance: { ...AGENT, action: 'authoring.update', distanceMs: 2400 },
  }),
  event({
    timestamp: minutesAgo(15),
    eventName: 'TagResource',
    action: 'tag',
    user: PORTAL_RAW,
    actor: PORTAL,
    origin: 'portal-api',
    provenance: { ...AGENT, action: 'authoring.update', distanceMs: 4100 },
  }),
  // Rob renaming a dataset in the portal UI.
  event({
    timestamp: minutesAgo(48),
    eventName: 'UpdateDataSet',
    resourceType: 'dataset',
    assetType: 'dataset',
    assetId: 'orders-gold',
    assetName: 'orders_gold',
    user: PORTAL_RAW,
    actor: PORTAL,
    origin: 'portal-ui',
    provenance: { ...ROB, action: 'asset.rename', distanceMs: 300 },
  }),
  // A portal write the audit log does not know about.
  event({
    timestamp: hoursAgo(2),
    eventName: 'UpdateFolder',
    resourceType: 'folder',
    assetType: 'folder',
    assetId: 'f-sales',
    assetName: 'Sales',
    user: PORTAL_RAW,
    actor: PORTAL,
    origin: 'portal',
  }),
  // A person through an SSO role in the console, three edits to one analysis.
  event({
    timestamp: hoursAgo(3),
    eventName: 'UpdateAnalysis',
    resourceType: 'analysis',
    assetType: 'analysis',
    assetId: 'a-draft',
    assetName: 'Sales draft (Q4)',
    user: 'AWSReservedSSO_AdministratorAccess_0123456789abcdef/ann@example.com',
    actor: {
      kind: 'role',
      label: 'AdministratorAccess / ann@example.com',
      raw: 'AWSReservedSSO_AdministratorAccess_0123456789abcdef/ann@example.com',
    },
    origin: 'console',
  }),
  event({
    timestamp: subMinutes(subHours(NOW, 3), 4).toISOString(),
    eventName: 'UpdateAnalysis',
    resourceType: 'analysis',
    assetType: 'analysis',
    assetId: 'a-draft',
    assetName: 'Sales draft (Q4)',
    user: 'AWSReservedSSO_AdministratorAccess_0123456789abcdef/ann@example.com',
    actor: {
      kind: 'role',
      label: 'AdministratorAccess / ann@example.com',
      raw: 'AWSReservedSSO_AdministratorAccess_0123456789abcdef/ann@example.com',
    },
    origin: 'console',
  }),
  event({
    timestamp: subMinutes(subHours(NOW, 3), 7).toISOString(),
    eventName: 'CreateAnalysis',
    action: 'create',
    resourceType: 'analysis',
    assetType: 'analysis',
    assetId: 'a-draft',
    assetName: 'Sales draft (Q4)',
    user: 'AWSReservedSSO_AdministratorAccess_0123456789abcdef/ann@example.com',
    actor: {
      kind: 'role',
      label: 'AdministratorAccess / ann@example.com',
      raw: 'AWSReservedSSO_AdministratorAccess_0123456789abcdef/ann@example.com',
    },
    origin: 'console',
  }),
  // A QuickSight user granting permissions.
  event({
    timestamp: hoursAgo(5),
    eventName: 'UpdateDataSetPermissions',
    action: 'grant',
    resourceType: 'dataset',
    assetType: 'dataset',
    assetId: 'customer-pii',
    assetName: 'Customer PII',
    user: 'bob',
    actor: { kind: 'user', label: 'bob', raw: 'bob' },
    origin: 'console',
  }),
  // Yesterday.
  event({
    timestamp: daysAgo(1, 2),
    eventName: 'DeleteDashboard',
    action: 'delete',
    assetId: 'legacy-kpis',
    assetName: 'Legacy KPIs',
    user: PORTAL_RAW,
    actor: PORTAL,
    origin: 'portal-ui',
    provenance: { ...ROB, action: 'asset.delete', distanceMs: 150 },
  }),
  event({
    timestamp: daysAgo(1, 6),
    eventName: 'CreateDashboard',
    action: 'create',
    assetId: 'ops-daily',
    assetName: 'Ops daily',
    user: 'bob',
    actor: { kind: 'user', label: 'bob', raw: 'bob' },
    origin: 'console',
  }),
  event({
    timestamp: daysAgo(1, 9),
    eventName: 'UpdateAccountSettings',
    resourceType: 'other',
    assetType: undefined,
    assetId: undefined,
    assetName: undefined,
    user: 'quicksight.amazonaws.com',
    actor: { kind: 'service', label: 'quicksight', raw: 'quicksight.amazonaws.com' },
    origin: 'automation',
  }),
  // Three days ago.
  event({
    timestamp: daysAgo(3, 1),
    eventName: 'CreateGroupMembership',
    action: 'member',
    resourceType: 'group',
    assetType: 'group',
    assetId: 'finance-readers',
    assetName: 'finance-readers',
    user: 'rob',
    actor: { kind: 'user', label: 'rob', raw: 'rob' },
    origin: 'console',
  }),
];

export const CACHE_LAST_UPDATED = minutesAgo(9);

const DEFAULT_LIMIT = 50;

/** Mocks GET /activity/timeline and /activity/timeline/{type}/{id}: filtering, paging, pinning. */
export function timelineRoutes(
  events: TimelineEvent[] = TIMELINE_EVENTS,
  overrides: MockRoute[] = []
): MockRoute[] {
  return [
    ...overrides,
    {
      method: 'get',
      url: /\/activity\/timeline/,
      respond: (config) => {
        const params = (config.params ?? {}) as Record<string, string | undefined>;
        const pin = /\/activity\/timeline\/([^/]+)\/([^/?]+)/.exec(config.url ?? '');
        const list = (v: string | undefined) => (v ? v.split(',') : null);
        const origins = list(params.origins);
        const actions = list(params.actions);
        const resourceTypes = list(params.resourceTypes);
        const exclude = list(params.excludeEventNames);
        const limit = Number(params.limit ?? DEFAULT_LIMIT);

        let matched = events.filter((e) => {
          if (pin && (e.assetType !== pin[1] || e.assetId !== decodeURIComponent(pin[2]!)))
            return false;
          if (origins && !origins.includes(e.origin)) return false;
          if (actions && (!e.action || !actions.includes(e.action))) return false;
          if (resourceTypes && (!e.resourceType || !resourceTypes.includes(e.resourceType)))
            return false;
          if (exclude?.includes(e.eventName)) return false;
          if (params.startDate && e.timestamp < params.startDate) return false;
          if (params.cursor && e.timestamp >= params.cursor) return false;
          return true;
        });
        const hasMore = matched.length > limit;
        matched = matched.slice(0, limit);
        return {
          body: {
            success: true,
            data: {
              items: matched,
              nextCursor: hasMore ? matched[matched.length - 1]!.timestamp : null,
              hasMore,
              cacheLastUpdated: CACHE_LAST_UPDATED,
            },
          },
        };
      },
    },
    {
      method: 'post',
      url: '/activity/refresh',
      respond: () => ({
        status: 202,
        body: { success: true, data: { jobId: 'activity-refresh-1', status: 'queued' } },
      }),
    },
  ];
}
