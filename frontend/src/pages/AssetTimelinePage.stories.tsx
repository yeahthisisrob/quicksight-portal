import type { Meta, StoryObj } from '@storybook/react-vite';

import { timelineRoutes } from '@/features/activity/ui/__stories__/fixtures';

import { AppShell } from '../../.storybook/mocks/AppShell';
import AssetTimelinePage from './AssetTimelinePage';

/** One dashboard's history, reached from the row menu's "View timeline". */
const meta: Meta<typeof AssetTimelinePage> = {
  title: 'Pages/Asset timeline',
  component: AssetTimelinePage,
  parameters: {
    layout: 'fullscreen',
    router: { initialEntries: ['/assets/dashboards/sales-overview/timeline'] },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {
  render: () => (
    <AppShell path="assets/:type/:id/timeline" routes={timelineRoutes()}>
      <AssetTimelinePage />
    </AppShell>
  ),
};
