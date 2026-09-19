import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { type MockRoute, mockApi } from '../../../../.storybook/mocks/api';
import { settingsRoutes } from './__stories__/fixtures';
import { ApiKeysPanel } from './ApiKeysPanel';

function Mocked({ routes: r, children }: { routes: MockRoute[]; children: React.ReactNode }) {
  const [restore] = useState(() => mockApi(r));
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

const meta: Meta = {
  title: 'Features/Settings/ApiKeysPanel',
  component: ApiKeysPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Keys for machine callers. Create one (the secret shows once), see when each was last used, revoke. Type a label and press Create to see the one-time secret dialog.',
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

export const WithKeys: Story = {
  render: () => (
    <Mocked routes={settingsRoutes()}>
      <ApiKeysPanel />
    </Mocked>
  ),
};

export const Empty: Story = {
  render: () => (
    <Mocked
      routes={settingsRoutes([
        {
          method: 'get',
          url: '/settings/api-keys',
          respond: () => ({ body: { success: true, data: { keys: [] } } }),
        },
      ])}
    >
      <ApiKeysPanel />
    </Mocked>
  ),
};

export const LoadError: Story = {
  render: () => (
    <Mocked
      routes={settingsRoutes([
        {
          method: 'get',
          url: '/settings/api-keys',
          respond: () => ({ status: 500, body: { success: false, error: 'Table unavailable' } }),
        },
      ])}
    >
      <ApiKeysPanel />
    </Mocked>
  ),
};
