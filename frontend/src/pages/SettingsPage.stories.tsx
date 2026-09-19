import type { Meta, StoryObj } from '@storybook/react-vite';

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

export const SmusNotConfigured: Story = {
  render: () => (
    <AppShell
      path="settings"
      routes={settingsRoutes([
        {
          method: 'get',
          url: '/settings/smus/projects',
          respond: () => ({ body: { success: true, data: { configured: false, projects: [] } } }),
        },
      ])}
    >
      <SettingsPage />
    </AppShell>
  ),
};
