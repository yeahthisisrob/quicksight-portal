import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  SMUS_SETTINGS_NO_PROJECTS,
  SMUS_SETTINGS_NOT_CONFIGURED,
} from '@/features/author/ui/__stories__/fixtures';
import { KEYS } from '@/features/data-catalog/ui/__stories__/fieldCatalog';
import { catalogRoutes } from '@/features/data-catalog/ui/__stories__/routes';

import { AppShell } from '../../.storybook/mocks/AppShell';
import DataCatalogPage from './DataCatalogPage';

/**
 * The catalog in the app shell, API stubbed. Field-first: calculated fields
 * open by default, columns and the per-project SMUS assets as tabs.
 */
const meta: Meta<typeof DataCatalogPage> = {
  title: 'Pages/Data Catalog',
  component: DataCatalogPage,
  parameters: {
    layout: 'fullscreen',
    router: { initialEntries: ['/data-catalog?project=proj-analytics-prod'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const CalculatedFields: Story = {
  name: 'Calculated fields (default tab)',
  render: () => (
    <AppShell path="data-catalog" routes={catalogRoutes()}>
      <DataCatalogPage />
    </AppShell>
  ),
};

export const CalculatedFieldOpen: Story = {
  name: 'Calculated field open, from a search hit',
  parameters: {
    router: {
      initialEntries: [
        `/data-catalog?project=proj-analytics-prod&tab=calculated-fields&field=${KEYS.margin}`,
      ],
    },
  },
  render: () => (
    <AppShell path="data-catalog" routes={catalogRoutes()}>
      <DataCatalogPage />
    </AppShell>
  ),
};

export const Conflicts: Story = {
  name: 'Conflicts only',
  parameters: {
    router: { initialEntries: ['/data-catalog?project=proj-analytics-prod&conflicts=1'] },
  },
  render: () => (
    <AppShell path="data-catalog" routes={catalogRoutes()}>
      <DataCatalogPage />
    </AppShell>
  ),
};

export const Columns: Story = {
  parameters: {
    router: { initialEntries: ['/data-catalog?project=proj-analytics-prod&tab=columns'] },
  },
  render: () => (
    <AppShell path="data-catalog" routes={catalogRoutes()}>
      <DataCatalogPage />
    </AppShell>
  ),
};

export const SmusAssets: Story = {
  name: 'SMUS assets tab: one asset open',
  parameters: {
    router: {
      initialEntries: ['/data-catalog?project=proj-analytics-prod&tab=smus&asset=lst-sales-gold'],
    },
  },
  render: () => (
    <AppShell path="data-catalog" routes={catalogRoutes()}>
      <DataCatalogPage />
    </AppShell>
  ),
};

export const NotConfigured: Story = {
  name: 'Gated: SMUS not configured',
  parameters: { router: { initialEntries: ['/data-catalog'] } },
  render: () => (
    <AppShell
      path="data-catalog"
      routes={catalogRoutes([
        SMUS_SETTINGS_NOT_CONFIGURED,
        {
          method: 'get',
          url: /\/data-catalog\/smus$/,
          respond: () => ({
            body: {
              success: true,
              data: {
                configured: false,
                exportedAt: null,
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

export const NoProjectsSelected: Story = {
  name: 'Gated: no projects selected',
  parameters: { router: { initialEntries: ['/data-catalog'] } },
  render: () => (
    <AppShell path="data-catalog" routes={catalogRoutes([SMUS_SETTINGS_NO_PROJECTS])}>
      <DataCatalogPage />
    </AppShell>
  ),
};
