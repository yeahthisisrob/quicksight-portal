import { useState } from 'react';

import ExportControls from './ExportControls';
import { ExportMode } from '../../model/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataExport/ExportControls',
  component: ExportControls,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExportControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [exportMode, setExportMode] = useState<ExportMode>(args.exportMode);

    return (
      <ExportControls
        {...args}
        exportMode={exportMode}
        onModeChange={setExportMode}
      />
    );
  },
  args: {
    exportMode: 'smart',
    onModeChange: () => {},
    onStartExport: () => {},
    onStopExport: () => {},
    onRefreshActivity: () => {},
    onExportIngestions: () => {},
    onClearMemoryCache: () => {},
    onClearStuckJobs: () => {},
    onRefreshStatus: () => {},
    isRunning: false,
    isRefreshing: false,
    canRefreshActivity: true,
    refreshingActivity: false,
    exportingIngestions: false,
    clearingCache: false,
    clearingStuckJobs: false,
    selectedTypesCount: 3,
  },
};

export const Running: Story = {
  render: Default.render,
  args: {
    exportMode: 'smart',
    onModeChange: () => {},
    onStartExport: () => {},
    onStopExport: () => {},
    onRefreshActivity: () => {},
    onExportIngestions: () => {},
    onClearMemoryCache: () => {},
    onClearStuckJobs: () => {},
    onRefreshStatus: () => {},
    isRunning: true,
    isRefreshing: false,
    canRefreshActivity: true,
    refreshingActivity: false,
    exportingIngestions: false,
    clearingCache: false,
    clearingStuckJobs: false,
    selectedTypesCount: 3,
  },
};

export const ForceMode: Story = {
  render: Default.render,
  args: {
    exportMode: 'force',
    onModeChange: () => {},
    onStartExport: () => {},
    onStopExport: () => {},
    onRefreshActivity: () => {},
    onExportIngestions: () => {},
    onClearMemoryCache: () => {},
    onClearStuckJobs: () => {},
    onRefreshStatus: () => {},
    isRunning: false,
    isRefreshing: false,
    canRefreshActivity: true,
    refreshingActivity: false,
    exportingIngestions: false,
    clearingCache: false,
    clearingStuckJobs: false,
    selectedTypesCount: 3,
  },
};

export const RebuildMode: Story = {
  render: Default.render,
  args: {
    exportMode: 'rebuild',
    onModeChange: () => {},
    onStartExport: () => {},
    onStopExport: () => {},
    onRefreshActivity: () => {},
    onExportIngestions: () => {},
    onClearMemoryCache: () => {},
    onClearStuckJobs: () => {},
    onRefreshStatus: () => {},
    isRunning: false,
    isRefreshing: false,
    canRefreshActivity: true,
    refreshingActivity: false,
    exportingIngestions: false,
    clearingCache: false,
    clearingStuckJobs: false,
    selectedTypesCount: 3,
  },
};

export const NoSelection: Story = {
  render: Default.render,
  args: {
    exportMode: 'smart',
    onModeChange: () => {},
    onStartExport: () => {},
    onStopExport: () => {},
    onRefreshActivity: () => {},
    onExportIngestions: () => {},
    onClearMemoryCache: () => {},
    onClearStuckJobs: () => {},
    onRefreshStatus: () => {},
    isRunning: false,
    isRefreshing: false,
    canRefreshActivity: false,
    refreshingActivity: false,
    exportingIngestions: false,
    clearingCache: false,
    clearingStuckJobs: false,
    selectedTypesCount: 0,
  },
};

export const RefreshingViews: Story = {
  render: Default.render,
  args: {
    exportMode: 'smart',
    onModeChange: () => {},
    onStartExport: () => {},
    onStopExport: () => {},
    onRefreshActivity: () => {},
    onExportIngestions: () => {},
    onClearMemoryCache: () => {},
    onClearStuckJobs: () => {},
    onRefreshStatus: () => {},
    isRunning: false,
    isRefreshing: false,
    canRefreshActivity: true,
    refreshingActivity: true,
    exportingIngestions: false,
    clearingCache: false,
    clearingStuckJobs: false,
    selectedTypesCount: 2,
  },
};

export const PermissionsMode: Story = {
  render: Default.render,
  args: {
    exportMode: 'permissions',
    onModeChange: () => {},
    onStartExport: () => {},
    onStopExport: () => {},
    onRefreshActivity: () => {},
    onExportIngestions: () => {},
    onClearMemoryCache: () => {},
    onClearStuckJobs: () => {},
    onRefreshStatus: () => {},
    isRunning: false,
    isRefreshing: false,
    canRefreshActivity: false,
    refreshingActivity: false,
    exportingIngestions: false,
    clearingCache: false,
    clearingStuckJobs: false,
    selectedTypesCount: 5,
  },
};