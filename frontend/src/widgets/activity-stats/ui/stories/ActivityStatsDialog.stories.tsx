import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ActivityData } from '@/features/activity';

import { ActivityStatsDialog } from '../ActivityStatsDialog';
import { activityOk, withActivityResponse } from './withActivityResponse';

const meta = {
  title: 'Widgets/ActivityStats/ActivityStatsDialog',
  component: ActivityStatsDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Activity statistics for a dashboard or analysis, read from GET /activity/{type}/{id}: total views, unique viewers, top viewers with their groups, and recent days.',
      },
    },
  },
  decorators: [withActivityResponse],
  args: {
    open: true,
    onClose: () => {},
    assetName: 'Executive Summary Dashboard',
    assetType: 'dashboard',
    assetId: 'dashboard-001',
  },
} satisfies Meta<typeof ActivityStatsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const activity: ActivityData = {
  assetId: 'dashboard-001',
  assetName: 'Executive Summary Dashboard',
  assetType: 'dashboard',
  totalViews: 1523,
  uniqueViewers: 42,
  lastViewed: '2024-01-24T15:30:00Z',
  viewsByDate: {
    '2024-01-24': 125,
    '2024-01-23': 187,
    '2024-01-22': 203,
    '2024-01-21': 156,
    '2024-01-20': 298,
    '2024-01-19': 342,
    '2024-01-18': 212,
  },
  viewers: [
    {
      userName: 'john.doe@company.com',
      viewCount: 234,
      lastViewed: '2024-01-24T15:30:00Z',
      groups: ['Executives', 'Finance', 'All staff'],
    },
    {
      userName: 'jane.smith@company.com',
      viewCount: 187,
      lastViewed: '2024-01-24T14:20:00Z',
      groups: ['Finance'],
    },
    { userName: 'mike.johnson@company.com', viewCount: 156, lastViewed: '2024-01-24T10:15:00Z' },
  ],
};

export const Default: Story = {
  parameters: { activityResponse: activityOk(activity) },
};

export const NoActivity: Story = {
  args: { assetName: 'New Dashboard', assetId: 'dashboard-002' },
  parameters: {
    activityResponse: activityOk({
      ...activity,
      assetId: 'dashboard-002',
      totalViews: 0,
      uniqueViewers: 0,
      viewsByDate: {},
      viewers: [],
    }),
  },
};

export const Loading: Story = {
  parameters: { activityResponse: 'pending' },
};

export const LoadError: Story = {
  parameters: {
    activityResponse: {
      status: 500,
      body: { success: false, error: 'Activity cache unavailable' },
    },
  },
};
