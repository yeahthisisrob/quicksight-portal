import type { Meta, StoryObj } from '@storybook/react-vite';

import { catalogRoutes } from '@/features/data-catalog/ui/__stories__/routes';

import { AppShell } from '../../.storybook/mocks/AppShell';
import DataCatalogPage from './DataCatalogPage';

/** The catalog in the app shell, API stubbed: one project, one asset open. */
const meta: Meta<typeof DataCatalogPage> = {
  title: 'Pages/Data Catalog',
  component: DataCatalogPage,
  parameters: {
    layout: 'fullscreen',
    router: { initialEntries: ['/data-catalog?project=proj-analytics-prod&asset=lst-sales-gold'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AppShell path="data-catalog" routes={catalogRoutes()}>
      <DataCatalogPage />
    </AppShell>
  ),
};

export const NotConfigured: Story = {
  parameters: { router: { initialEntries: ['/data-catalog'] } },
  render: () => (
    <AppShell
      path="data-catalog"
      routes={catalogRoutes([
        {
          method: 'get',
          url: /\/data-catalog\/smus$/,
          respond: () => ({
            body: {
              success: true,
              data: {
                configured: false,
                projectFilter: [],
                projects: [],
                glossaryTerms: [],
                assets: [],
              },
            },
          }),
        },
      ])}
    >
      <DataCatalogPage />
    </AppShell>
  ),
};
