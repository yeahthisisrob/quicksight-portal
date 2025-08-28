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
    exportedAssets: 1250,
    fieldStats: {
      total: 3456,
      calculated: 789,
      physical: 2667,
    },
    cacheSize: 125000000,
    loading: false,
  },
};

export const PartialSync: Story = {
  args: {
    totalAssets: 1250,
    exportedAssets: 850,
    fieldStats: {
      total: 3456,
      calculated: 789,
      physical: 2667,
    },
    cacheSize: 85000000,
    loading: false,
  },
};

export const NoFieldStats: Story = {
  args: {
    totalAssets: 1250,
    exportedAssets: 1250,
    fieldStats: null,
    cacheSize: 125000000,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    totalAssets: 0,
    exportedAssets: 0,
    fieldStats: null,
    cacheSize: undefined,
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    totalAssets: 0,
    exportedAssets: 0,
    fieldStats: null,
    cacheSize: undefined,
    loading: false,
  },
};

export const LargeNumbers: Story = {
  args: {
    totalAssets: 125000,
    exportedAssets: 123456,
    fieldStats: {
      total: 345678,
      calculated: 78901,
      physical: 266777,
    },
    cacheSize: 12500000000,
    loading: false,
  },
};