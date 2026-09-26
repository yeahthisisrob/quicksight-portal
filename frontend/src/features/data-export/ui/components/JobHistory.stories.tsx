import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi, type MockRoute } from '../../../../../.storybook/mocks/api';
import { JobHistory } from './JobHistory';

const meta = {
  title: 'Features/DataExport/JobHistory',
  component: JobHistory,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    onSelectJob: () => {},
  },
} satisfies Meta<typeof JobHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockJobs = [
  {
    jobId: 'job-001',
    status: 'completed' as const,
    progress: 100,
    message: 'Export completed successfully',
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    endTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    duration: 30 * 60 * 1000, // 30 minutes
    stats: {
      totalAssets: 1250,
      processedAssets: 1250,
      failedAssets: 0,
      apiCalls: 3750,
    },
  },
  {
    jobId: 'job-002',
    status: 'processing' as const,
    progress: 65,
    message: 'Processing dataset assets',
    startTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    stats: {
      totalAssets: 800,
      processedAssets: 520,
      apiCalls: 1560,
    },
  },
  {
    jobId: 'job-003',
    status: 'failed' as const,
    progress: 45,
    message: 'Export failed due to rate limit exceeded',
    startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    endTime: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    duration: 30 * 60 * 1000,
    stats: {
      totalAssets: 2000,
      processedAssets: 900,
      failedAssets: 1100,
      apiCalls: 2700,
    },
    error: 'Rate limit exceeded for QuickSight API',
  },
  {
    jobId: 'job-004',
    status: 'stopped' as const,
    progress: 78,
    message: 'Export stopped by user',
    startTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    endTime: new Date(Date.now() - 5.8 * 60 * 60 * 1000).toISOString(),
    duration: 12 * 60 * 1000,
    stats: {
      totalAssets: 500,
      processedAssets: 390,
      apiCalls: 1170,
    },
    stopRequested: true,
  },
  {
    jobId: 'job-005',
    status: 'queued' as const,
    progress: 0,
    message: 'Waiting for worker Lambda',
    startTime: new Date(Date.now() - 30 * 1000).toISOString(), // 30 seconds ago
  },
];

const listJobs = (respond: MockRoute['respond']): MockRoute[] => [
  { method: 'get', url: /\/jobs$/, respond },
];

/** Every status, with the processing job highlighted as the current one. */
export const Default: Story = {
  args: { currentJobId: 'job-002' },
  render: (args) => (
    <MockedApi
      routes={listJobs(() => ({
        body: { success: true, data: mockJobs.map((job) => ({ ...job, jobType: 'export' })) },
      }))}
    >
      <JobHistory {...args} />
    </MockedApi>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <MockedApi routes={listJobs(() => ({ body: { success: true, data: [] } }))}>
      <JobHistory {...args} />
    </MockedApi>
  ),
};

export const Loading: Story = {
  render: (args) => (
    <MockedApi routes={listJobs(() => new Promise(() => {}))}>
      <JobHistory {...args} />
    </MockedApi>
  ),
};
