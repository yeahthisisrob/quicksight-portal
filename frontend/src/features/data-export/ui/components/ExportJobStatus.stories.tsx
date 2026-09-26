import type { Meta, StoryObj } from '@storybook/react-vite';

import ExportJobStatus from './ExportJobStatus';

const meta = {
  title: 'Features/DataExport/ExportJobStatus',
  component: ExportJobStatus,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Live status panel for the current (or a selected historical) export job: status chip, progress bar, message, processed/failed/API-call stats, checkpoint-driven per-asset-type progress, and a worker heartbeat liveness indicator.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['queued', 'processing', 'completed', 'failed', 'stopping', 'stopped'],
    },
    progress: { control: { type: 'range', min: 0, max: 100 } },
  },
} satisfies Meta<typeof ExportJobStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Processing: Story = {
  args: {
    status: 'processing',
    progress: 62,
    message: 'Exporting dashboards (125 of 200)...',
    stats: { totalAssets: 200, processedAssets: 125, failedAssets: 0, apiCalls: 431 },
    lastUpdatedTime: new Date(Date.now() - 4 * 1000).toISOString(), // active 4s ago
    checkpoint: { completedAssetTypes: ['dashboard', 'analysis', 'dataset'] },
    jobId: 'export-1755440000-abc123',
  },
};

export const WorkerStalled: Story = {
  args: {
    status: 'processing',
    progress: 71,
    message: 'Enriching folders...',
    lastUpdatedTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // silent 12m
    checkpoint: {
      completedAssetTypes: ['dashboard', 'analysis', 'dataset', 'datasource'],
      catalogPending: true,
    },
    jobId: 'export-1755440000-abc123',
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
    progress: 34,
    message: 'Export failed: rate limit exceeded',
    stats: { totalAssets: 200, processedAssets: 68, failedAssets: 1, apiCalls: 240 },
    jobId: 'export-1755440000-abc123',
  },
};
