/**
 * Storybook stories for RestoreAssetDialog component
 */
import { Button } from '@mui/material';
import { useState } from 'react';

import { RestoreAssetDialog } from './RestoreAssetDialog';

import type { ArchivedAssetItem } from '../../model/types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/AssetManagement/RestoreAssetDialog',
  component: RestoreAssetDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RestoreAssetDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock archived asset data
const mockDataset: ArchivedAssetItem = {
  id: 'dataset-123',
  name: 'Sales Dataset 2024',
  type: 'dataset',
  createdTime: '2024-01-15T10:30:00Z',
  lastPublishedTime: '2024-06-20T14:45:00Z',
  archivedDate: '2024-07-01T09:00:00Z',
  archivedBy: 'admin@example.com',
  archiveReason: 'Replaced with updated version',
  size: 1024 * 1024 * 256, // 256 MB
  status: 'archived',
  tags: [
    { key: 'Department', value: 'Sales' },
    { key: 'Year', value: '2024' },
  ],
  metadata: {
    importMode: 'SPICE',
    rowCount: 1500000,
    consumedSpiceCapacityInBytes: 1024 * 1024 * 256,
  },
};

const mockDashboard: ArchivedAssetItem = {
  id: 'dashboard-456',
  name: 'Executive Sales Dashboard',
  type: 'dashboard',
  createdTime: '2024-02-01T11:00:00Z',
  lastPublishedTime: '2024-06-15T16:30:00Z',
  archivedDate: '2024-07-05T10:30:00Z',
  archivedBy: 'manager@example.com',
  archiveReason: 'End of quarter cleanup',
  size: 1024 * 512, // 512 KB
  status: 'archived',
  tags: [
    { key: 'Type', value: 'Executive' },
    { key: 'Department', value: 'Sales' },
  ],
};

const mockAnalysis: ArchivedAssetItem = {
  id: 'analysis-789',
  name: 'Q2 Performance Analysis',
  type: 'analysis',
  createdTime: '2024-03-10T09:15:00Z',
  lastPublishedTime: '2024-06-10T13:00:00Z',
  archivedDate: '2024-07-02T11:15:00Z',
  archivedBy: 'analyst@example.com',
  archiveReason: 'Quarterly review completed',
  size: 1024 * 768, // 768 KB
  status: 'archived',
  tags: [
    { key: 'Quarter', value: 'Q2' },
    { key: 'Type', value: 'Performance' },
  ],
};

// Wrapper component to handle dialog state
function RestoreDialogWrapper({ 
  asset, 
  defaultOpen = false 
}: { 
  asset: ArchivedAssetItem;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <>
      <Button variant="contained" onClick={() => setOpen(true)}>
        Open Restore Dialog
      </Button>
      <RestoreAssetDialog
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          console.log('Asset restored successfully!');
          setOpen(false);
        }}
        asset={asset}
      />
    </>
  );
}

export const DatasetRestore: Story = {
  args: {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    asset: null,
  },
  render: () => <RestoreDialogWrapper asset={mockDataset} />,
};

export const DashboardRestore: Story = {
  args: {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    asset: null,
  },
  render: () => <RestoreDialogWrapper asset={mockDashboard} />,
};

export const AnalysisRestore: Story = {
  args: {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    asset: null,
  },
  render: () => <RestoreDialogWrapper asset={mockAnalysis} />,
};

export const OpenByDefault: Story = {
  args: {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    asset: null,
  },
  render: () => <RestoreDialogWrapper asset={mockDataset} defaultOpen={true} />,
};

export const WithMinimalTags: Story = {
  args: {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    asset: null,
  },
  render: () => (
    <RestoreDialogWrapper 
      asset={{
        ...mockDataset,
        tags: [],
      }} 
    />
  ),
};

export const WithoutArchiveReason: Story = {
  args: {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    asset: null,
  },
  render: () => (
    <RestoreDialogWrapper 
      asset={{
        ...mockDashboard,
        archiveReason: undefined,
      }} 
    />
  ),
};

export const LargeDataset: Story = {
  args: {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    asset: null,
  },
  render: () => (
    <RestoreDialogWrapper 
      asset={{
        ...mockDataset,
        size: 1024 * 1024 * 1024 * 5, // 5 GB
        metadata: {
          importMode: 'SPICE',
          rowCount: 50000000,
          consumedSpiceCapacityInBytes: 1024 * 1024 * 1024 * 5,
        },
      }} 
    />
  ),
};

export const DirectQueryDataset: Story = {
  args: {
    open: false,
    onClose: () => {},
    onSuccess: () => {},
    asset: null,
  },
  render: () => (
    <RestoreDialogWrapper 
      asset={{
        ...mockDataset,
        metadata: {
          importMode: 'DIRECT_QUERY',
          rowCount: undefined,
          consumedSpiceCapacityInBytes: 0,
        },
      }} 
    />
  ),
};