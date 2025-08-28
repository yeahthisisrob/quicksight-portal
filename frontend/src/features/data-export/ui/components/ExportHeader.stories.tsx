import ExportHeader from './ExportHeader';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataExport/ExportHeader',
  component: ExportHeader,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExportHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    lastExportDate: new Date().toISOString(),
    onRefreshSummary: () => {},
    loading: false,
  },
};

export const NoExportDate: Story = {
  args: {
    lastExportDate: null,
    onRefreshSummary: () => {},
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    lastExportDate: new Date().toISOString(),
    onRefreshSummary: () => {},
    loading: true,
  },
};

export const OldExportDate: Story = {
  args: {
    lastExportDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    onRefreshSummary: () => {},
    loading: false,
  },
};