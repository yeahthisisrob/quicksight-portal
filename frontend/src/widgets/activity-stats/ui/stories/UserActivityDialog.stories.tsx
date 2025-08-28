import { UserActivityDialog } from '../UserActivityDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof UserActivityDialog> = {
  title: 'Widgets/ActivityStats/UserActivityDialog',
  component: UserActivityDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Dialog component for viewing user activity statistics. Shows total activities, dashboards/analyses viewed, and activity timeline.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      // In docs mode, don't render the dialog open by default
      if (context.viewMode === 'docs') {
        return (
          <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Dialog component - Click on a story to see it in action</p>
          </div>
        );
      }
      return <Story />;
    },
  ],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls whether the dialog is open',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when dialog is closed',
    },
    userName: {
      control: 'text',
      description: 'Name of the user',
    },
    userId: {
      control: 'text',
      description: 'ID of the user',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock user activity data for stories
const mockUserActivityData = {
  userName: 'john.doe@company.com',
  lastActive: '2024-01-24T15:45:00Z',
  totalActivities: 342,
  activitiesByDate: {
    '2024-01-24': 45,
    '2024-01-23': 52,
    '2024-01-22': 38,
    '2024-01-21': 41,
    '2024-01-20': 67,
    '2024-01-19': 55,
    '2024-01-18': 44,
  },
  dashboards: [
    { 
      dashboardId: 'dash-001', 
      dashboardName: 'Executive Summary Dashboard', 
      viewCount: 87, 
      lastViewed: '2024-01-24T15:30:00Z' 
    },
    { 
      dashboardId: 'dash-002', 
      dashboardName: 'Sales Performance Dashboard', 
      viewCount: 65, 
      lastViewed: '2024-01-24T14:20:00Z' 
    },
    { 
      dashboardId: 'dash-003', 
      dashboardName: 'Marketing Analytics', 
      viewCount: 43, 
      lastViewed: '2024-01-23T16:45:00Z' 
    },
    { 
      dashboardId: 'dash-004', 
      dashboardName: 'Operations Dashboard', 
      viewCount: 32, 
      lastViewed: '2024-01-22T11:30:00Z' 
    },
  ],
  analyses: [
    { 
      analysisId: 'analysis-001', 
      analysisName: 'Q4 Revenue Analysis', 
      viewCount: 28, 
      lastViewed: '2024-01-24T10:15:00Z' 
    },
    { 
      analysisId: 'analysis-002', 
      analysisName: 'Customer Segmentation', 
      viewCount: 19, 
      lastViewed: '2024-01-23T09:00:00Z' 
    },
  ],
};

const mockInactiveUserData = {
  userName: 'inactive.user@company.com',
  lastActive: null,
  totalActivities: 0,
  activitiesByDate: {},
  dashboards: [],
  analyses: [],
};

const mockPowerUserData = {
  userName: 'power.user@company.com',
  lastActive: '2024-01-24T16:00:00Z',
  totalActivities: 2847,
  activitiesByDate: Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return [date.toISOString().split('T')[0], Math.floor(Math.random() * 150) + 50];
    })
  ),
  dashboards: Array.from({ length: 15 }, (_, i) => ({
    dashboardId: `dash-${String(i + 1).padStart(3, '0')}`,
    dashboardName: `Dashboard ${i + 1}`,
    viewCount: Math.floor(Math.random() * 200) + 50,
    lastViewed: '2024-01-24T10:00:00Z',
  })).sort((a, b) => b.viewCount - a.viewCount),
  analyses: Array.from({ length: 10 }, (_, i) => ({
    analysisId: `analysis-${String(i + 1).padStart(3, '0')}`,
    analysisName: `Analysis ${i + 1}`,
    viewCount: Math.floor(Math.random() * 100) + 20,
    lastViewed: '2024-01-23T10:00:00Z',
  })).sort((a, b) => b.viewCount - a.viewCount),
};

export const Default: Story = {
  args: {
    open: true,
    userName: mockUserActivityData.userName,
    userId: 'user-001',
  },
};

export const InactiveUser: Story = {
  args: {
    open: true,
    userName: mockInactiveUserData.userName,
    userId: 'user-inactive',
  },
};

export const PowerUser: Story = {
  args: {
    open: true,
    userName: mockPowerUserData.userName,
    userId: 'user-power',
  },
};

export const DashboardOnlyUser: Story = {
  args: {
    open: true,
    userName: 'dashboard.viewer@company.com',
    userId: 'user-dashboard-only',
  },
};

export const AnalysisOnlyUser: Story = {
  args: {
    open: true,
    userName: 'analyst@company.com',
    userId: 'user-analysis-only',
  },
};

export const LongUserName: Story = {
  args: {
    open: true,
    userName: 'very.long.user.name.with.many.parts@enterprise-company-with-long-domain.com',
    userId: 'user-long-name-001-with-very-long-identifier',
  },
};

export const LoadingState: Story = {
  args: {
    open: true,
    userName: 'loading.user@company.com',
    userId: 'user-loading',
  },
};

export const ErrorState: Story = {
  args: {
    open: true,
    userName: 'error.user@company.com',
    userId: 'user-error',
  },
};

export const RecentActivity: Story = {
  args: {
    open: true,
    userName: 'recent.user@company.com',
    userId: 'user-recent',
  },
};

export const Interactive: Story = {
  args: {
    open: true,
    userName: 'interactive.user@company.com',
    userId: 'user-interactive',
  },
};