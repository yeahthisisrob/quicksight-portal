import { Permission } from '@/entities/asset';

import PermissionsDialog from '../PermissionsDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof PermissionsDialog> = {
  title: 'Widgets/AssetDialogs/PermissionsDialog',
  component: PermissionsDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A dialog component for displaying asset permissions, showing users and groups with their respective permission counts.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls the visibility of the dialog',
    },
    onClose: {
      description: 'Callback when the dialog is closed',
    },
    assetName: {
      control: 'text',
      description: 'Name of the asset',
    },
    assetType: {
      control: 'select',
      options: ['dashboard', 'analysis', 'dataset', 'datasource'],
      description: 'Type of the asset',
    },
    permissions: {
      control: 'object',
      description: 'Array of permissions',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockPermissions: Permission[] = [
  {
    principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/john.doe@example.com',
    principalType: 'USER',
    actions: ['quicksight:DescribeDashboard', 'quicksight:ListDashboardVersions', 'quicksight:QueryDashboard'],
  },
  {
    principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/jane.smith@example.com',
    principalType: 'USER',
    actions: ['quicksight:DescribeDashboard', 'quicksight:UpdateDashboard', 'quicksight:DeleteDashboard'],
  },
  {
    principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/DataAnalysts',
    principalType: 'GROUP',
    actions: ['quicksight:DescribeDashboard', 'quicksight:QueryDashboard'],
  },
  {
    principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Administrators',
    principalType: 'GROUP',
    actions: [
      'quicksight:DescribeDashboard',
      'quicksight:UpdateDashboard',
      'quicksight:DeleteDashboard',
      'quicksight:UpdateDashboardPermissions',
    ],
  },
];

export const Default: Story = {
  args: {
    open: true,
    assetName: 'Sales Dashboard Q4 2023',
    assetType: 'dashboard',
    permissions: mockPermissions,
  },
};

export const UsersOnly: Story = {
  args: {
    open: true,
    assetName: 'Customer Analysis',
    assetType: 'analysis',
    permissions: mockPermissions.filter(p => p.principalType === 'USER'),
  },
};

export const GroupsOnly: Story = {
  args: {
    open: true,
    assetName: 'Product Catalog Dataset',
    assetType: 'dataset',
    permissions: mockPermissions.filter(p => p.principalType === 'GROUP'),
  },
};

export const NoPermissions: Story = {
  args: {
    open: true,
    assetName: 'Empty Asset',
    assetType: 'datasource',
    permissions: [],
  },
};

export const SingleUser: Story = {
  args: {
    open: true,
    assetName: 'Private Dashboard',
    assetType: 'dashboard',
    permissions: [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/owner@example.com',
        principalType: 'USER',
        actions: ['quicksight:*'],
      },
    ],
  },
};

export const ManyPermissions: Story = {
  args: {
    open: true,
    assetName: 'Enterprise Dashboard',
    assetType: 'dashboard',
    permissions: [
      ...Array(5).fill(null).map((_, i) => ({
        principal: `arn:aws:quicksight:us-east-1:123456789012:user/default/user${i}@example.com`,
        principalType: 'USER' as const,
        actions: ['quicksight:DescribeDashboard', 'quicksight:QueryDashboard'],
      })),
      ...Array(3).fill(null).map((_, i) => ({
        principal: `arn:aws:quicksight:us-east-1:123456789012:group/default/Group${i}`,
        principalType: 'GROUP' as const,
        actions: ['quicksight:DescribeDashboard'],
      })),
    ],
  },
};

export const LongPrincipalNames: Story = {
  args: {
    open: true,
    assetName: 'Complex Asset',
    assetType: 'analysis',
    permissions: [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/very-long-username-that-might-get-truncated@example-company-with-long-domain.com',
        principalType: 'USER',
        actions: ['quicksight:DescribeAnalysis'],
      },
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/VeryLongGroupNameForDataScientistsAndAnalysts',
        principalType: 'GROUP',
        actions: ['quicksight:DescribeAnalysis', 'quicksight:QueryAnalysis'],
      },
    ],
  },
};

export const NoActionsPermission: Story = {
  args: {
    open: true,
    assetName: 'Restricted Asset',
    assetType: 'dataset',
    permissions: [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/restricted@example.com',
        principalType: 'USER',
        actions: [],
      },
    ],
  },
};