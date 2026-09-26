import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent } from 'storybook/test';

import TagsDialog from '../TagsDialog';

const meta = {
  title: 'Widgets/AssetDialogs/TagsDialog',
  component: TagsDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Views and edits an asset’s tags. In edit mode a folder also gets the portal visibility controls, which are tags themselves.',
      },
    },
  },
  args: { open: true, onClose: () => {} },
} satisfies Meta<typeof TagsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Includes an overlong value and keys with the punctuation AWS allows. */
export const Default: Story = {
  args: {
    assetName: 'Sales Dashboard Q4 2023',
    assetType: 'dashboard',
    assetId: 'dashboard-123',
    resourceType: 'dashboard',
    initialTags: [
      { key: 'Environment', value: 'Production' },
      { key: 'Owner', value: 'DataTeam' },
      { key: 'aws:createdBy', value: 'arn:aws:iam::123456789012:user/admin' },
      {
        key: 'Description',
        value:
          'A very long description with the purpose, update frequency and other metadata that might be relevant for users of this dashboard',
      },
    ],
  },
};

export const NoTags: Story = {
  args: {
    assetName: 'Empty Analysis',
    assetType: 'analysis',
    assetId: 'analysis-456',
    resourceType: 'analysis',
    initialTags: [],
  },
};

/** A folder in edit mode: the portal visibility controls reflect its Portal:* tags. */
export const FolderEditMode: Story = {
  args: {
    assetName: 'Private Folder',
    assetType: 'folder',
    assetId: 'folder-789',
    resourceType: 'folder',
    initialTags: [
      { key: 'Environment', value: 'Development' },
      { key: 'Portal:ExcludeFromCatalog', value: 'true' },
    ],
  },
  play: async () => {
    const edit = (await screen.findByTestId('EditIcon')).closest('button');
    await userEvent.click(edit as HTMLButtonElement);
    await expect(await screen.findByText('Hidden from Catalog')).toBeInTheDocument();
  },
};
