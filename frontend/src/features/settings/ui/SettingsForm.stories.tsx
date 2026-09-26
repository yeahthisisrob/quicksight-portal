import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../.storybook/mocks/api';
import { settingsRoutes } from './__stories__/fixtures';
import { SettingsForm } from './SettingsForm';

const meta: Meta = {
  title: 'Features/Settings/SettingsForm',
  component: SettingsForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every settings group the server describes, rendered from its definition: string, select, multiselect (with live options), boolean. Each row shows where its value comes from; a sticky bar appears once something changed.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1040 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  render: () => (
    <MockedApi routes={settingsRoutes()}>
      <SettingsForm />
    </MockedApi>
  ),
};

export const Dirty: Story = {
  render: () => (
    <MockedApi routes={settingsRoutes()}>
      <SettingsForm
        initialDraft={{
          'smus.domainId': 'dzd_newdomain',
          'planner.provider': null,
          'smus.projectIds': ['proj-published-prod', 'proj-published-dev'],
        }}
      />
    </MockedApi>
  ),
};

export const SmusNotConfigured: Story = {
  render: () => (
    <MockedApi
      routes={settingsRoutes([
        {
          method: 'get',
          url: '/settings/smus/projects',
          respond: () => ({
            body: { success: true, data: { configured: false, exportedAt: null, projects: [] } },
          }),
        },
      ])}
    >
      <SettingsForm />
    </MockedApi>
  ),
};

export const LoadError: Story = {
  render: () => (
    <MockedApi
      routes={[
        {
          method: 'get',
          url: '/settings',
          respond: () => ({
            status: 500,
            body: { success: false, error: 'Settings table unavailable' },
          }),
        },
      ]}
    >
      <SettingsForm />
    </MockedApi>
  ),
};

export const NoSettings: Story = {
  render: () => (
    <MockedApi
      routes={[
        {
          method: 'get',
          url: '/settings',
          respond: () => ({ body: { success: true, data: { groups: [] } } }),
        },
      ]}
    >
      <SettingsForm />
    </MockedApi>
  ),
};
