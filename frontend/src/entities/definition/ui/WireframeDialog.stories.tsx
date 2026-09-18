import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  gridDashboardDefinition,
  twoSheetAnalysisDefinition,
} from '../lib/__fixtures__/definitions';
import { WireframeDialog } from './WireframeDialog';

/**
 * The dialog reads `GET /assets/{type}/{id}/cached` through react-query under
 * the same key the JSON viewer uses, so each story seeds that cache instead
 * of stubbing fetch. The export wraps the definition the way the S3 file does.
 */
const asExport = (definition: unknown) => ({
  apiResponses: { definition: { data: { Definition: definition } } },
});

function withSeededCache(entries: Array<[string, string, unknown]>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const [type, id, data] of entries) {
    client.setQueryData(['asset-json', type, id], data);
  }
  return client;
}

const meta: Meta<typeof WireframeDialog> = {
  title: 'Entities/Definition/WireframeDialog',
  component: WireframeDialog,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {
  args: {
    open: true,
    onClose: () => {},
    assetId: 'dash-1',
    assetName: 'Sales Overview',
    assetType: 'dashboard',
  },
  render: (args) => (
    <QueryClientProvider
      client={withSeededCache([['dashboard', 'dash-1', asExport(gridDashboardDefinition)]])}
    >
      <WireframeDialog {...args} />
    </QueryClientProvider>
  ),
};

export const Analysis: Story = {
  args: {
    open: true,
    onClose: () => {},
    assetId: 'an-1',
    assetName: 'Sales Analysis',
    assetType: 'analysis',
  },
  render: (args) => (
    <QueryClientProvider
      client={withSeededCache([['analysis', 'an-1', asExport(twoSheetAnalysisDefinition)]])}
    >
      <WireframeDialog {...args} />
    </QueryClientProvider>
  ),
};

/** Exported without definitions: the dialog explains instead of drawing nothing. */
export const NoDefinitionCached: Story = {
  args: {
    open: true,
    onClose: () => {},
    assetId: 'dash-bare',
    assetName: 'Bare export',
    assetType: 'dashboard',
  },
  render: (args) => (
    <QueryClientProvider
      client={withSeededCache([
        ['dashboard', 'dash-bare', { apiResponses: { list: { data: { DashboardId: 'x' } } } }],
      ])}
    >
      <WireframeDialog {...args} />
    </QueryClientProvider>
  ),
};

/** Nothing seeded, so the request goes to the (absent) API and fails. */
export const LoadError: Story = {
  args: {
    open: true,
    onClose: () => {},
    assetId: 'dash-missing',
    assetName: 'Missing dashboard',
    assetType: 'dashboard',
  },
  render: (args) => (
    <QueryClientProvider client={withSeededCache([])}>
      <WireframeDialog {...args} />
    </QueryClientProvider>
  ),
};
