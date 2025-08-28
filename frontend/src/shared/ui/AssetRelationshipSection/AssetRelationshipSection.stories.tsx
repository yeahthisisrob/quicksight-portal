import { Stack } from '@mui/material';

import { AssetRelationshipSection } from './index';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AssetRelationshipSection> = {
  title: 'Shared/UI/AssetRelationshipSection',
  component: AssetRelationshipSection,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A reusable component for displaying a section of related assets grouped by type, used in the RelatedAssetsDialog.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['dashboard', 'analysis', 'dataset', 'datasource'],
      description: 'The type of assets in this section',
    },
    assets: {
      control: 'object',
      description: 'Array of assets to display',
    },
    onAssetClick: {
      action: 'asset-clicked',
      description: 'Callback when an asset is clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockAssets = {
  dashboards: [
    { id: 'dash-001', name: 'Sales Dashboard', type: 'dashboard', relationshipType: 'uses' },
    { id: 'dash-002', name: 'Marketing Dashboard', type: 'dashboard', relationshipType: 'uses' },
    { id: 'dash-003', name: 'Operations Dashboard', type: 'dashboard', relationshipType: 'uses' },
  ],
  analyses: [
    { id: 'analysis-001', name: 'Revenue Analysis', type: 'analysis', relationshipType: 'uses' },
    { id: 'analysis-002', name: 'Customer Segmentation', type: 'analysis', relationshipType: 'uses' },
  ],
  datasets: [
    { id: 'dataset-001', name: 'Sales Data 2024', type: 'dataset', relationshipType: 'uses' },
    { id: 'dataset-002', name: 'Customer Demographics', type: 'dataset', relationshipType: 'uses' },
    { id: 'dataset-003', name: 'Product Catalog', type: 'dataset', relationshipType: 'uses' },
    { id: 'dataset-004', name: 'Transaction History', type: 'dataset', relationshipType: 'uses' },
  ],
  datasources: [
    { id: 'datasource-001', name: 'Production Database', type: 'datasource', relationshipType: 'uses' },
  ],
};

export const DashboardSection: Story = {
  args: {
    type: 'dashboard',
    assets: mockAssets.dashboards,
  },
};

export const AnalysisSection: Story = {
  args: {
    type: 'analysis',
    assets: mockAssets.analyses,
  },
};

export const DatasetSection: Story = {
  args: {
    type: 'dataset',
    assets: mockAssets.datasets,
  },
};

export const DatasourceSection: Story = {
  args: {
    type: 'datasource',
    assets: mockAssets.datasources,
  },
};

export const EmptySection: Story = {
  args: {
    type: 'dashboard',
    assets: [],
  },
};

export const SingleAsset: Story = {
  args: {
    type: 'analysis',
    assets: [{ id: 'analysis-001', name: 'Quarterly Report', type: 'analysis', relationshipType: 'uses' }],
  },
};

export const LongNames: Story = {
  args: {
    type: 'dataset',
    assets: [
      { 
        id: 'dataset-001', 
        name: 'Comprehensive Customer Transaction History with Demographic and Behavioral Enrichment Data 2020-2024', 
        type: 'dataset',
        relationshipType: 'uses'
      },
      { 
        id: 'dataset-002', 
        name: 'Real-time Streaming Events from IoT Sensors Across Manufacturing Facilities', 
        type: 'dataset',
        relationshipType: 'uses'
      },
    ],
  },
};

export const AllTypesComparison: Story = {
  render: () => (
    <Stack spacing={2} sx={{ width: 400 }}>
      <AssetRelationshipSection
        type="dashboard"
        assets={mockAssets.dashboards}
        onAssetClick={() => {}}
      />
      <AssetRelationshipSection
        type="analysis"
        assets={mockAssets.analyses}
        onAssetClick={() => {}}
      />
      <AssetRelationshipSection
        type="dataset"
        assets={mockAssets.datasets}
        onAssetClick={() => {}}
      />
      <AssetRelationshipSection
        type="datasource"
        assets={mockAssets.datasources}
        onAssetClick={() => {}}
      />
    </Stack>
  ),
};

export const EmptyStates: Story = {
  render: () => (
    <Stack spacing={2} sx={{ width: 400 }}>
      <AssetRelationshipSection
        type="dashboard"
        assets={[]}
        onAssetClick={() => {}}
      />
      <AssetRelationshipSection
        type="analysis"
        assets={[]}
        onAssetClick={() => {}}
      />
      <AssetRelationshipSection
        type="dataset"
        assets={[]}
        onAssetClick={() => {}}
      />
      <AssetRelationshipSection
        type="datasource"
        assets={[]}
        onAssetClick={() => {}}
      />
    </Stack>
  ),
};