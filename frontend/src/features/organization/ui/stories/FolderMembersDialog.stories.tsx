import type { Meta, StoryObj } from '@storybook/react-vite';

import { FoldersProvider } from '@/entities/folder';

import { MockedApi, type MockRoute } from '../../../../../.storybook/mocks/api';
import FolderMembersDialog from '../FolderMembersDialog';

interface Member {
  MemberId: string;
  MemberType: string;
  MemberName: string;
}

const MIXED: Member[] = [
  { MemberId: 'dashboard-1', MemberType: 'DASHBOARD', MemberName: 'Sales Dashboard Q4 2024' },
  { MemberId: 'dashboard-2', MemberType: 'DASHBOARD', MemberName: 'Customer Analytics Dashboard' },
  { MemberId: 'analysis-1', MemberType: 'ANALYSIS', MemberName: 'Revenue Trend Analysis' },
  { MemberId: 'analysis-2', MemberType: 'ANALYSIS', MemberName: 'Market Segmentation Study' },
  { MemberId: 'dataset-1', MemberType: 'DATASET', MemberName: 'Sales Data 2024' },
  { MemberId: 'dataset-2', MemberType: 'DATASET', MemberName: 'Customer Demographics' },
  { MemberId: 'datasource-1', MemberType: 'DATASOURCE', MemberName: 'Production Database' },
];

const membersRoute = (respond: MockRoute['respond']): MockRoute[] => [
  { method: 'get', url: /\/folders\/[^/]+\/members$/, respond },
];

const withMembers = (members: Member[]) =>
  membersRoute(() => ({ body: { success: true, data: members } }));

const meta = {
  title: 'Features/Organization/FolderMembersDialog',
  component: FolderMembersDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'The assets in a folder, grouped by type, with open and remove actions.',
      },
    },
  },
  args: {
    open: true,
    onClose: () => {},
    folder: { FolderId: 'folder-mixed', Name: 'Q4 2024 Reports' },
  },
  render: (args, { parameters }) => (
    <MockedApi routes={(parameters.routes as MockRoute[] | undefined) ?? withMembers(MIXED)}>
      <FoldersProvider>
        <FolderMembersDialog {...args} />
      </FoldersProvider>
    </MockedApi>
  ),
} satisfies Meta<typeof FolderMembersDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Each story uses its own folder id: the preview's query client is shared.

export const Default: Story = {};

export const EmptyFolder: Story = {
  args: { folder: { FolderId: 'folder-empty', Name: 'New Project Folder' } },
  parameters: { routes: withMembers([]) },
};

export const LongNames: Story = {
  args: {
    folder: {
      FolderId: 'folder-long',
      Name: 'Enterprise Resource Planning and Business Intelligence Reports Collection',
    },
  },
  parameters: {
    routes: withMembers([
      {
        MemberId: 'analysis-long-1',
        MemberType: 'ANALYSIS',
        MemberName:
          'Comprehensive Market Analysis Report for North American Regional Sales Performance Q4 2024',
      },
      {
        MemberId: 'dataset-long-1',
        MemberType: 'DATASET',
        MemberName:
          'Consolidated Customer Transaction History with Demographic Enrichment Data 2020-2024',
      },
    ]),
  },
};

export const Loading: Story = {
  args: { folder: { FolderId: 'folder-loading', Name: 'Loading Example' } },
  parameters: { routes: membersRoute(() => new Promise(() => {})) },
};
