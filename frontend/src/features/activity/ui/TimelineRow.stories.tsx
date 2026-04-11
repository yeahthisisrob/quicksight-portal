import { Box } from '@mui/material';
import { subHours, subDays } from 'date-fns';

import { TimelineRow } from './TimelineRow';

import type { TimelineEvent } from '@/shared/api/modules/activity';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TimelineRow> = {
  title: 'Features/Activity/TimelineRow',
  component: TimelineRow,
  decorators: [
    (Story) => (
      <Box sx={{ width: 720, bgcolor: 'background.paper', border: '1px solid #eee' }}>
        <Story />
      </Box>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TimelineRow>;

const baseEvent = (overrides: Partial<TimelineEvent>): TimelineEvent => ({
  id: 'id-1',
  timestamp: subHours(new Date(), 2).toISOString(),
  eventName: 'UpdateDashboard',
  kind: 'mutation',
  action: 'update',
  user: 'alice.jones',
  resourceType: 'dashboard',
  assetType: 'dashboard',
  assetId: 'dash-123',
  assetName: 'Sales Q3 Dashboard',
  ...overrides,
});

export const DashboardUpdated: Story = {
  args: {
    event: baseEvent({}),
  },
};

export const DashboardPublished: Story = {
  args: {
    event: baseEvent({
      id: 'id-2',
      eventName: 'UpdateDashboardPublishedVersion',
      action: 'publish',
      user: 'bob.smith',
      assetName: 'Marketing Weekly',
      timestamp: subHours(new Date(), 5).toISOString(),
    }),
  },
};

export const AnalysisDeleted: Story = {
  args: {
    event: baseEvent({
      id: 'id-3',
      eventName: 'DeleteAnalysis',
      action: 'delete',
      resourceType: 'analysis',
      assetType: 'analysis',
      assetId: 'anal-999',
      assetName: 'Legacy Cohort Analysis',
      user: 'charlie',
      timestamp: subDays(new Date(), 1).toISOString(),
    }),
  },
};

export const PermissionsGranted: Story = {
  args: {
    event: baseEvent({
      id: 'id-4',
      eventName: 'UpdateDataSetPermissions',
      action: 'grant',
      resourceType: 'dataset',
      assetType: 'dataset',
      assetId: 'ds-42',
      assetName: 'Customer PII',
      user: 'security-bot',
      timestamp: subHours(new Date(), 1).toISOString(),
    }),
  },
};

export const UnknownAssetFallback: Story = {
  args: {
    event: baseEvent({
      id: 'id-5',
      eventName: 'CreateDashboard',
      action: 'create',
      assetId: 'dash-new-unseen',
      assetName: undefined, // catalog doesn't know it yet — shows raw id
    }),
  },
};

export const OtherResourceType: Story = {
  args: {
    event: baseEvent({
      id: 'id-6',
      eventName: 'UpdateAccountSettings',
      action: 'update',
      resourceType: 'other',
      assetType: undefined,
      assetId: undefined,
      assetName: undefined,
      user: 'admin',
    }),
  },
};

export const TagResource: Story = {
  args: {
    event: baseEvent({
      id: 'id-7',
      eventName: 'TagResource',
      action: 'tag',
      resourceType: 'other',
      assetType: undefined,
      assetId: 'arn-tail',
      assetName: undefined,
      user: 'ops-user',
    }),
  },
};
