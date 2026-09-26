import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { mockApi } from '../../../../../../../.storybook/mocks/api';
import PermissionsDialog from '../PermissionsDialog';

const ARN = 'arn:aws:quicksight:us-east-1:123456789012';
const DESCRIBE = 'quicksight:DescribeDashboard';
const QUERY = 'quicksight:QueryDashboard';
const UPDATE = 'quicksight:UpdateDashboard';

/**
 * How each principal reaches the asset, from GET .../permission-sources: a
 * user with direct access who is also in a group, and a user and a group
 * that only reach it through a folder (so they are not in `permissions`).
 */
const permissionSources = {
  userAccessSources: [
    {
      userName: 'john.doe@example.com',
      userArn: `${ARN}:user/default/john.doe@example.com`,
      sources: [
        { type: 'direct', actions: [DESCRIBE, QUERY] },
        { type: 'group', groupName: 'DataAnalysts', actions: [DESCRIBE, QUERY] },
      ],
    },
    {
      userName: 'folder.viewer@example.com',
      userArn: `${ARN}:user/default/folder.viewer@example.com`,
      sources: [
        {
          type: 'folder',
          folderName: 'Sales',
          folderPath: '/Company/Sales',
          actions: [DESCRIBE],
        },
      ],
    },
  ],
  groupAccessSources: [
    {
      groupName: 'DataAnalysts',
      groupArn: `${ARN}:group/default/DataAnalysts`,
      sources: [{ type: 'direct', actions: [DESCRIBE, QUERY] }],
    },
    {
      groupName: 'Finance',
      groupArn: `${ARN}:group/default/Finance`,
      sources: [
        {
          type: 'folder',
          folderName: 'Sales',
          folderPath: '/Company/Sales',
          groupName: 'Finance',
          actions: [DESCRIBE],
        },
      ],
    },
  ],
};

function Stubbed({ children }: { children: React.ReactNode }) {
  // Installed during render: the dialog fetches its sources on mount.
  const [restore] = useState(() =>
    mockApi([
      {
        method: 'get',
        url: '/permission-sources',
        respond: () => ({ body: { success: true, data: permissionSources } }),
      },
    ])
  );
  useEffect(() => restore, [restore]);
  return <>{children}</>;
}

const meta = {
  title: 'Widgets/AssetDialogs/PermissionsDialog',
  component: PermissionsDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Every principal with access, with type filter toggles, search, and where the access comes from (direct, via group, via folder).',
      },
    },
  },
  decorators: [
    (Story) => (
      <Stubbed>
        <Story />
      </Stubbed>
    ),
  ],
  args: {
    open: true,
    onClose: () => {},
    assetId: 'dash-abc123',
    assetName: 'Sales Dashboard Q4 2023',
    assetType: 'dashboard',
  },
} satisfies Meta<typeof PermissionsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    permissions: [
      {
        principal: `${ARN}:user/default/john.doe@example.com`,
        principalType: 'USER',
        actions: [DESCRIBE, QUERY],
      },
      {
        principal: `${ARN}:user/default/jane.smith@example.com`,
        principalType: 'USER',
        actions: [DESCRIBE, UPDATE, 'quicksight:DeleteDashboard'],
      },
      {
        principal: `${ARN}:group/default/DataAnalysts`,
        principalType: 'GROUP',
        actions: [DESCRIBE, QUERY],
      },
    ],
  },
};

export const NoPermissions: Story = {
  args: {
    assetId: 'ds-empty',
    assetName: 'Empty Asset',
    assetType: 'datasource',
    permissions: [],
  },
};
