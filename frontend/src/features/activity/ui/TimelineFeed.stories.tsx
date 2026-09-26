import type { Meta, StoryObj } from '@storybook/react-vite';

import { Container } from '@/shared/design-system';

import { MockedApi } from '../../../../.storybook/mocks/api';
import { timelineRoutes } from './__stories__/fixtures';
import { TimelineFeed } from './TimelineFeed';

const FEED_HEIGHT = 720;

const meta: Meta<typeof TimelineFeed> = {
  title: 'Features/Activity/TimelineFeed',
  component: TimelineFeed,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Days with sticky headers; inside a day, bursts by the same actor on the same asset collapse to one row. The API is stubbed with a realistic few days.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Container disableContentPadding sx={{ maxWidth: 1100, height: FEED_HEIGHT }}>
        <Story />
      </Container>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TimelineFeed>;

export const MixedDays: Story = {
  render: () => (
    <MockedApi routes={timelineRoutes()}>
      <TimelineFeed />
    </MockedApi>
  ),
};

export const PinnedToAnAsset: Story = {
  render: () => (
    <MockedApi routes={timelineRoutes()}>
      <TimelineFeed assetPin={{ assetType: 'dashboard', assetId: 'sales-overview' }} />
    </MockedApi>
  ),
};

export const Empty: Story = {
  render: () => (
    <MockedApi routes={timelineRoutes([])}>
      <TimelineFeed />
    </MockedApi>
  ),
};

export const LoadError: Story = {
  render: () => (
    <MockedApi
      routes={[
        {
          method: 'get',
          url: /\/activity\/timeline/,
          respond: () => ({
            status: 500,
            body: { success: false, error: 'The activity cache could not be read' },
          }),
        },
      ]}
    >
      <TimelineFeed />
    </MockedApi>
  ),
};
