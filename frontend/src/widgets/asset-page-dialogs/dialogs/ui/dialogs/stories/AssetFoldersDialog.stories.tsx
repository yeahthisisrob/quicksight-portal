import type { Meta, StoryObj } from '@storybook/react-vite';

import AssetFoldersDialog from '../AssetFoldersDialog';

const meta = {
  title: 'Widgets/AssetDialogs/AssetFoldersDialog',
  component: AssetFoldersDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'The folders an asset belongs to, each with its full path.',
      },
    },
  },
  args: { open: true, onClose: () => {} },
} satisfies Meta<typeof AssetFoldersDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Includes a deeply nested path and names that repeat in different places. */
export const Default: Story = {
  args: {
    assetName: 'Sales Performance Dashboard',
    assetType: 'Dashboard',
    folders: [
      { id: 'folder-1', name: 'Reports', path: '/Sales/Reports' },
      { id: 'folder-2', name: 'Reports', path: '/Finance/Reports' },
      { id: 'folder-3', name: 'Q4 2023', path: '/Company Data/Sales/Quarterly Reports/Q4 2023' },
      {
        id: 'folder-4',
        name: 'Metrics',
        path: '/Company/Division/Department/Team/Project/Subproject/Data/Metrics',
      },
    ],
  },
};

export const NoFolders: Story = {
  args: { assetName: 'Orphaned Dataset', assetType: 'Dataset', folders: [] },
};
