import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FoldersProvider } from '@/entities/folder';

import FolderMembersDialog from '../FolderMembersDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof FolderMembersDialog> = {
  title: 'Features/Organization/FolderMembersDialog',
  component: FolderMembersDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A dialog component for viewing and managing folder members with a modern, sleek design.',
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
      return <Story />;
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
    folder: {
      control: 'object',
      description: 'The folder object containing FolderId and Name',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data for different scenarios
const mockMembers = {
  mixed: [
    { MemberId: 'dashboard-1', MemberType: 'DASHBOARD', MemberName: 'Sales Dashboard Q4 2024' },
    { MemberId: 'dashboard-2', MemberType: 'DASHBOARD', MemberName: 'Customer Analytics Dashboard' },
    { MemberId: 'analysis-1', MemberType: 'ANALYSIS', MemberName: 'Revenue Trend Analysis' },
    { MemberId: 'analysis-2', MemberType: 'ANALYSIS', MemberName: 'Market Segmentation Study' },
    { MemberId: 'dataset-1', MemberType: 'DATASET', MemberName: 'Sales Data 2024' },
    { MemberId: 'dataset-2', MemberType: 'DATASET', MemberName: 'Customer Demographics' },
    { MemberId: 'datasource-1', MemberType: 'DATASOURCE', MemberName: 'Production Database' },
  ],
  dashboardsOnly: [
    { MemberId: 'dashboard-1', MemberType: 'DASHBOARD', MemberName: 'Executive Summary Dashboard' },
    { MemberId: 'dashboard-2', MemberType: 'DASHBOARD', MemberName: 'Operations Dashboard' },
    { MemberId: 'dashboard-3', MemberType: 'DASHBOARD', MemberName: 'Finance Dashboard' },
  ],
  empty: [],
};

// Create a custom decorator for mocking API responses
const createMockDecorator = (members: any[]) => (Story: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  // Mock the API call
  queryClient.setQueryData(['folder-members', 'folder-123'], members);

  return (
    <QueryClientProvider client={queryClient}>
      <FoldersProvider>
        <Story />
      </FoldersProvider>
    </QueryClientProvider>
  );
};

export const Default: Story = {
  args: {
    open: true,
    folder: {
      FolderId: 'folder-123',
      Name: 'Q4 2024 Reports',
    },
  },
  decorators: [createMockDecorator(mockMembers.mixed)],
};

export const EmptyFolder: Story = {
  args: {
    open: true,
    folder: {
      FolderId: 'folder-empty',
      Name: 'New Project Folder',
    },
  },
  decorators: [createMockDecorator(mockMembers.empty)],
};

export const DashboardsOnly: Story = {
  args: {
    open: true,
    folder: {
      FolderId: 'folder-dashboards',
      Name: 'Executive Dashboards',
    },
  },
  decorators: [createMockDecorator(mockMembers.dashboardsOnly)],
};

export const LongNames: Story = {
  args: {
    open: true,
    folder: {
      FolderId: 'folder-long',
      Name: 'Enterprise Resource Planning and Business Intelligence Reports Collection',
    },
  },
  decorators: [createMockDecorator([
    { 
      MemberId: 'analysis-long-1', 
      MemberType: 'ANALYSIS', 
      MemberName: 'Comprehensive Market Analysis Report for North American Regional Sales Performance Q4 2024' 
    },
    { 
      MemberId: 'dataset-long-1', 
      MemberType: 'DATASET', 
      MemberName: 'Consolidated Customer Transaction History with Demographic Enrichment Data 2020-2024' 
    },
  ])],
};

export const Loading: Story = {
  args: {
    open: true,
    folder: {
      FolderId: 'folder-loading',
      Name: 'Loading Example',
    },
  },
  decorators: [(Story) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // This will keep the query in loading state
          staleTime: 0,
          refetchInterval: false,
        },
      },
    });

    return (
      <QueryClientProvider client={queryClient}>
        <FoldersProvider>
          <Story />
        </FoldersProvider>
      </QueryClientProvider>
    );
  }],
};