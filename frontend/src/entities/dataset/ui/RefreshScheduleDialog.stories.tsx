import { RefreshScheduleDialog } from './RefreshScheduleDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof RefreshScheduleDialog> = {
  title: 'Entities/Dataset/RefreshScheduleDialog',
  component: RefreshScheduleDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the dialog is open',
    },
    datasetName: {
      control: 'text',
      description: 'Name of the dataset',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockRefreshSchedules = [
  {
    scheduleId: 'b402358d-771d-483e-9679-6d46ddb3ae8d',
    scheduleFrequency: {
      interval: 'DAILY' as const,
      timeOfTheDay: '11:44',
      timezone: 'America/New_York',
    },
    startAfterDateTime: '2025-07-29T15:44:00.000Z',
    refreshType: 'FULL_REFRESH' as const,
    arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/4b1f052b-2ae1-4059-af73-211445694d63/refresh-schedule/b402358d-771d-483e-9679-6d46ddb3ae8d',
  },
  {
    scheduleId: '969836cf-26f6-46e8-ae6b-612d6775a9cf',
    scheduleFrequency: {
      interval: 'WEEKLY' as const,
      refreshOnDay: {
        dayOfWeek: 'MONDAY' as const,
      },
      timeOfTheDay: '08:00',
      timezone: 'America/New_York',
    },
    startAfterDateTime: '2025-07-29T12:03:00.000Z',
    refreshType: 'INCREMENTAL_REFRESH' as const,
    arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/95ce201a-3fcb-4831-91dc-1c41af6d41d6/refresh-schedule/969836cf-26f6-46e8-ae6b-612d6775a9cf',
  },
];

const mockRefreshProperties = {
  failureConfiguration: {
    emailAlert: {
      alertStatus: 'ENABLED',
    },
  },
  refreshConfiguration: {
    incrementalRefresh: {
      lookbackWindow: {
        columnName: 'updated_date',
        size: 7,
        sizeUnit: 'DAY',
      },
    },
  },
};

export const Default: Story = {
  args: {
    open: true,
    datasetName: 'Sales Data',
    refreshSchedules: mockRefreshSchedules,
    dataSetRefreshProperties: mockRefreshProperties,
  },
};

export const SingleSchedule: Story = {
  args: {
    open: true,
    datasetName: 'Customer Analytics',
    refreshSchedules: [mockRefreshSchedules[0]],
    dataSetRefreshProperties: mockRefreshProperties,
  },
};

export const NoSchedules: Story = {
  args: {
    open: true,
    datasetName: 'Static Dataset',
    refreshSchedules: [],
    dataSetRefreshProperties: undefined,
  },
};

export const OnlyProperties: Story = {
  args: {
    open: true,
    datasetName: 'Config Only Dataset',
    refreshSchedules: [],
    dataSetRefreshProperties: {
      failureConfiguration: {
        emailAlert: {
          alertStatus: 'DISABLED',
        },
      },
    },
  },
};

export const HourlySchedule: Story = {
  args: {
    open: true,
    datasetName: 'Real-time Dashboard Data',
    refreshSchedules: [
      {
        scheduleId: 'hourly-123',
        scheduleFrequency: {
          interval: 'HOURLY' as const,
          timezone: 'UTC',
        },
        refreshType: 'INCREMENTAL_REFRESH' as const,
        arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/hourly-dataset/refresh-schedule/hourly-123',
      },
    ],
  },
};

export const MonthlySchedule: Story = {
  args: {
    open: true,
    datasetName: 'Monthly Reports',
    refreshSchedules: [
      {
        scheduleId: 'monthly-456',
        scheduleFrequency: {
          interval: 'MONTHLY' as const,
          refreshOnDay: {
            dayOfMonth: '1',
          },
          timeOfTheDay: '02:00',
          timezone: 'America/New_York',
        },
        refreshType: 'FULL_REFRESH' as const,
        arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/monthly-dataset/refresh-schedule/monthly-456',
      },
    ],
    dataSetRefreshProperties: {
      failureConfiguration: {
        emailAlert: {
          alertStatus: 'ENABLED',
        },
      },
    },
  },
};