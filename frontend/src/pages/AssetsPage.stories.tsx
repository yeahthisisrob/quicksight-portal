import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AssetsProvider } from '@/entities/asset';
import { FoldersProvider } from '@/entities/folder';

import { AppShell } from '../../.storybook/mocks/AppShell';
import { accountRoutes } from '../../.storybook/mocks/account';
import AssetsPage from './AssetsPage';

/**
 * The asset list pages in the app shell, answered from one made-up account
 * (`.storybook/mocks/account.ts`). The lists are served the way the server
 * serves them, so the pages work: sort a column, search, open a row's
 * activity or JSON, repoint a dataset at another data source, select a few
 * stale dashboards and delete them into the archive.
 */
function AccountPage() {
  // Each mount gets its own account and its own cache, so what one story
  // changed (a deleted dashboard, a repointed dataset) never shows in another.
  const [routes] = useState(() => accountRoutes());
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell path="assets/:type" routes={routes}>
        <AssetsProvider>
          <FoldersProvider>
            <AssetsPage />
          </FoldersProvider>
        </AssetsProvider>
      </AppShell>
    </QueryClientProvider>
  );
}

const meta: Meta<typeof AssetsPage> = {
  title: 'Pages/Assets',
  component: AssetsPage,
  parameters: { layout: 'fullscreen' },
  render: () => <AccountPage />,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** /assets/dashboards - views and viewers, health, and a few dashboards nobody opens. */
export const Dashboards: Story = {
  parameters: { router: { initialEntries: ['/assets/dashboards'] } },
};

/** /assets/analyses - the working copies behind the dashboards, and the explorations. */
export const Analyses: Story = {
  parameters: { router: { initialEntries: ['/assets/analyses'] } },
};

/** /assets/datasets - SPICE and direct query, where each reads from, and its refreshes. */
export const Datasets: Story = {
  parameters: { router: { initialEntries: ['/assets/datasets'] } },
};

/** /assets/datasources - the connections the datasets read through. */
export const DataSources: Story = {
  parameters: { router: { initialEntries: ['/assets/datasources'] } },
};
