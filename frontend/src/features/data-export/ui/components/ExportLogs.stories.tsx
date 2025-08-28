import React from 'react';

import { ExportLogs } from './ExportLogs';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ExportLogs> = {
  title: 'Features/DataExport/ExportLogs',
  component: ExportLogs,
  parameters: {
    layout: 'padded',
  },
  args: {
    showTimestamps: true,
    defaultExpanded: true,
    maxHeight: 400,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleLogs = [
  {
    ts: Date.now() - 60000,
    msg: 'Export process started',
    level: 'info' as const,
  },
  {
    ts: Date.now() - 55000,
    msg: 'Export options: {"forceRefresh":false,"rebuildIndex":false}',
    level: 'info' as const,
  },
  {
    ts: Date.now() - 50000,
    msg: 'Starting export for dashboard',
    level: 'info' as const,
    assetType: 'dashboard',
  },
  {
    ts: Date.now() - 45000,
    msg: 'Listed 25 dashboard assets',
    level: 'info' as const,
    assetType: 'dashboard',
  },
  {
    ts: Date.now() - 40000,
    msg: 'Failed to process dashboard dashboard-123: Access denied',
    level: 'error' as const,
    assetType: 'dashboard',
    assetId: 'dashboard-123',
  },
  {
    ts: Date.now() - 35000,
    msg: 'Batch 1/5 for dashboard: 4 successful, 1 failed',
    level: 'warn' as const,
    assetType: 'dashboard',
  },
  {
    ts: Date.now() - 30000,
    msg: 'Completed export for dashboard: 20 successful, 5 failed',
    level: 'warn' as const,
    assetType: 'dashboard',
  },
  {
    ts: Date.now() - 25000,
    msg: 'Starting export for dataset',
    level: 'info' as const,
    assetType: 'dataset',
  },
  {
    ts: Date.now() - 20000,
    msg: 'Listed 150 dataset assets',
    level: 'info' as const,
    assetType: 'dataset',
  },
  {
    ts: Date.now() - 15000,
    msg: 'Completed export for dataset: 150 successful, 0 failed',
    level: 'info' as const,
    assetType: 'dataset',
  },
  {
    ts: Date.now() - 10000,
    msg: 'Export completed successfully in 50.2s',
    level: 'info' as const,
  },
];

export const Default: Story = {
  args: {
    logs: sampleLogs,
  },
};

export const Empty: Story = {
  args: {
    logs: [],
  },
};

export const ErrorsOnly: Story = {
  args: {
    logs: sampleLogs.filter(log => log.level === 'error'),
  },
};

export const Collapsed: Story = {
  args: {
    logs: sampleLogs,
    defaultExpanded: false,
  },
};

export const SmallHeight: Story = {
  args: {
    logs: sampleLogs,
    maxHeight: 200,
  },
};

export const NoTimestamps: Story = {
  args: {
    logs: sampleLogs,
    showTimestamps: false,
  },
};

export const LongMessages: Story = {
  args: {
    logs: [
      {
        ts: Date.now() - 5000,
        msg: 'This is a very long log message that should wrap properly when displayed in the log viewer. It contains detailed information about the export process including multiple asset types, error details, and performance metrics.',
        level: 'info' as const,
      },
      {
        ts: Date.now() - 4000,
        msg: 'Failed to process dataset with a really long identifier: dataset-abc-123-def-456-ghi-789-jkl-012-mno-345-pqr-678',
        level: 'error' as const,
        assetType: 'dataset',
        assetId: 'dataset-abc-123-def-456-ghi-789-jkl-012-mno-345-pqr-678',
      },
      {
        ts: Date.now() - 3000,
        msg: 'Processing batch 10/50 for analyses. Current progress: 200 assets processed, 50 enriched, 5 failed. Estimated time remaining: 2 minutes 30 seconds.',
        level: 'info' as const,
        assetType: 'analysis',
      },
    ],
  },
};

export const RealTimeSimulation: Story = {
  render: (args) => {
    const [logs, setLogs] = React.useState(args.logs || []);
    
    React.useEffect(() => {
      const messages = [
        { msg: 'Processing dashboard', assetType: 'dashboard' },
        { msg: 'Processing dataset', assetType: 'dataset' },
        { msg: 'Processing analysis', assetType: 'analysis' },
        { msg: 'Enriching assets...', level: 'info' as const },
        { msg: 'Failed to enrich asset', level: 'error' as const },
        { msg: 'Batch completed', level: 'info' as const },
      ];
      
      const interval = setInterval(() => {
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        setLogs(prev => [...prev, {
          ts: Date.now(),
          ...randomMessage,
        }].slice(-20)); // Keep last 20 logs
      }, 2000);
      
      return () => clearInterval(interval);
    }, []);
    
    return <ExportLogs {...args} logs={logs} />;
  },
  args: {
    logs: [],
  },
};