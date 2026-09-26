import type { Meta, StoryObj } from '@storybook/react-vite';

import { BulkDeleteDialog } from './BulkDeleteDialog';
import type { Asset } from './types';

const meta: Meta<typeof BulkDeleteDialog> = {
  title: 'Entities/Asset/BulkDeleteDialog',
  component: BulkDeleteDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A dialog for confirming and managing bulk deletion of QuickSight assets with comprehensive warnings and dependency information.',
      },
    },
  },
  tags: ['autodocs'],
  args: { open: true, onClose: () => {}, onComplete: () => {} },
};

export default meta;
type Story = StoryObj<typeof BulkDeleteDialog>;

const sampleAssets: Asset[] = [
  {
    id: 'dash-001',
    name: 'Sales Dashboard',
    type: 'dashboard',
    usedBy: [
      { id: 'report-001', name: 'Monthly Report', type: 'analysis' },
      { id: 'report-002', name: 'Executive Summary', type: 'analysis' },
    ],
  },
  {
    id: 'anal-001',
    name: 'Revenue Analysis',
    type: 'analysis',
    uses: [{ id: 'data-001', name: 'Sales Data', type: 'dataset' }],
  },
  {
    id: 'data-001',
    name: 'Sales Data',
    type: 'dataset',
    usedBy: [
      { id: 'dash-001', name: 'Sales Dashboard', type: 'dashboard' },
      { id: 'anal-001', name: 'Revenue Analysis', type: 'analysis' },
    ],
    uses: [{ id: 'ds-001', name: 'PostgreSQL Production', type: 'datasource' }],
  },
  {
    id: 'ds-001',
    name: 'PostgreSQL Production',
    type: 'datasource',
    usedBy: [
      { id: 'data-001', name: 'Sales Data', type: 'dataset' },
      { id: 'data-002', name: 'Customer Data', type: 'dataset' },
    ],
  },
];

/** Mixed types with dependents: the warnings and the "cannot be restored" notice. */
export const Default: Story = {
  args: { assets: sampleAssets },
};

/** Only analyses, which QuickSight can restore, so there is nothing irreversible to warn about. */
export const OnlyRestorableAssets: Story = {
  args: {
    assets: [
      { id: 'anal-001', name: 'Revenue Analysis', type: 'analysis' },
      { id: 'anal-002', name: 'Customer Analysis', type: 'analysis' },
    ],
  },
};

export const LargeNumberOfAssets: Story = {
  args: {
    assets: Array.from({ length: 50 }, (_, i) => ({
      id: `asset-${i}`,
      name: `Asset ${i + 1}`,
      type: (['dashboard', 'analysis', 'dataset', 'datasource'] as const)[i % 4],
    })),
  },
};
