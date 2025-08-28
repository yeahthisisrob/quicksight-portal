import AssetFoldersDialog from '../AssetFoldersDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AssetFoldersDialog> = {
  title: 'Widgets/AssetDialogs/AssetFoldersDialog',
  component: AssetFoldersDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A dialog component for displaying folder memberships of assets with hierarchical paths and visual organization.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls the visibility of the dialog',
    },
    onClose: {
      description: 'Callback when the dialog is closed',
    },
    assetName: {
      control: 'text',
      description: 'Name of the asset',
    },
    assetType: {
      control: 'select',
      options: ['Dashboard', 'Analysis', 'Dataset', 'Data source'],
      description: 'Type of the asset',
    },
    folders: {
      control: 'object',
      description: 'Array of folders the asset belongs to',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockFolders = [
  { 
    id: 'folder-1', 
    name: 'Sales Reports', 
    path: '/Company Data/Sales/Sales Reports' 
  },
  { 
    id: 'folder-2', 
    name: 'Q4 2023', 
    path: '/Company Data/Sales/Quarterly Reports/Q4 2023' 
  },
  { 
    id: 'folder-3', 
    name: 'Executive Dashboards', 
    path: '/Executive Dashboards' 
  },
];

export const Default: Story = {
  args: {
    open: true,
    assetName: 'Sales Performance Dashboard',
    assetType: 'Dashboard',
    folders: mockFolders,
  },
};

export const SingleFolder: Story = {
  args: {
    open: true,
    assetName: 'Customer Analysis',
    assetType: 'Analysis',
    folders: [
      { 
        id: 'folder-1', 
        name: 'Customer Insights', 
        path: '/Analytics/Customer Insights' 
      },
    ],
  },
};

export const NoFolders: Story = {
  args: {
    open: true,
    assetName: 'Orphaned Dataset',
    assetType: 'Dataset',
    folders: [],
  },
};

export const ManyFolders: Story = {
  args: {
    open: true,
    assetName: 'Shared Revenue Report',
    assetType: 'Analysis',
    folders: [
      { id: 'folder-1', name: 'Finance', path: '/Finance' },
      { id: 'folder-2', name: 'Revenue Reports', path: '/Finance/Revenue Reports' },
      { id: 'folder-3', name: 'Monthly Reports', path: '/Finance/Revenue Reports/Monthly Reports' },
      { id: 'folder-4', name: '2023', path: '/Finance/Revenue Reports/2023' },
      { id: 'folder-5', name: 'Shared Reports', path: '/Shared/Reports' },
      { id: 'folder-6', name: 'Executive', path: '/Executive' },
      { id: 'folder-7', name: 'Department Dashboards', path: '/Department Dashboards' },
      { id: 'folder-8', name: 'Archive', path: '/Archive/2023' },
    ],
  },
};

export const LongPaths: Story = {
  args: {
    open: true,
    assetName: 'Deeply Nested Dataset',
    assetType: 'Dataset',
    folders: [
      { 
        id: 'folder-1', 
        name: 'Metrics', 
        path: '/Company/Division/Department/Team/Project/Subproject/Data/Metrics' 
      },
      { 
        id: 'folder-2', 
        name: 'Archive', 
        path: '/Historical/2020/Q1/January/Week1/Daily/Reports/Archive' 
      },
    ],
  },
};

export const SpecialCharacterPaths: Story = {
  args: {
    open: true,
    assetName: 'International Sales Data',
    assetType: 'Data source',
    folders: [
      { 
        id: 'folder-1', 
        name: 'Sales & Marketing', 
        path: '/Sales & Marketing' 
      },
      { 
        id: 'folder-2', 
        name: 'EMEA (Europe, Middle East & Africa)', 
        path: '/Regions/EMEA (Europe, Middle East & Africa)' 
      },
      { 
        id: 'folder-3', 
        name: '日本 (Japan)', 
        path: '/Regions/APAC/日本 (Japan)' 
      },
    ],
  },
};

export const DuplicateNames: Story = {
  args: {
    open: true,
    assetName: 'Multi-Department Report',
    assetType: 'Dashboard',
    folders: [
      { 
        id: 'folder-1', 
        name: 'Reports', 
        path: '/Sales/Reports' 
      },
      { 
        id: 'folder-2', 
        name: 'Reports', 
        path: '/Marketing/Reports' 
      },
      { 
        id: 'folder-3', 
        name: 'Reports', 
        path: '/Finance/Reports' 
      },
      { 
        id: 'folder-4', 
        name: 'Dashboards', 
        path: '/Sales/Dashboards' 
      },
      { 
        id: 'folder-5', 
        name: 'Dashboards', 
        path: '/Executive/Dashboards' 
      },
    ],
  },
};