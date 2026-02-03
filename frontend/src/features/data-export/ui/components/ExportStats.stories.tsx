import ExportStats from './ExportStats';

import type { Meta, StoryObj } from '@storybook/react-vite';

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
    cacheSize: 125000000,
    loading: false,
  },
};

export const RecentlyUpdated: Story = {
  args: {
    totalAssets: 1250,
    archivedAssets: 12,
    lastUpdated: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    fieldStats: {
      total: 3456,
      calculated: 789,
      physical: 2667,
    },
    cacheSize: 125000000,
    loading: false,
  },
};

export const StaleCache: Story = {
  args: {
    totalAssets: 1250,
    archivedAssets: 78,
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    fieldStats: {
      total: 3456,
      calculated: 789,
      physical: 2667,
    },
    cacheSize: 125000000,
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
    cacheSize: 125000000,
    loading: false,
  },
};

export const NoArchivedAssets: Story = {
  args: {
    totalAssets: 500,
    archivedAssets: 0,
    lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    fieldStats: {
      total: 1234,
      calculated: 234,
      physical: 1000,
    },
    cacheSize: 50000000,
    loading: false,
  },
};

export const NoFieldStats: Story = {
  args: {
    totalAssets: 1250,
    archivedAssets: 25,
    lastUpdated: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    fieldStats: null,
    cacheSize: 125000000,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    totalAssets: 0,
    archivedAssets: 0,
    lastUpdated: null,
    fieldStats: null,
    cacheSize: undefined,
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    totalAssets: 0,
    archivedAssets: 0,
    lastUpdated: null,
    fieldStats: null,
    cacheSize: undefined,
    loading: false,
  },
};

export const LargeNumbers: Story = {
  args: {
    totalAssets: 125000,
    archivedAssets: 3456,
    lastUpdated: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    fieldStats: {
      total: 345678,
      calculated: 78901,
      physical: 266777,
    },
    cacheSize: 12500000000,
    loading: false,
  },
};
