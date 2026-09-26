import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { type MockRoute, useMockApi } from '../../../../../.storybook/mocks/api';
import { fieldCatalogRoutes } from '../__stories__/fieldCatalog';
import { catalogRoutes } from '../__stories__/routes';
import { ColumnsView } from './ColumnsView';

function Harness({ routes }: { routes: MockRoute[] }) {
  useMockApi(routes);
  const [search, setSearch] = useState('');
  return (
    <ColumnsView
      projectId="proj-analytics-prod"
      search={search}
      onSearch={setSearch}
      onOpenField={() => {}}
      onOpenListing={() => {}}
    />
  );
}

const meta: Meta = {
  title: 'Features/Data Catalog/ColumnsView',
  component: ColumnsView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Plain columns across the selected projects, each tied to its SMUS listing column (description, glossary terms), with usage and the calculated fields that read it.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  render: () => <Harness routes={catalogRoutes()} />,
};

export const Empty: Story = {
  render: () => (
    <Harness
      routes={catalogRoutes(
        fieldCatalogRoutes({
          columns: {
            configured: true,
            exportedAt: '2026-09-18T09:30:00Z',
            counts: { columns: 0, datasets: 0, withSmus: 0, withSmusColumn: 0, outsideSmus: 0 },
            items: [],
          },
        })
      )}
    />
  ),
};
