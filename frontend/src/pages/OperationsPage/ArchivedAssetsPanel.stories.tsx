import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../.storybook/mocks/api';
import { ArchivedAssetsPanel } from './ArchivedAssetsPanel';

const now = new Date('2026-09-18T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const ITEMS = [
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

const routes = (items: typeof ITEMS, fail?: string): MockRoute[] => [
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

/** Installed during render, before the panel's first fetch. */
function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

const meta = {
  title: 'Pages/Operations/ArchivedAssetsPanel',
  component: ArchivedAssetsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Deleted assets the portal kept a copy of, with restore and JSON viewing. Shown on the Operations page under the Archived assets tab.',
      },
    },
  },
} satisfies Meta<typeof ArchivedAssetsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAssets: Story = {
  render: () => (
    <Mocked routes={routes(ITEMS)}>
      <ArchivedAssetsPanel />
    </Mocked>
  ),
};

export const Empty: Story = {
  render: () => (
    <Mocked routes={routes([])}>
      <ArchivedAssetsPanel />
    </Mocked>
  ),
};

export const LoadError: Story = {
  render: () => (
    <Mocked routes={routes([], 'The archive index could not be read')}>
      <ArchivedAssetsPanel />
    </Mocked>
  ),
};
