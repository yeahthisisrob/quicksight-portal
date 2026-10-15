import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { AssetListDialog } from './index';

/**
 * The list behind a count: typed sections, one per asset type present, each
 * row a click through. The calculated-field grid opens it from its
 * "defined in" counts; anything with a count and a list can.
 */
const meta: Meta<typeof AssetListDialog> = {
  title: 'Shared/AssetListDialog',
  component: AssetListDialog,
  args: {
    open: true,
    onClose: fn(),
    onAssetClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const DefinedIn: Story = {
  args: {
    title: 'Defined in 4 assets',
    description: 'Margin % · the same expression in each',
    assets: [
      { id: 'ds-orders', name: 'Orders', type: 'dataset', hint: 'Tied to listing orders_daily' },
      { id: 'an-sales', name: 'Sales review', type: 'analysis' },
      { id: 'db-exec', name: 'Executive overview', type: 'dashboard' },
      { id: 'db-regional', name: 'Regional sales', type: 'dashboard', isArchived: true },
    ],
  },
};

export const Datasets: Story = {
  args: {
    title: '2 datasets',
    description: 'Declared on, or bound to when defined in a dashboard or analysis',
    assets: [
      { id: 'ds-orders', name: 'Orders', type: 'dataset', hint: 'Tied to listing orders_daily' },
      {
        id: 'ds-returns',
        name: 'Returns',
        type: 'dataset',
        hint: 'Not tied to a SMUS listing: no listing matched this dataset.',
      },
    ],
  },
};
