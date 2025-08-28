import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';

import AddToGroupDialog from '../AddToGroupDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AddToGroupDialog> = {
  title: 'Features/Organization/AddToGroupDialog',
  component: AddToGroupDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A dialog component for adding users to groups with modern design system styling.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      // In docs mode, don't render the dialog open by default
      if (context.viewMode === 'docs') {
        return (
          <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Dialog component - Click on a story to see it in action</p>
          </div>
        );
      }
      
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 300000, // 5 minutes
          },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <SnackbarProvider maxSnack={3}>
            <Story />
          </SnackbarProvider>
        </QueryClientProvider>
      );
    },
  ],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls whether the dialog is open',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when dialog is closed',
    },
    onComplete: {
      action: 'completed',
      description: 'Callback when users are successfully added to group',
    },
    selectedUsers: {
      control: 'object',
      description: 'Array of selected users to add to the group',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock groups data
const mockGroups = [
  {
    GroupName: 'Admin Team',
    Description: 'Administrative users with full access',
    memberCount: 12,
  },
  {
    GroupName: 'Sales Department',
    Description: 'Sales team members and managers',
    memberCount: 45,
  },
  {
    GroupName: 'Marketing',
    Description: 'Marketing team with dashboard access',
    memberCount: 23,
  },
  {
    GroupName: 'Finance',
    Description: 'Finance team with restricted access to financial data',
    memberCount: 18,
  },
  {
    GroupName: 'Data Analysts',
    Description: 'Users with dataset creation permissions',
    memberCount: 8,
  },
  {
    GroupName: 'Executives',
    Description: 'C-level executives with read-only dashboard access',
    memberCount: 5,
  },
];

// Note: Mock API response is handled inline in decorators

// Create a decorator that mocks the API call
const createMockDecorator = (mockGroups: any[]) => (Story: any) => {
  // Mock the assetsApi.getGroupsPaginated function
  (window as any).__STORYBOOK_MOCK_API__ = {
    getGroupsPaginated: () => Promise.resolve({ groups: mockGroups }),
  };

  return <Story />;
};

export const SingleUser: Story = {
  args: {
    open: true,
    selectedUsers: [
      { userName: 'john.doe', email: 'john.doe@example.com' },
    ],
  },
  decorators: [createMockDecorator(mockGroups)],
};

export const MultipleUsers: Story = {
  args: {
    open: true,
    selectedUsers: [
      { userName: 'john.doe', email: 'john.doe@example.com' },
      { userName: 'jane.smith', email: 'jane.smith@example.com' },
      { userName: 'bob.johnson', email: 'bob.johnson@example.com' },
      { userName: 'alice.williams', email: 'alice.williams@example.com' },
      { userName: 'charlie.brown', email: 'charlie.brown@example.com' },
    ],
  },
  decorators: [createMockDecorator(mockGroups)],
};

export const ManyUsers: Story = {
  args: {
    open: true,
    selectedUsers: Array.from({ length: 25 }, (_, i) => ({
      userName: `user${i + 1}`,
      email: `user${i + 1}@example.com`,
    })),
  },
  decorators: [createMockDecorator(mockGroups)],
};

export const UsersWithoutEmail: Story = {
  args: {
    open: true,
    selectedUsers: [
      { userName: 'john.doe' },
      { userName: 'jane.smith' },
      { userName: 'bob.johnson' },
    ],
  },
  decorators: [createMockDecorator(mockGroups)],
};

export const MixedUsers: Story = {
  args: {
    open: true,
    selectedUsers: [
      { userName: 'john.doe', email: 'john.doe@example.com' },
      { userName: 'jane.smith' },
      { userName: 'bob.johnson', email: 'bob.johnson@example.com' },
      { userName: 'alice.williams' },
      { userName: 'charlie.brown', email: 'charlie.brown@example.com' },
    ],
  },
  decorators: [createMockDecorator(mockGroups)],
};

export const NoGroups: Story = {
  args: {
    open: true,
    selectedUsers: [
      { userName: 'john.doe', email: 'john.doe@example.com' },
    ],
  },
  decorators: [createMockDecorator([])],
};

export const SingleGroup: Story = {
  args: {
    open: true,
    selectedUsers: [
      { userName: 'john.doe', email: 'john.doe@example.com' },
    ],
  },
  decorators: [createMockDecorator([mockGroups[0]])],
};

export const LongUserNames: Story = {
  args: {
    open: true,
    selectedUsers: [
      { 
        userName: 'alexanderdavid.smithsonwilliams', 
        email: 'alexanderdavid.smithsonwilliams@very-long-company-domain-name.com' 
      },
      { 
        userName: 'jennifer.elizabethmarie.andersonjohnson', 
        email: 'j.andersonjohnson@enterprise.co.uk' 
      },
      { 
        userName: 'christopher.benjamin.rodriguez', 
        email: 'cbr@corp.io' 
      },
    ],
  },
  decorators: [createMockDecorator(mockGroups)],
};

export const Loading: Story = {
  args: {
    open: true,
    selectedUsers: [
      { userName: 'john.doe', email: 'john.doe@example.com' },
    ],
  },
  decorators: [(Story) => {
    // Mock API to never resolve, keeping the loading state
    (window as any).__STORYBOOK_MOCK_API__ = {
      getGroupsPaginated: () => new Promise(() => {}),
    };
    return <Story />;
  }],
};

export const Closed: Story = {
  args: {
    open: false,
    selectedUsers: [
      { userName: 'john.doe', email: 'john.doe@example.com' },
    ],
  },
  decorators: [createMockDecorator(mockGroups)],
};