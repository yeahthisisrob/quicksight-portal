import { CloudUpload, FolderOpen } from '@mui/icons-material';
import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';

import BulkActionsToolbar from './BulkActionsToolbar';

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
  args: {
    selectedCount: 5,
    onBulkTag: () => {},
    onClearSelection: () => {},
  },
} satisfies Meta<typeof BulkActionsToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every built-in action: add to folder, tag, delete. */
export const Default: Story = {
  args: {
    onAddToFolder: () => {},
    onBulkDelete: () => {},
    showDeleteAction: true,
  },
};

/** No folder action; the host adds its own actions instead. */
export const WithCustomActions: Story = {
  args: {
    selectedCount: 7,
    customActions: [
      { label: 'Move to Archive', icon: <FolderOpen />, onClick: () => {} },
      { label: 'Export Selected', icon: <CloudUpload />, onClick: () => {} },
    ],
  },
};
