import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import { createAssetColumns } from '../lib/createAssetColumns';
import EnhancedAssetTable from './EnhancedAssetTable';

/**
 * The Dashboards and Datasets lists with the health columns fed by
 * QuickSight's CloudWatch metrics: one batched read for the page, shown as
 * views / p90 load time / visual errors (dashboards) or refreshes / p90
 * ingestion latency / error rows (datasets).
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const DASHBOARDS = [
  {
    id: 'd-sales',
    name: 'Sales overview',
    status: 'active',
    createdTime: daysAgo(400),
    lastUpdatedTime: daysAgo(3),
    activity: { totalViews: 1240, uniqueViewers: 88, lastViewedAt: daysAgo(0) },
    tags: [],
  },
  {
    id: 'd-ops',
    name: 'Ops daily',
    status: 'active',
    createdTime: daysAgo(200),
    lastUpdatedTime: daysAgo(1),
    activity: { totalViews: 310, uniqueViewers: 22, lastViewedAt: daysAgo(1) },
    tags: [],
  },
  {
    id: 'd-legacy',
    name: 'Legacy finance',
    status: 'active',
    createdTime: daysAgo(900),
    lastUpdatedTime: daysAgo(300),
    activity: { totalViews: 4, uniqueViewers: 1, lastViewedAt: daysAgo(120) },
    tags: [],
  },
  {
    id: 'd-new',
    name: 'Brand new',
    status: 'active',
    createdTime: daysAgo(1),
    lastUpdatedTime: daysAgo(1),
    activity: { totalViews: 0, uniqueViewers: 0 },
    tags: [],
  },
];

const DATASETS = [
  {
    id: 'ds-orders',
    name: 'Orders (gold)',
    status: 'active',
    importMode: 'SPICE',
    fieldCount: 24,
    createdTime: daysAgo(300),
    lastUpdatedTime: daysAgo(1),
    tags: [],
  },
  {
    id: 'ds-cust',
    name: 'Customers',
    status: 'active',
    importMode: 'DIRECT_QUERY',
    fieldCount: 12,
    createdTime: daysAgo(500),
    lastUpdatedTime: daysAgo(10),
    tags: [],
  },
];

const HEALTH: Record<string, unknown[]> = {
  dashboard: [
    { id: 'd-sales', viewLoads: 980, viewLoadTimeP90Ms: 1400, visualErrors: 0 },
    { id: 'd-ops', viewLoads: 260, viewLoadTimeP90Ms: 3800, visualErrors: 2 },
    { id: 'd-legacy', viewLoads: 3, viewLoadTimeP90Ms: 9200, visualErrors: 17 },
    { id: 'd-new' },
  ],
  dataset: [
    { id: 'ds-orders', ingestionRuns: 30, ingestionLatencyP90Ms: 42000, ingestionErrorRows: 0 },
    { id: 'ds-cust', ingestionRuns: 4, ingestionLatencyP90Ms: 1900, ingestionErrorRows: 128 },
  ],
};

const healthRoutes = (available = true): MockRoute[] => [
  {
    method: 'get',
    url: '/activity/health',
    respond: (config) => {
      const assetType = String(config.params?.assetType);
      return {
        body: {
          success: true,
          data: { assetType, windowDays: 30, available, items: available ? HEALTH[assetType] : [] },
        },
      };
    },
  },
];

function Table({
  assetType,
  rows,
  routes,
}: {
  assetType: 'dashboard' | 'dataset';
  rows: any[];
  routes: MockRoute[];
}) {
  const [restore] = useState(() => mockApi(routes));
  useEffect(() => restore, [restore]);
  const navigate = useNavigate();
  const columns = createAssetColumns(assetType, navigate, {});
  return (
    <EnhancedAssetTable
      assetType={assetType}
      title={assetType === 'dashboard' ? 'Dashboards' : 'Datasets'}
      assets={rows}
      loading={false}
      totalRows={rows.length}
      columns={columns}
      onFetchAssets={async () => {}}
    />
  );
}

const meta: Meta<typeof Table> = {
  title: 'Widgets/AssetTable/Health columns',
  component: Table,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboards: Story = {
  render: () => <Table assetType="dashboard" rows={DASHBOARDS} routes={healthRoutes()} />,
};

export const Datasets: Story = {
  render: () => <Table assetType="dataset" rows={DATASETS} routes={healthRoutes()} />,
};

export const NoMetricsInAccount: Story = {
  render: () => <Table assetType="dashboard" rows={DASHBOARDS} routes={healthRoutes(false)} />,
};
