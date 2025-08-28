import { FolderOpen, CloudUpload } from '@mui/icons-material';
import { Box } from '@mui/material';

import BulkActionsToolbar from './BulkActionsToolbar';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Widgets/BulkActionsToolbar',
  component: BulkActionsToolbar,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '200px' }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof BulkActionsToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    selectedCount: 5,
    onAddToFolder: () => {},
    onBulkTag: () => {},
    onClearSelection: () => {},
  },
};

export const WithCustomFolderLabel: Story = {
  args: {
    selectedCount: 3,
    onAddToFolder: () => {},
    onBulkTag: () => {},
    onClearSelection: () => {},
    folderActionLabel: 'Add to Group',
  },
};

export const WithoutFolderAction: Story = {
  args: {
    selectedCount: 10,
    onBulkTag: () => {},
    onClearSelection: () => {},
  },
};

export const WithCustomActions: Story = {
  args: {
    selectedCount: 7,
    onBulkTag: () => {},
    onClearSelection: () => {},
    customActions: [
      {
        label: 'Move to Archive',
        icon: <FolderOpen />,
        onClick: () => {},
      },
      {
        label: 'Export Selected',
        icon: <CloudUpload />,
        onClick: () => {},
      },
    ],
  },
};

export const SingleSelection: Story = {
  args: {
    selectedCount: 1,
    onAddToFolder: () => {},
    onBulkTag: () => {},
    onClearSelection: () => {},
  },
};

export const LargeSelection: Story = {
  args: {
    selectedCount: 150,
    onAddToFolder: () => {},
    onBulkTag: () => {},
    onClearSelection: () => {},
  },
};

export const WithDeleteAction: Story = {
  args: {
    selectedCount: 5,
    onAddToFolder: () => {},
    onBulkTag: () => {},
    onBulkDelete: () => {},
    onClearSelection: () => {},
    showDeleteAction: true,
  },
};

export const OnlyDeleteAction: Story = {
  args: {
    selectedCount: 3,
    onBulkTag: () => {},
    onBulkDelete: () => {},
    onClearSelection: () => {},
    showDeleteAction: true,
  },
};