/**
 * Storybook stories for BulkDeleteDialog component
 */
import { Button } from '@mui/material';
import { useState } from 'react';

import { BulkDeleteDialog } from './BulkDeleteDialog';

import type { Asset } from './types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof BulkDeleteDialog> = {
  title: 'Entities/Asset/BulkDeleteDialog',
  component: BulkDeleteDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A dialog for confirming and managing bulk deletion of QuickSight assets with comprehensive warnings and dependency information.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BulkDeleteDialog>;

// Sample data
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
    uses: [
      { id: 'data-001', name: 'Sales Data', type: 'dataset' },
    ],
  },
  {
    id: 'data-001',
    name: 'Sales Data',
    type: 'dataset',
    usedBy: [
      { id: 'dash-001', name: 'Sales Dashboard', type: 'dashboard' },
      { id: 'anal-001', name: 'Revenue Analysis', type: 'analysis' },
    ],
    uses: [
      { id: 'ds-001', name: 'PostgreSQL Production', type: 'datasource' },
    ],
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

// Wrapper component to handle dialog state
function DialogWrapper({ assets, ...props }: any) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="contained" color="error" onClick={() => setOpen(true)}>
        Open Bulk Delete Dialog
      </Button>
      <BulkDeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        assets={assets}
        onComplete={() => console.log('Delete completed')}
        {...props}
      />
    </>
  );
}

export const Default: Story = {
  render: () => <DialogWrapper assets={sampleAssets} />,
};

export const SingleAsset: Story = {
  render: () => (
    <DialogWrapper 
      assets={[
        {
          id: 'dash-001',
          name: 'Sales Dashboard',
          type: 'dashboard',
        },
      ]} 
    />
  ),
};

export const OnlyRestorableAssets: Story = {
  render: () => (
    <DialogWrapper 
      assets={[
        {
          id: 'anal-001',
          name: 'Revenue Analysis',
          type: 'analysis',
        },
        {
          id: 'anal-002',
          name: 'Customer Analysis',
          type: 'analysis',
        },
      ]} 
    />
  ),
};

export const WithDependencies: Story = {
  render: () => (
    <DialogWrapper 
      assets={[
        {
          id: 'data-001',
          name: 'Sales Data',
          type: 'dataset',
          usedBy: [
            { id: 'dash-001', name: 'Sales Dashboard', type: 'dashboard' },
            { id: 'dash-002', name: 'Regional Dashboard', type: 'dashboard' },
            { id: 'anal-001', name: 'Revenue Analysis', type: 'analysis' },
          ],
          uses: [
            { id: 'ds-001', name: 'PostgreSQL Production', type: 'datasource' },
          ],
        },
        {
          id: 'data-002',
          name: 'Customer Data',
          type: 'dataset',
          usedBy: [
            { id: 'dash-003', name: 'Customer Dashboard', type: 'dashboard' },
          ],
        },
      ]} 
    />
  ),
};

export const MixedAssetTypes: Story = {
  render: () => (
    <DialogWrapper 
      assets={[
        { id: 'dash-001', name: 'Dashboard 1', type: 'dashboard' },
        { id: 'dash-002', name: 'Dashboard 2', type: 'dashboard' },
        { id: 'anal-001', name: 'Analysis 1', type: 'analysis' },
        { id: 'data-001', name: 'Dataset 1', type: 'dataset' },
        { id: 'data-002', name: 'Dataset 2', type: 'dataset' },
        { id: 'data-003', name: 'Dataset 3', type: 'dataset' },
        { id: 'ds-001', name: 'Data Source 1', type: 'datasource' },
      ]} 
    />
  ),
};

export const LargeNumberOfAssets: Story = {
  render: () => {
    const manyAssets = Array.from({ length: 50 }, (_, i) => ({
      id: `asset-${i}`,
      name: `Asset ${i + 1}`,
      type: ['dashboard', 'analysis', 'dataset', 'datasource'][i % 4] as Asset['type'],
    }));
    
    return <DialogWrapper assets={manyAssets} />;
  },
};