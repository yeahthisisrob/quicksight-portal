import type { MockRoute } from '../../../../.storybook/mocks/api';

const now = new Date('2026-09-18T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

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
    archivedBy: 'rob@example.com',
    archivedByPerson: {
      label: 'rob@example.com',
      kind: 'person',
      email: 'rob@example.com',
      quickSightUserName: 'rob',
    },
    restorations: [
      {
        restoredAt: daysAgo(1),
        restoredBy: 'ann@example.com',
        restoredAs: 'sales-overview-restored',
        restoredByPerson: { label: 'ann@example.com', kind: 'person', email: 'ann@example.com' },
      },
    ],
  },
  {
    id: '3b1f7c2e-2222-4a8e-9c3d-000000000002',
    name: 'Orders (silver)',
    type: 'dataset',
    createdTime: daysAgo(300),
    lastUpdatedTime: daysAgo(90),
    archivedDate: daysAgo(10),
    archiveReason: 'Replaced by orders_gold',
    archivedBy: '9f8e7d6c-1234-4abc-8def-0123456789ab',
    archivedByPerson: { label: 'Ann Lee', kind: 'person' },
  },
  {
    id: '3b1f7c2e-3333-4a8e-9c3d-000000000003',
    name: 'Legacy Athena',
    type: 'datasource',
    createdTime: daysAgo(900),
    lastUpdatedTime: daysAgo(500),
    archivedDate: daysAgo(30),
    archiveReason: 'Demo cleanup',
    archivedBy: 'cleanup (API key)',
    archivedByPerson: { label: 'cleanup (API key)', kind: 'api-key' },
  },
  {
    id: 'finance',
    name: 'Finance',
    type: 'folder',
    createdTime: daysAgo(700),
    lastUpdatedTime: daysAgo(60),
    archivedDate: daysAgo(45),
    archiveReason: 'Merged into Reporting',
    archivedBy: 'system',
    archivedByPerson: { label: 'The portal', kind: 'portal' },
  },
];

export const archivedRoutes = (items: unknown[], fail?: string): MockRoute[] => [
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
