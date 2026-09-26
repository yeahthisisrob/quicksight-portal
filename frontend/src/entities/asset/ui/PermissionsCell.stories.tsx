import type { Meta, StoryObj } from '@storybook/react-vite';

import PermissionsCell from './PermissionsCell';

const meta = {
  title: 'Entities/Asset/PermissionsCell',
  component: PermissionsCell,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A compact cell showing permission counts by principal type (public, namespace, users, groups), using TypedChip components.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PermissionsCell>;

export default meta;
type Story = StoryObj<typeof meta>;

const arn = (kind: string, name: string) =>
  `arn:aws:quicksight:us-east-1:123456789012:${kind}/default/${name}`;

/** Every principal type at once, clickable (it opens the permissions dialog in the table). */
export const Default: Story = {
  args: {
    onClick: () => {},
    permissions: [
      { principal: '*', principalType: 'PUBLIC', actions: ['quicksight:DescribeDashboard'] },
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
        principalType: 'NAMESPACE',
        actions: ['quicksight:DescribeDashboard'],
      },
      ...Array.from({ length: 15 }, (_, i) => ({
        principal: arn('user', `user${i}@example.com`),
        principalType: 'USER' as const,
        actions: ['quicksight:DescribeDashboard'],
      })),
      {
        principal: arn('group', 'DataAnalysts'),
        principalType: 'GROUP',
        actions: ['quicksight:DescribeDashboard', 'quicksight:QueryDashboard'],
      },
    ],
  },
};

export const Empty: Story = {
  args: { permissions: [] },
};
