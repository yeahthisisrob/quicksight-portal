import ExportJobStatus from './ExportJobStatus';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ExportJobStatus> = {
  title: 'Features/DataExport/ExportJobStatus',
  component: ExportJobStatus,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Live status panel for the current (or a selected historical) export job: status chip, progress bar, message, and processed/failed/API-call stats.',
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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Processing: Story = {
  args: {
    status: 'processing',
    progress: 62,
    message: 'Exporting dashboards (125 of 200)...',
    stats: { totalAssets: 200, processedAssets: 125, failedAssets: 0, apiCalls: 431 },
    jobId: 'export-1755440000-abc123',
  },
};

export const Queued: Story = {
  args: {
    status: 'queued',
    progress: 0,
    message: 'Export job queued...',
    jobId: 'export-1755440000-abc123',
  },
};

export const CompletedWithFailures: Story = {
  args: {
    status: 'completed',
    progress: 100,
    message: 'Export completed with 3 errors',
    stats: { totalAssets: 200, processedAssets: 197, failedAssets: 3, apiCalls: 1289 },
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

export const Stopped: Story = {
  args: {
    status: 'stopped',
    progress: 48,
    message: 'Stopped by user',
    stats: { totalAssets: 200, processedAssets: 96, failedAssets: 0 },
    jobId: 'export-1755440000-abc123',
  },
};
