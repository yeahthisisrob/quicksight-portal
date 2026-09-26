import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { type MockRoute, useMockApi } from '../../../../.storybook/mocks/api';
import { gridDashboardDefinition } from '../lib/__fixtures__/definitions';
import { WireframeDialog } from './WireframeDialog';

/**
 * The dialog reads `GET /assets/{type}/{id}/cached` (and, for a dashboard,
 * its insights) through react-query under the keys the JSON viewer and the
 * Author page use, so stories seed that cache. Anything not seeded goes to
 * the stubbed API, which answers from `parameters.apiRoutes` or fails.
 * The wireframe itself is covered by the DefinitionWireframe stories.
 */
const asExport = (definition: unknown) => ({
  apiResponses: { definition: { data: { Definition: definition } } },
});

function Seeded({
  entries,
  routes,
  children,
}: {
  entries: Array<[unknown[], unknown]>;
  routes: MockRoute[];
  children: React.ReactNode;
}) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    for (const [key, data] of entries) {
      c.setQueryData(key, data);
    }
    return c;
  });
  // Installed during render so the dialog's first request already sees it.
  useMockApi(routes);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const meta = {
  title: 'Entities/Definition/WireframeDialog',
  component: WireframeDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onClose: () => {},
    assetId: 'dash-1',
    assetName: 'Sales Overview',
    assetType: 'dashboard',
  },
  decorators: [
    (Story, { parameters }) => (
      <Seeded entries={parameters.seed ?? []} routes={parameters.apiRoutes ?? []}>
        <Story />
      </Seeded>
    ),
  ],
} satisfies Meta<typeof WireframeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A dashboard with CloudWatch metrics: every visual shows its p90 load time. */
export const DashboardWithLoadTimes: Story = {
  parameters: {
    seed: [
      [['asset-json', 'dashboard', 'dash-1'], asExport(gridDashboardDefinition)],
      [
        ['asset-insights', 'dashboard', 'dash-1'],
        {
          assetType: 'dashboard',
          assetId: 'dash-1',
          views: { total: 1840, last30d: 310, uniqueViewers: 62 },
          health: {
            windowDays: 14,
            viewLoads: 412,
            viewLoadTimeP90Ms: 2100,
            visuals: [
              {
                sheetId: 'sheet-overview',
                visualId: 'table-detail',
                loadTimeP90Ms: 4800,
                errors: 0,
              },
              { sheetId: 'sheet-overview', visualId: 'line-trend', loadTimeP90Ms: 900, errors: 7 },
              { sheetId: 'sheet-overview', visualId: 'bar-region', loadTimeP90Ms: 1200, errors: 0 },
              { sheetId: 'sheet-overview', visualId: 'kpi-revenue', loadTimeP90Ms: 300, errors: 0 },
            ],
          },
        },
      ],
    ],
  },
};

/** Exported without definitions: the dialog explains instead of drawing nothing. */
export const NoDefinitionCached: Story = {
  args: { assetId: 'dash-bare', assetName: 'Bare export', assetType: 'analysis' },
  parameters: {
    seed: [[['asset-json', 'analysis', 'dash-bare'], { apiResponses: { list: { data: {} } } }]],
  },
};

/** The cached export cannot be read. */
export const LoadError: Story = {
  args: { assetId: 'dash-missing', assetName: 'Missing dashboard' },
  parameters: {
    apiRoutes: [
      {
        method: 'get',
        url: '/cached',
        respond: () => ({
          status: 404,
          body: { success: false, error: 'No cached export for this dashboard' },
        }),
      },
    ] satisfies MockRoute[],
  },
};
