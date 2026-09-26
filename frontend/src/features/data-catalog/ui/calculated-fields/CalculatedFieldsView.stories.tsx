import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { type MockRoute, useMockApi } from '../../../../../.storybook/mocks/api';
import {
  EMPTY_CALCULATED_FIELDS,
  fieldCatalogRoutes,
  NO_EXPORT_CALCULATED_FIELDS,
} from '../__stories__/fieldCatalog';
import { catalogRoutes } from '../__stories__/routes';
import { CalculatedFieldsView } from './CalculatedFieldsView';

/**
 * The calculated fields tab drives itself from props the page keeps in the
 * URL; here a small harness holds them in state so the stories are
 * interactive: click a count tile, search, open a row.
 */
function Harness({
  routes,
  initialConflicts = false,
}: {
  routes: MockRoute[];
  initialConflicts?: boolean;
}) {
  useMockApi(routes);
  const [search, setSearch] = useState('');
  const [conflicts, setConflicts] = useState(initialConflicts);
  const [key, setKey] = useState<string | undefined>();
  return (
    <>
      <Navigate to="/data-catalog" replace />
      <CalculatedFieldsView
        projectId="proj-analytics-prod"
        search={search}
        onSearch={setSearch}
        conflictsOnly={conflicts}
        onConflictsOnly={setConflicts}
        selectedKey={key}
        onSelect={setKey}
        onOpenListing={() => {}}
      />
    </>
  );
}

const meta: Meta = {
  title: 'Features/Data Catalog/CalculatedFieldsView',
  component: CalculatedFieldsView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every calculated field in the account, one row per distinct expression, with counts that filter, search over names and expressions, and the detail beside the table once a row is chosen.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  render: () => <Harness routes={catalogRoutes()} />,
};

export const ConflictsOnly: Story = {
  name: 'Conflicts only: one name, three expressions',
  render: () => <Harness routes={catalogRoutes()} initialConflicts />,
};

export const Empty: Story = {
  render: () => (
    <Harness
      routes={catalogRoutes(fieldCatalogRoutes({ calculatedFields: EMPTY_CALCULATED_FIELDS }))}
    />
  ),
};

export const NoExportYet: Story = {
  render: () => (
    <Harness
      routes={catalogRoutes(fieldCatalogRoutes({ calculatedFields: NO_EXPORT_CALCULATED_FIELDS }))}
    />
  ),
};

export const LoadError: Story = {
  render: () => (
    <Harness
      routes={catalogRoutes([
        {
          method: 'get',
          url: /\/data-catalog\/calculated-fields$/,
          respond: () => ({
            status: 500,
            body: { success: false, error: 'The field cache could not be read' },
          }),
        },
      ])}
    />
  ),
};
