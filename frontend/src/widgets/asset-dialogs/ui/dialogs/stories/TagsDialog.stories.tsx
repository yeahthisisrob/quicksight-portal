import TagsDialog from '../TagsDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof TagsDialog> = {
  title: 'Widgets/AssetDialogs/TagsDialog',
  component: TagsDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A dialog component for managing asset tags with edit mode, portal visibility controls for folders, and TypedChip integration.',
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
      options: ['dashboard', 'analysis', 'dataset', 'datasource', 'folder'],
      description: 'Type of the asset',
    },
    assetId: {
      control: 'text',
      description: 'ID of the asset',
    },
    resourceType: {
      control: 'select',
      options: ['dashboard', 'analysis', 'dataset', 'datasource', 'folder', 'user', 'group'],
      description: 'Resource type for the API',
    },
    initialTags: {
      control: 'object',
      description: 'Initial tags to display',
    },
    onTagsUpdate: {
      description: 'Callback when tags are updated',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockTags = [
  { key: 'Environment', value: 'Production' },
  { key: 'Owner', value: 'DataTeam' },
  { key: 'Department', value: 'Analytics' },
  { key: 'CostCenter', value: 'CC-1234' },
];

export const Default: Story = {
  args: {
    open: true,
    assetName: 'Sales Dashboard Q4 2023',
    assetType: 'dashboard',
    assetId: 'dashboard-123',
    resourceType: 'dashboard',
    initialTags: mockTags,
  },
};

export const NoTags: Story = {
  args: {
    open: true,
    assetName: 'Empty Analysis',
    assetType: 'analysis',
    assetId: 'analysis-456',
    resourceType: 'analysis',
    initialTags: [],
  },
};

export const FolderWithPortalTags: Story = {
  args: {
    open: true,
    assetName: 'Private Folder',
    assetType: 'folder',
    assetId: 'folder-789',
    resourceType: 'folder',
    initialTags: [
      { key: 'Environment', value: 'Development' },
      { key: 'Portal:ExcludeFromCatalog', value: 'true' },
    ],
  },
};

export const FolderFullyHidden: Story = {
  args: {
    open: true,
    assetName: 'Hidden Folder',
    assetType: 'folder',
    assetId: 'folder-999',
    resourceType: 'folder',
    initialTags: [
      { key: 'Portal:ExcludeFromPortal', value: 'true' },
      { key: 'Owner', value: 'Admin' },
    ],
  },
};

export const ManyTags: Story = {
  args: {
    open: true,
    assetName: 'Well-Tagged Dataset',
    assetType: 'dataset',
    assetId: 'dataset-111',
    resourceType: 'dataset',
    initialTags: [
      { key: 'Environment', value: 'Production' },
      { key: 'Owner', value: 'DataEngineering' },
      { key: 'Department', value: 'Analytics' },
      { key: 'Project', value: 'CustomerInsights' },
      { key: 'CostCenter', value: 'CC-5678' },
      { key: 'DataClassification', value: 'Confidential' },
      { key: 'BusinessUnit', value: 'Sales' },
      { key: 'Application', value: 'Salesforce' },
      { key: 'Team', value: 'DataScience' },
      { key: 'Purpose', value: 'Reporting' },
      { key: 'Criticality', value: 'High' },
      { key: 'Compliance', value: 'GDPR' },
      { key: 'Region', value: 'US-East' },
      { key: 'Version', value: '2.0' },
      { key: 'Status', value: 'Active' },
    ],
  },
};

export const LongTagValues: Story = {
  args: {
    open: true,
    assetName: 'Complex Datasource',
    assetType: 'datasource',
    assetId: 'datasource-222',
    resourceType: 'datasource',
    initialTags: [
      { 
        key: 'Description', 
        value: 'This is a very long description that contains detailed information about the data source including its purpose, update frequency, and various other metadata that might be relevant for users' 
      },
      { 
        key: 'ConnectionString', 
        value: 'Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;' 
      },
    ],
  },
};

export const SpecialCharacterTags: Story = {
  args: {
    open: true,
    assetName: 'Test Asset',
    assetType: 'analysis',
    assetId: 'analysis-333',
    resourceType: 'analysis',
    initialTags: [
      { key: 'aws:createdBy', value: 'arn:aws:iam::123456789012:user/admin' },
      { key: 'kubernetes.io/cluster-name', value: 'production-cluster' },
      { key: 'app/version', value: '1.2.3-beta' },
      { key: 'cost-allocation', value: '$1000/month' },
    ],
  },
};