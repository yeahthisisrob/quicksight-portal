import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { FoldersProvider } from '@/entities/folder';

import { MockedApi, type MockRoute } from '../../../../../.storybook/mocks/api';
import { CreateFolderDialog } from '../CreateFolderDialog';
import { FolderSharingDialog } from '../FolderSharingDialog';

const FOLDERS = [
  { id: 'f-finance', name: 'Finance', path: '/Finance', memberCount: 4 },
  { id: 'f-finance-q4', name: 'Q4', path: '/Finance/Q4', memberCount: 2 },
  { id: 'f-sales', name: 'Sales', path: '/Sales', memberCount: 9 },
];

const PERMISSIONS = [
  {
    principal: 'arn:aws:quicksight:us-east-1:1:group/default/analysts',
    name: 'default/analysts',
    type: 'GROUP',
    role: 'AUTHOR',
    actions: ['quicksight:DescribeFolder', 'quicksight:CreateAnalysis'],
  },
  {
    principal: 'arn:aws:quicksight:us-east-1:1:user/default/pat@example.com',
    name: 'default/pat@example.com',
    type: 'USER',
    role: 'ADMIN',
    actions: ['quicksight:DescribeFolder', 'quicksight:UpdateFolderPermissions'],
  },
];

const routes = (permissions = PERMISSIONS): MockRoute[] => [
  {
    method: 'get',
    url: /\/assets\/folders\/paginated/,
    respond: () => ({
      body: {
        success: true,
        data: {
          folders: FOLDERS,
          pagination: { page: 1, pageSize: 1000, totalItems: 3, totalPages: 1 },
        },
      },
    }),
  },
  {
    method: 'get',
    url: /\/assets\/users\/paginated/,
    respond: () => ({
      body: {
        success: true,
        data: {
          users: [
            { id: 'u1', name: 'sam@example.com', email: 'sam@example.com' },
            { id: 'u2', name: 'pat@example.com', email: 'pat@example.com' },
          ],
          pagination: { page: 1, pageSize: 1000, totalItems: 2, totalPages: 1 },
        },
      },
    }),
  },
  {
    method: 'get',
    url: /\/assets\/groups\/paginated/,
    respond: () => ({
      body: {
        success: true,
        data: {
          groups: [
            { id: 'analysts', name: 'analysts' },
            { id: 'finance', name: 'finance' },
          ],
          pagination: { page: 1, pageSize: 1000, totalItems: 2, totalPages: 1 },
        },
      },
    }),
  },
  {
    method: 'get',
    url: /\/folders\/[^/]+\/permissions$/,
    respond: () => ({ body: { success: true, data: { permissions } } }),
  },
  {
    method: 'post',
    url: /\/folders$/,
    respond: () => ({
      status: 201,
      body: {
        success: true,
        data: { folderId: 'f-new', arn: 'arn:folder/f-new', name: 'Marketing' },
      },
    }),
  },
  {
    method: 'post',
    url: /\/folders\/[^/]+\/members$/,
    respond: () => ({ body: { success: true, data: { message: 'Member added successfully' } } }),
  },
];

const meta: Meta = {
  title: 'Features/Organization/FolderDialogs',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A new folder (a name and where it goes), and sharing one: who can see or work in it, with a role, live from QuickSight.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Create: Story = {
  render: () => (
    <MockedApi routes={routes()}>
      <FoldersProvider>
        <CreateFolderDialog open onClose={fn()} onCreated={fn()} />
      </FoldersProvider>
    </MockedApi>
  ),
};

export const Share: Story = {
  render: () => (
    <MockedApi routes={routes()}>
      <FolderSharingDialog open onClose={fn()} folder={{ id: 'f-finance', name: 'Finance' }} />
    </MockedApi>
  ),
};

export const ShareNobodyYet: Story = {
  name: 'Share: nobody yet',
  render: () => (
    <MockedApi routes={routes([])}>
      <FolderSharingDialog open onClose={fn()} folder={{ id: 'f-sales', name: 'Sales' }} />
    </MockedApi>
  ),
};
