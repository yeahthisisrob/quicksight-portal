import type { Meta, StoryObj } from '@storybook/react-vite';
import { within } from 'storybook/test';

import { settingsRoutes } from '@/features/settings/ui/__stories__/fixtures';

import { AppShell } from '../../.storybook/mocks/AppShell';
import SettingsPage from './SettingsPage';

/** The Settings page in the app shell, API stubbed. Edit a value to see the save bar. */
const meta: Meta<typeof SettingsPage> = {
  title: 'Pages/Settings',
  component: SettingsPage,
  parameters: { layout: 'fullscreen', router: { initialEntries: ['/settings'] } },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AppShell path="settings" routes={settingsRoutes()}>
      <SettingsPage />
    </AppShell>
  ),
};

/** The Schedules section, deep-linked: cadences, and where each run stands. */
export const Schedules: Story = {
  parameters: { router: { initialEntries: ['/settings?section=schedules'] } },
  render: () => (
    <AppShell path="settings" routes={settingsRoutes()}>
      <SettingsPage />
    </AppShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('schedules-status');
    await canvas.findByText('Running now');
  },
};
