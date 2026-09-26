import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../.storybook/mocks/api';
import { exportRoutes } from './__stories__/routes';
import DataExportView from './DataExportView';

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
    <MockedApi routes={exportRoutes()}>
      <DataExportView embedded />
    </MockedApi>
  ),
};

export const ExportInProgress: Story = {
  render: () => (
    <MockedApi routes={exportRoutes({ running: true })}>
      <DataExportView embedded />
    </MockedApi>
  ),
};

export const ExportWithErrors: Story = {
  render: () => (
    <MockedApi routes={exportRoutes({ withErrors: true })}>
      <DataExportView embedded />
    </MockedApi>
  ),
};

export const EmptyCache: Story = {
  render: () => (
    <MockedApi routes={exportRoutes({ emptyCache: true })}>
      <DataExportView embedded />
    </MockedApi>
  ),
};
