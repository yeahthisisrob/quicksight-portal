import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import { exportRoutes } from './__stories__/routes';
import DataExportView from './DataExportView';

/** Installed during render, before the view's first request. */
function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

const meta = {
  title: 'Features/DataExport/DataExportView',
  component: DataExportView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Export tab of Operations: cache facts, the export container, the live job and the activity container. The API is stubbed per story.',
      },
    },
  },
} satisfies Meta<typeof DataExportView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Mocked routes={exportRoutes()}>
      <DataExportView embedded />
    </Mocked>
  ),
};

export const ExportInProgress: Story = {
  render: () => (
    <Mocked routes={exportRoutes({ running: true })}>
      <DataExportView embedded />
    </Mocked>
  ),
};

export const ExportWithErrors: Story = {
  render: () => (
    <Mocked routes={exportRoutes({ withErrors: true })}>
      <DataExportView embedded />
    </Mocked>
  ),
};

export const EmptyCache: Story = {
  render: () => (
    <Mocked routes={exportRoutes({ emptyCache: true })}>
      <DataExportView embedded />
    </Mocked>
  ),
};
