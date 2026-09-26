import type { Meta, StoryObj } from '@storybook/react-vite';

import type { UserActivity } from '@/features/activity';

import { UserActivityDialog } from '../UserActivityDialog';
import { activityOk, withActivityResponse } from './withActivityResponse';

const meta = {
  title: 'Widgets/ActivityStats/UserActivityDialog',
  component: UserActivityDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A user’s activity, read from GET /activity/user/{id}: total activities, the dashboards and analyses they viewed, and recent days. Loading and error states are shared with ActivityStatsDialog.',
      },
    },
  },
  decorators: [withActivityResponse],
  args: {
    open: true,
    onClose: () => {},
    userName: 'john.doe@company.com',
    // Over 20 characters, so the header shortens it.
    userId: 'user-001-with-a-long-identifier',
  },
} satisfies Meta<typeof UserActivityDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const activity: UserActivity = {
  userName: 'john.doe@company.com',
  lastActive: '2024-01-24T15:45:00Z',
  totalActivities: 342,
  activitiesByDate: {
    '2024-01-24': 45,
    '2024-01-23': 52,
    '2024-01-22': 38,
    '2024-01-21': 41,
    '2024-01-20': 67,
  },
  dashboards: [
    {
      dashboardId: 'dash-001',
      dashboardName: 'Executive Summary Dashboard',
      viewCount: 87,
      lastViewed: '2024-01-24T15:30:00Z',
    },
    {
      dashboardId: 'dash-002',
      dashboardName: 'Sales Performance Dashboard',
      viewCount: 65,
      lastViewed: '2024-01-24T14:20:00Z',
    },
  ],
  analyses: [
    {
      analysisId: 'analysis-001',
      analysisName: 'Q4 Revenue Analysis',
      viewCount: 28,
      lastViewed: '2024-01-24T10:15:00Z',
    },
  ],
};

export const Default: Story = {
  parameters: { activityResponse: activityOk(activity) },
};

/** Never active: "Never" for last active, and no dashboard, analysis or daily sections. */
export const InactiveUser: Story = {
  args: { userName: 'inactive.user@company.com', userId: 'user-inactive' },
  parameters: {
    activityResponse: activityOk({
      userName: 'inactive.user@company.com',
      lastActive: null,
      totalActivities: 0,
      activitiesByDate: {},
      dashboards: [],
      analyses: [],
    }),
  },
};
