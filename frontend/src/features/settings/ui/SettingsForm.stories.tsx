import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import { settingsRoutes } from './__stories__/fixtures';
import { SettingsForm } from './SettingsForm';

/** Installed during render, before the form's first request. */
function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

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
    <Mocked routes={settingsRoutes()}>
      <SettingsForm />
    </Mocked>
  ),
};

export const Dirty: Story = {
  render: () => (
    <Mocked routes={settingsRoutes()}>
      <SettingsForm
        initialDraft={{
          'smus.domainId': 'dzd_newdomain',
          'planner.provider': null,
          'smus.projectIds': ['proj-published-prod', 'proj-published-dev'],
        }}
      />
    </Mocked>
  ),
};

export const SavingError: Story = {
  render: () => (
    <Mocked
      routes={settingsRoutes([
        {
          method: 'put',
          url: '/settings',
          respond: () => ({
            status: 400,
            body: { success: false, error: "Unknown setting 'smus.domainId'" },
          }),
        },
      ])}
    >
      <SettingsForm initialDraft={{ 'smus.domainId': 'dzd_newdomain' }} />
    </Mocked>
  ),
};

export const SmusNotConfigured: Story = {
  render: () => (
    <Mocked
      routes={settingsRoutes([
        {
          method: 'get',
          url: '/settings/smus/projects',
          respond: () => ({ body: { success: true, data: { configured: false, projects: [] } } }),
        },
      ])}
    >
      <SettingsForm />
    </Mocked>
  ),
};

export const LoadError: Story = {
  render: () => (
    <Mocked
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
    </Mocked>
  ),
};

export const NoSettings: Story = {
  render: () => (
    <Mocked
      routes={[
        {
          method: 'get',
          url: '/settings',
          respond: () => ({ body: { success: true, data: { groups: [] } } }),
        },
      ]}
    >
      <SettingsForm />
    </Mocked>
  ),
};
