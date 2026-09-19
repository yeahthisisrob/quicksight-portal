import type { Meta, StoryObj } from '@storybook/react-vite';

import { timelineRoutes } from '@/features/activity/ui/__stories__/fixtures';

import { AppShell } from '../../.storybook/mocks/AppShell';
import ActivityTimelinePage from './ActivityTimelinePage';

/**
 * The landing page as a user sees it: the app shell, the header with the
 * refresh state, and the feed with an agent's burst, a person through the
 * portal, console changes and an AWS service, over a few days.
 */
const meta: Meta<typeof ActivityTimelinePage> = {
  title: 'Pages/Activity',
  component: ActivityTimelinePage,
  parameters: { layout: 'fullscreen', router: { initialEntries: ['/activity'] } },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AppShell path="activity" routes={timelineRoutes()}>
      <ActivityTimelinePage />
    </AppShell>
  ),
};

export const Empty: Story = {
  name: 'Nothing cached yet',
  render: () => (
    <AppShell path="activity" routes={timelineRoutes([])}>
      <ActivityTimelinePage />
    </AppShell>
  ),
};
