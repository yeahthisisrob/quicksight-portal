import { Stack } from '@mui/material';

import { Permission } from '@/entities/asset';

import PermissionsCell from './PermissionsCell';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof PermissionsCell> = {
  title: 'Entities/Asset/PermissionsCell',
  component: PermissionsCell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A compact cell component for displaying permission counts grouped by users and groups, using TypedChip components.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    permissions: {
      control: 'object',
      description: 'Array of permission objects',
    },
    onClick: {
      description: 'Optional callback when the cell is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockPermissions: Permission[] = [
  {
    principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/john.doe@example.com',
    principalType: 'USER',
    actions: ['quicksight:DescribeDashboard', 'quicksight:QueryDashboard'],
  },
  {
    principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/jane.smith@example.com',
    principalType: 'USER',
    actions: ['quicksight:DescribeDashboard'],
  },
  {
    principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/DataAnalysts',
    principalType: 'GROUP',
    actions: ['quicksight:DescribeDashboard', 'quicksight:QueryDashboard'],
  },
];

export const Default: Story = {
  args: {
    permissions: mockPermissions,
  },
};

export const UsersOnly: Story = {
  args: {
    permissions: mockPermissions.filter(p => p.principalType === 'USER'),
  },
};

export const GroupsOnly: Story = {
  args: {
    permissions: mockPermissions.filter(p => p.principalType === 'GROUP'),
  },
};

export const SingleUser: Story = {
  args: {
    permissions: [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/admin@example.com',
        principalType: 'USER',
        actions: ['quicksight:*'],
      },
    ],
  },
};

export const SingleGroup: Story = {
  args: {
    permissions: [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Administrators',
        principalType: 'GROUP',
        actions: ['quicksight:*'],
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    permissions: [],
  },
};

export const ManyPermissions: Story = {
  args: {
    permissions: [
      ...Array(15).fill(null).map((_, i) => ({
        principal: `arn:aws:quicksight:us-east-1:123456789012:user/default/user${i}@example.com`,
        principalType: 'USER' as const,
        actions: ['quicksight:DescribeDashboard'],
      })),
      ...Array(5).fill(null).map((_, i) => ({
        principal: `arn:aws:quicksight:us-east-1:123456789012:group/default/Group${i}`,
        principalType: 'GROUP' as const,
        actions: ['quicksight:DescribeDashboard'],
      })),
    ],
  },
};

export const Clickable: Story = {
  args: {
    permissions: mockPermissions,
    onClick: () => alert('Permissions cell clicked!'),
  },
};

export const AllVariations: Story = {
  render: () => (
    <Stack spacing={2}>
      <div>
        <h3>No Permissions</h3>
        <PermissionsCell permissions={[]} />
      </div>
      
      <div>
        <h3>Single User</h3>
        <PermissionsCell 
          permissions={[{
            principal: 'user@example.com',
            principalType: 'USER',
            actions: ['read'],
          }]} 
        />
      </div>
      
      <div>
        <h3>Multiple Users</h3>
        <PermissionsCell 
          permissions={[
            { principal: 'user1@example.com', principalType: 'USER', actions: ['read'] },
            { principal: 'user2@example.com', principalType: 'USER', actions: ['read', 'write'] },
            { principal: 'user3@example.com', principalType: 'USER', actions: ['read'] },
          ]} 
        />
      </div>
      
      <div>
        <h3>Users and Groups</h3>
        <PermissionsCell permissions={mockPermissions} />
      </div>
      
      <div>
        <h3>Large Numbers</h3>
        <PermissionsCell 
          permissions={[
            ...Array(99).fill(null).map((_, i) => ({
              principal: `user${i}@example.com`,
              principalType: 'USER' as const,
              actions: ['read'],
            })),
            ...Array(25).fill(null).map((_, i) => ({
              principal: `Group${i}`,
              principalType: 'GROUP' as const,
              actions: ['read'],
            })),
          ]} 
        />
      </div>
    </Stack>
  ),
};