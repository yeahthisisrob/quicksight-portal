import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { MockedApi, type MockRoute } from '../../../../.storybook/mocks/api';
import { RefreshScheduleDialog } from './RefreshScheduleDialog';

const SCHEDULES = [
  {
    scheduleId: 'daily',
    scheduleFrequency: { interval: 'DAILY', timeOfTheDay: '06:00', timezone: 'America/New_York' },
    startAfterDateTime: '2026-07-29T15:44:00.000Z',
    refreshType: 'FULL_REFRESH',
    arn: 'arn:aws:quicksight:us-east-1:1:dataset/ds-orders/refresh-schedule/daily',
  },
  {
    scheduleId: 'weekly',
    scheduleFrequency: {
      interval: 'WEEKLY',
      refreshOnDay: { dayOfWeek: 'MONDAY' },
      timeOfTheDay: '08:00',
      timezone: 'UTC',
    },
    refreshType: 'INCREMENTAL_REFRESH',
    arn: 'arn:aws:quicksight:us-east-1:1:dataset/ds-orders/refresh-schedule/weekly',
  },
];

const routes = (schedules = SCHEDULES): MockRoute[] => [
  {
    method: 'get',
    url: /\/assets\/dataset\/[^/]+\/refresh-schedules$/,
    respond: () => ({ body: { success: true, data: { schedules } } }),
  },
  {
    method: 'post',
    url: /\/assets\/dataset\/[^/]+\/refresh-schedules$/,
    respond: () => ({ status: 201, body: { success: true, data: schedules[0] } }),
  },
  {
    method: 'post',
    url: /\/ingestions\/[^/]+$/,
    respond: () => ({
      status: 201,
      body: {
        success: true,
        data: {
          id: 'portal-1',
          datasetId: 'ds-orders',
          status: 'INITIALIZED',
          createdTime: '2026-10-15T08:00:00.000Z',
        },
      },
    }),
  },
];

/**
 * A dataset's refreshes: schedules read live, each one changed or removed,
 * a new one added, and a SPICE refresh started now.
 */
const meta: Meta<typeof RefreshScheduleDialog> = {
  title: 'Entities/Dataset/RefreshScheduleDialog',
  component: RefreshScheduleDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onClose: fn(),
    dataset: { id: 'ds-orders', name: 'Orders', importMode: 'SPICE' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSchedules: Story = {
  render: (args) => (
    <MockedApi routes={routes()}>
      <RefreshScheduleDialog {...args} />
    </MockedApi>
  ),
};

export const NoSchedules: Story = {
  render: (args) => (
    <MockedApi routes={routes([])}>
      <RefreshScheduleDialog {...args} />
    </MockedApi>
  ),
};

export const DirectQuery: Story = {
  args: { dataset: { id: 'ds-live', name: 'Live orders', importMode: 'DIRECT_QUERY' } },
  render: (args) => (
    <MockedApi routes={routes([])}>
      <RefreshScheduleDialog {...args} />
    </MockedApi>
  ),
};
