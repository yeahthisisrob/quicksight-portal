import { Box } from '@mui/material';

import { JobHistory } from './JobHistory';

import type { Meta, StoryObj } from '@storybook/react-vite';

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
    onSelectJob: (jobId: string) => console.log('Selected job:', jobId),
  },
} satisfies Meta<typeof JobHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock job data
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

// Override the API call in stories
const withMockData = (jobs: any[]) => {
  return {
    beforeEach: async () => {
      const exportApi = await import('@/shared/api/modules/export');
      exportApi.exportApi.listJobs = async () => ({
        jobs: jobs.map(job => ({ ...job, jobType: 'export' })),
      });
    },
  };
};

export const Default: Story = {
  ...withMockData(mockJobs),
};

export const Empty: Story = {
  ...withMockData([]),
};

export const Loading: Story = {
  beforeEach: async () => {
    const exportApi = await import('@/shared/api/modules/export');
    exportApi.exportApi.listJobs = () => new Promise(() => {}); // Never resolves
  },
};

export const WithCurrentJob: Story = {
  ...withMockData(mockJobs),
  args: {
    currentJobId: 'job-002',
  },
};

export const OnlyCompleted: Story = {
  ...withMockData(mockJobs.filter(job => job.status === 'completed')),
};

export const OnlyFailed: Story = {
  ...withMockData(mockJobs.filter(job => job.status === 'failed')),
};

export const ManyJobs: Story = {
  beforeEach: async () => {
    const manyJobs = Array.from({ length: 50 }, (_, i) => ({
      jobId: `job-${String(i + 1).padStart(3, '0')}`,
      status: ['completed', 'failed', 'processing', 'stopped'][i % 4] as any,
      progress: Math.floor(Math.random() * 100),
      message: `Export job ${i + 1}`,
      startTime: new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString(),
      endTime: i % 4 !== 2 ? new Date(Date.now() - i * 60 * 60 * 1000).toISOString() : undefined,
      duration: i % 4 !== 2 ? Math.floor(Math.random() * 60 * 60 * 1000) : undefined,
      stats: {
        totalAssets: Math.floor(Math.random() * 2000) + 100,
        processedAssets: Math.floor(Math.random() * 2000),
        failedAssets: Math.floor(Math.random() * 100),
        apiCalls: Math.floor(Math.random() * 5000) + 500,
      },
    }));
    
    const exportApi = await import('@/shared/api/modules/export');
    exportApi.exportApi.listJobs = async () => ({
      jobs: manyJobs.map(job => ({ ...job, jobType: 'export' })),
    });
  },
};