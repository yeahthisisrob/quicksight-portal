import { ActivityStatsDialog } from '../ActivityStatsDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ActivityStatsDialog> = {
  title: 'Widgets/ActivityStats/ActivityStatsDialog',
  component: ActivityStatsDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Dialog component for viewing detailed activity statistics for dashboards and analyses. Shows total views, unique viewers, top viewers list, and activity timeline.',
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
    assetName: {
      control: 'text',
      description: 'Name of the asset',
    },
    assetType: {
      control: 'select',
      options: ['dashboard', 'analysis'],
      description: 'Type of the asset',
    },
    assetId: {
      control: 'text',
      description: 'ID of the asset',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock activity data
// Mock activity data for stories
const mockActivityData = {
  assetId: 'dashboard-001',
  assetName: 'Executive Summary Dashboard',
  assetType: 'dashboard' as const,
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
    { userName: 'john.doe@company.com', viewCount: 234, lastViewed: '2024-01-24T15:30:00Z' },
    { userName: 'jane.smith@company.com', viewCount: 187, lastViewed: '2024-01-24T14:20:00Z' },
    { userName: 'mike.johnson@company.com', viewCount: 156, lastViewed: '2024-01-24T10:15:00Z' },
    { userName: 'sarah.williams@company.com', viewCount: 142, lastViewed: '2024-01-23T16:45:00Z' },
    { userName: 'david.brown@company.com', viewCount: 98, lastViewed: '2024-01-23T11:30:00Z' },
  ],
};

const mockEmptyActivityData = {
  assetId: 'dashboard-002',
  assetName: 'New Dashboard',
  assetType: 'dashboard' as const,
  totalViews: 0,
  uniqueViewers: 0,
  lastViewed: '',
  viewsByDate: {},
  viewers: [],
};

const mockSingleViewerData = {
  assetId: 'analysis-001',
  assetName: 'Sales Analysis',
  assetType: 'analysis' as const,
  totalViews: 5,
  uniqueViewers: 1,
  lastViewed: '2024-01-24T09:00:00Z',
  viewsByDate: {
    '2024-01-24': 3,
    '2024-01-23': 2,
  },
  viewers: [
    { userName: 'admin@company.com', viewCount: 5, lastViewed: '2024-01-24T09:00:00Z' },
  ],
};

export const Default: Story = {
  args: {
    open: true,
    assetName: mockActivityData.assetName,
    assetType: 'dashboard',
    assetId: mockActivityData.assetId,
  },
};

export const AnalysisActivity: Story = {
  args: {
    open: true,
    assetName: 'Quarterly Revenue Analysis',
    assetType: 'analysis',
    assetId: 'analysis-001',
  },
};

export const NoActivity: Story = {
  args: {
    open: true,
    assetName: mockEmptyActivityData.assetName,
    assetType: 'dashboard',
    assetId: mockEmptyActivityData.assetId,
  },
};

export const SingleViewer: Story = {
  args: {
    open: true,
    assetName: mockSingleViewerData.assetName,
    assetType: 'analysis',
    assetId: mockSingleViewerData.assetId,
  },
};

export const LongAssetName: Story = {
  args: {
    open: true,
    assetName: 'Comprehensive Enterprise Resource Planning and Business Intelligence Integration Dashboard for Executive Leadership Team Q4 2024',
    assetType: 'dashboard',
    assetId: 'dashboard-long-name-001',
  },
};

export const LoadingState: Story = {
  args: {
    open: true,
    assetName: 'Sales Dashboard',
    assetType: 'dashboard',
    assetId: 'dashboard-loading',
  },
};

export const ErrorState: Story = {
  args: {
    open: true,
    assetName: 'Error Dashboard',
    assetType: 'dashboard',
    assetId: 'dashboard-error',
  },
};

export const HighActivityVolume: Story = {
  args: {
    open: true,
    assetName: 'Popular Dashboard',
    assetType: 'dashboard',
    assetId: 'dashboard-popular',
  },
};

export const Interactive: Story = {
  args: {
    open: true,
    assetName: 'Interactive Dashboard',
    assetType: 'dashboard',
    assetId: 'dashboard-interactive',
  },
};