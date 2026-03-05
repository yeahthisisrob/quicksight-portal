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
        component: 'Unified permissions dialog showing all principals with type filter toggles, search, and access source resolution (direct, via group, via folder).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    open: { control: 'boolean', description: 'Controls dialog visibility' },
    assetId: { control: 'text', description: 'Asset identifier' },
    assetName: { control: 'text', description: 'Asset display name' },
    assetType: {
      control: 'select',
      options: ['dashboard', 'analysis', 'dataset', 'datasource', 'folder'],
      description: 'Asset type',
    },
    permissions: { control: 'object', description: 'Permission entries' },
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
    assetId: 'dash-abc123',
    assetName: 'Sales Dashboard Q4 2023',
    assetType: 'dashboard',
    permissions: mockPermissions,
  },
};

export const ManyPermissions: Story = {
  args: {
    open: true,
    assetId: 'dash-enterprise',
    assetName: 'Enterprise Dashboard',
    assetType: 'dashboard',
    permissions: [
      ...Array(8).fill(null).map((_, i) => ({
        principal: `arn:aws:quicksight:us-east-1:123456789012:user/default/user${i}@example.com`,
        principalType: 'USER' as const,
        actions: ['quicksight:DescribeDashboard', 'quicksight:QueryDashboard'],
      })),
      ...Array(4).fill(null).map((_, i) => ({
        principal: `arn:aws:quicksight:us-east-1:123456789012:group/default/Team${['Alpha', 'Beta', 'Gamma', 'Delta'][i]}`,
        principalType: 'GROUP' as const,
        actions: ['quicksight:DescribeDashboard'],
      })),
    ],
  },
};

export const NoPermissions: Story = {
  args: {
    open: true,
    assetId: 'ds-empty',
    assetName: 'Empty Asset',
    assetType: 'datasource',
    permissions: [],
  },
};

export const SingleUser: Story = {
  args: {
    open: true,
    assetId: 'dash-private',
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

export const GroupsOnly: Story = {
  args: {
    open: true,
    assetId: 'dataset-shared',
    assetName: 'Shared Product Dataset',
    assetType: 'dataset',
    permissions: mockPermissions.filter(p => p.principalType === 'GROUP'),
  },
};

export const LongNames: Story = {
  args: {
    open: true,
    assetId: 'analysis-complex',
    assetName: 'Very Long Analysis Name That Might Need Truncation In The Header',
    assetType: 'analysis',
    permissions: [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/very-long-username-that-might-get-truncated@example-company.com',
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
