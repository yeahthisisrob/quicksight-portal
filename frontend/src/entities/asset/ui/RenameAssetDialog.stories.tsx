import { RenameAssetDialog } from './RenameAssetDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof RenameAssetDialog> = {
  title: 'Entities/Asset/RenameAssetDialog',
  component: RenameAssetDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Renames an asset live in QuickSight (dashboard/analysis/dataset/folder). Dashboards get a new version published so viewers see the new name immediately.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    open: true,
    onClose: () => {},
    onSuccess: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const RenameDashboard: Story = {
  args: {
    assetType: 'dashboard',
    asset: { id: 'dash-123', name: 'Quarterly Sales Overview' },
  },
};

export const RenameDataset: Story = {
  args: {
    assetType: 'dataset',
    asset: { id: 'ds-456', name: 'orders_curated_v2' },
  },
};

export const RenameFolder: Story = {
  args: {
    assetType: 'folder',
    asset: { id: 'folder-789', name: 'Finance Team' },
  },
};
