import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi, type MockRoute } from '../../../../../.storybook/mocks/api';
import AddToGroupDialog from '../AddToGroupDialog';

const GROUPS = [
  { name: 'Admin Team', description: 'Administrative users with full access', memberCount: 12 },
  { name: 'Sales Department', description: 'Sales team members and managers', memberCount: 45 },
  { name: 'Marketing', description: 'Marketing team with dashboard access', memberCount: 23 },
  { name: 'Data Analysts', description: 'Users with dataset creation permissions', memberCount: 8 },
];

const groupsRoute = (respond: MockRoute['respond']): MockRoute[] => [
  { method: 'get', url: '/assets/groups/paginated', respond },
];

const withGroups = (groups: typeof GROUPS) =>
  groupsRoute(() => ({ body: { success: true, data: { groups } } }));

const meta = {
  title: 'Features/Organization/AddToGroupDialog',
  component: AddToGroupDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Adds the selected users to a QuickSight group, running as a membership job.',
      },
    },
  },
  args: {
    open: true,
    onClose: () => {},
    onComplete: () => {},
    selectedUsers: [{ userName: 'john.doe', email: 'john.doe@example.com' }],
  },
  render: (args, { parameters }) => (
    <MockedApi routes={(parameters.routes as MockRoute[] | undefined) ?? withGroups(GROUPS)}>
      <AddToGroupDialog {...args} />
    </MockedApi>
  ),
} satisfies Meta<typeof AddToGroupDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** More users than chips: the rest collapse into "+N more". */
export const ManyUsers: Story = {
  args: {
    selectedUsers: Array.from({ length: 25 }, (_, i) => ({
      userName: `user${i + 1}`,
      email: `user${i + 1}@example.com`,
    })),
  },
};

/**
 * The bulk path hands the dialog users-grid rows (`name` / `id`, no
 * `userName`), which once serialised as `[null]`; a legacy `{ userName }`
 * selection must still work, and a user with neither shows as an error chip.
 */
export const MixedUserShapes: Story = {
  args: {
    selectedUsers: [
      { id: 'u-1', name: 'john.doe', email: 'john.doe@example.com' },
      { userName: 'jane.smith', email: 'jane.smith@example.com' },
      { email: 'no-user-name@example.com' },
    ],
  },
};

export const NoGroups: Story = {
  parameters: { routes: withGroups([]) },
};

export const Loading: Story = {
  parameters: { routes: groupsRoute(() => new Promise(() => {})) },
};
