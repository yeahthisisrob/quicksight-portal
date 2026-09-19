import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { Container } from '@/shared/design-system';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import { timelineRoutes } from './__stories__/fixtures';
import { TimelineFeed } from './TimelineFeed';

function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

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
    <Mocked routes={timelineRoutes()}>
      <TimelineFeed />
    </Mocked>
  ),
};

export const AgentsOnly: Story = {
  render: () => (
    <Mocked routes={timelineRoutes()}>
      <TimelineFeed initialFilters={{ origins: ['portal-api'] }} />
    </Mocked>
  ),
};

export const PinnedToAnAsset: Story = {
  render: () => (
    <Mocked routes={timelineRoutes()}>
      <TimelineFeed assetPin={{ assetType: 'dashboard', assetId: 'sales-overview' }} />
    </Mocked>
  ),
};

export const Empty: Story = {
  render: () => (
    <Mocked routes={timelineRoutes([])}>
      <TimelineFeed />
    </Mocked>
  ),
};

export const LoadError: Story = {
  render: () => (
    <Mocked
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
    </Mocked>
  ),
};
