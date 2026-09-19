import type { MockRoute } from '../../../../.storybook/mocks/api';

const now = new Date('2026-09-18T12:00:00Z');
export const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

export const ITEMS = [
  {
    id: '3b1f7c2e-1111-4a8e-9c3d-000000000001',
    name: 'Sales overview',
    type: 'dashboard',
    createdTime: daysAgo(400),
    lastUpdatedTime: daysAgo(40),
    lastActivity: daysAgo(35),
    archivedDate: daysAgo(3),
    archiveReason: 'No views in 180 days',
    archivedBy: 'rob',
  },
  {
    id: '3b1f7c2e-2222-4a8e-9c3d-000000000002',
    name: 'Orders (silver)',
    type: 'dataset',
    createdTime: daysAgo(300),
    lastUpdatedTime: daysAgo(90),
    archivedDate: daysAgo(10),
    archiveReason: 'Replaced by orders_gold',
    archivedBy: 'rob',
  },
  {
    id: '3b1f7c2e-3333-4a8e-9c3d-000000000003',
    name: 'Legacy Athena',
    type: 'datasource',
    createdTime: daysAgo(900),
    lastUpdatedTime: daysAgo(500),
    archivedDate: daysAgo(30),
    archiveReason: 'Demo cleanup',
    archivedBy: 'script',
  },
];

export const archivedRoutes = (items: typeof ITEMS, fail?: string): MockRoute[] => [
  {
    method: 'get',
    url: '/assets/archived',
    respond: () =>
      fail
        ? { status: 500, body: { success: false, error: fail } }
        : {
            body: {
              success: true,
              data: { items, totalCount: items.length, page: 1, pageSize: 50, totalPages: 1 },
            },
          },
  },
];
