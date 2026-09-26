import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { useEffect, useState } from 'react';

import { mockApi } from '../../../../.storybook/mocks/api';
import DatasetSourceDialog from './DatasetSourceDialog';

/**
 * The dialog reads its content from `GET /assets/dataset/{id}/source` on open,
 * so each story stubs that call. The data source list is what the picker
 * offers - ARNs are never typed, here or in the app.
 */
const SOURCE_A = 'arn:aws:quicksight:us-east-1:1:datasource/athena-prod';
const SOURCE_B = 'arn:aws:quicksight:us-east-1:1:datasource/redshift-warehouse';

const DATA_SOURCES = [
  { id: 'athena-prod', name: 'Athena (prod)', arn: SOURCE_A, type: 'ATHENA' },
  { id: 'redshift-warehouse', name: 'Redshift warehouse', arn: SOURCE_B, type: 'REDSHIFT' },
];

const RELATIONAL_TABLE = {
  id: 't-orders',
  kind: 'RELATIONAL' as const,
  dataSourceArn: SOURCE_A,
  name: 'orders',
  catalog: 'AwsDataCatalog',
  schema: 'analytics_dev',
  columnCount: 12,
  editable: true,
};

const CUSTOM_SQL_TABLE = {
  id: 't-revenue',
  kind: 'CUSTOM_SQL' as const,
  dataSourceArn: SOURCE_A,
  name: 'revenue_calc',
  sqlQuery:
    'SELECT o.order_id,\n       o.customer_id,\n       SUM(li.amount) AS revenue\nFROM analytics_dev.orders o\nJOIN analytics_dev.line_items li\n  ON li.order_id = o.order_id\nGROUP BY 1, 2',
  columnCount: 3,
  editable: true,
};

/** Stub the one request the dialog makes on open, through the API client's own middleware. */
function Stubbed({
  tables,
  failWith,
  children,
}: {
  tables: unknown[];
  failWith?: string;
  children: React.ReactNode;
}) {
  // Installed during render, not in an effect: the dialog's own effect
  // (a child's) would otherwise fire its request before the stub exists.
  const [restore] = useState(() =>
    mockApi([
      {
        method: 'get',
        url: '/source',
        respond: () =>
          failWith
            ? { status: 400, body: { success: false, error: failWith } }
            : {
                body: {
                  success: true,
                  data: {
                    dataSetId: 'ds-1',
                    name: 'orders_fact',
                    importMode: 'SPICE',
                    tables,
                    dataSources: DATA_SOURCES,
                  },
                },
              },
      },
    ])
  );
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

const meta: Meta<typeof DatasetSourceDialog> = {
  title: 'Entities/Dataset/DatasetSourceDialog',
  component: DatasetSourceDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Edits where a dataset reads its data from: catalog/schema/table for relational tables, the query for custom SQL, the data source for either, and the dataset name. Column definitions are always preserved.',
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <SnackbarProvider maxSnack={3}>
          <Story />
        </SnackbarProvider>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const args = {
  open: true,
  onClose: () => {},
  dataset: { id: 'ds-1', name: 'orders_fact' },
};

export const RelationalTable: Story = {
  args,
  render: (a) => (
    <Stubbed tables={[RELATIONAL_TABLE]}>
      <DatasetSourceDialog {...a} />
    </Stubbed>
  ),
};

export const CustomSql: Story = {
  args,
  render: (a) => (
    <Stubbed tables={[CUSTOM_SQL_TABLE]}>
      <DatasetSourceDialog {...a} />
    </Stubbed>
  ),
};

/** Composite datasets mix both kinds; each is edited on its own terms. */
export const MixedTables: Story = {
  args,
  render: (a) => (
    <Stubbed tables={[RELATIONAL_TABLE, CUSTOM_SQL_TABLE]}>
      <DatasetSourceDialog {...a} />
    </Stubbed>
  ),
};

/** S3-backed tables have no schema or query, so they are shown but not editable. */
export const S3SourceNotEditable: Story = {
  args,
  render: (a) => (
    <Stubbed
      tables={[
        {
          id: 't-s3',
          kind: 'S3',
          dataSourceArn: SOURCE_A,
          name: 't-s3',
          columnCount: 5,
          editable: false,
        },
      ]}
    >
      <DatasetSourceDialog {...a} />
    </Stubbed>
  ),
};

/** Uploaded datasets have no queryable specification at all. */
export const CannotBeEdited: Story = {
  args,
  render: (a) => (
    <Stubbed
      tables={[]}
      failWith="Could not load this dataset from QuickSight. Uploaded (flat file) datasets have no queryable specification and cannot be edited here."
    >
      <DatasetSourceDialog {...a} />
    </Stubbed>
  ),
};
