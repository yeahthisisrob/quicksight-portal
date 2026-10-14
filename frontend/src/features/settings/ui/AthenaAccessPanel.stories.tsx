import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi } from '../../../../.storybook/mocks/api';
import { ATHENA_ACCESS, settingsRoutes } from './__stories__/fixtures';
import { AthenaAccessPanel } from './AthenaAccessPanel';

const meta: Meta = {
  title: 'Features/Settings/AthenaAccessPanel',
  component: AthenaAccessPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Whether the portal's role can read each governed database through Athena, as Lake Formation lets it, with the one-time admin command for the ones it cannot. Hidden without SMUS.",
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

/** One database readable, one partly hidden, one hidden: the command names the last two. */
export const NeedsGrants: Story = {
  render: () => (
    <MockedApi routes={settingsRoutes()}>
      <AthenaAccessPanel />
    </MockedApi>
  ),
};

export const AllReadable: Story = {
  render: () => (
    <MockedApi
      routes={settingsRoutes([
        {
          method: 'get',
          url: '/settings/athena-access',
          respond: () => ({
            body: {
              success: true,
              data: {
                ...ATHENA_ACCESS,
                databases: ATHENA_ACCESS.databases.map((d) => ({
                  ...d,
                  visible: 'all',
                  hiddenTables: [],
                  error: undefined,
                })),
                commands: [],
                awsCli: [],
              },
            },
          }),
        },
      ])}
    >
      <AthenaAccessPanel />
    </MockedApi>
  ),
};

export const NothingPublishedYet: Story = {
  render: () => (
    <MockedApi
      routes={settingsRoutes([
        {
          method: 'get',
          url: '/settings/athena-access',
          respond: () => ({
            body: {
              success: true,
              data: { ...ATHENA_ACCESS, databases: [], commands: [], awsCli: [] },
            },
          }),
        },
      ])}
    >
      <AthenaAccessPanel />
    </MockedApi>
  ),
};
