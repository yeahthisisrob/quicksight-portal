import type { Meta, StoryObj } from '@storybook/react-vite';

import ExportStats from './ExportStats';

const meta = {
  title: 'Features/DataExport/ExportStats',
  component: ExportStats,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ExportStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    totalAssets: 1250,
    archivedAssets: 45,
    lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    fieldStats: {
      total: 3456,
      calculated: 789,
      physical: 2667,
    },

    loading: false,
  },
};

export const VeryStaleCache: Story = {
  args: {
    totalAssets: 1250,
    archivedAssets: 156,
    lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    fieldStats: {
      total: 3456,
      calculated: 789,
      physical: 2667,
    },

    loading: false,
  },
};

export const Loading: Story = {
  args: {
    totalAssets: 0,
    archivedAssets: 0,
    lastUpdated: null,
    fieldStats: null,

    loading: true,
  },
};
