import { RelatedAsset } from '@/entities/asset';

import RelatedAssetsDialog from '../RelatedAssetsDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof RelatedAssetsDialog> = {
  title: 'Features/AssetManagement/RelatedAssetsDialog',
  component: RelatedAssetsDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A dialog component for viewing asset relationships with a two-column layout showing "Used By" and "Uses" relationships.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      // In docs mode, don't render the dialog open by default
      if (context.viewMode === 'docs') {
        return (
          <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Dialog component - Click on a story to see it in action</p>
          </div>
        );
      }
      return <Story />;
    },
  ],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls whether the dialog is open',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when dialog is closed',
    },
    assetName: {
      control: 'text',
      description: 'Name of the asset',
    },
    assetType: {
      control: 'select',
      options: ['dashboard', 'analysis', 'dataset', 'datasource'],
      description: 'Type of the asset',
    },
    relatedAssets: {
      control: 'object',
      description: 'Related assets in either array or object format',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data generators
const createMockAsset = (
  id: string, 
  name: string, 
  type: 'dashboard' | 'analysis' | 'dataset' | 'datasource',
  relationshipType: string = 'uses',
  activity?: { totalViews?: number; uniqueViewers?: number; lastViewed?: string | null }
): RelatedAsset => ({
  id,
  name,
  type,
  relationshipType,
  ...(activity && { activity })
});

const mockRelatedAssets = {
  comprehensive: {
    usedBy: [
      createMockAsset('dash-001', 'Executive Summary Dashboard', 'dashboard', 'used_by', 
        { totalViews: 1250, uniqueViewers: 45, lastViewed: '2024-01-15T14:30:00Z' }),
      createMockAsset('dash-002', 'Sales Performance Dashboard', 'dashboard', 'used_by',
        { totalViews: 850, uniqueViewers: 32, lastViewed: '2024-01-15T09:15:00Z' }),
      createMockAsset('analysis-001', 'Quarterly Revenue Analysis', 'analysis', 'used_by',
        { totalViews: 420, uniqueViewers: 18, lastViewed: '2024-01-14T16:45:00Z' }),
      createMockAsset('analysis-002', 'Customer Segmentation Study', 'analysis', 'used_by',
        { totalViews: 280, uniqueViewers: 12, lastViewed: '2024-01-13T11:20:00Z' }),
    ],
    uses: [
      createMockAsset('dataset-001', 'Sales Transactions 2024', 'dataset', 'uses'),
      createMockAsset('dataset-002', 'Customer Demographics', 'dataset', 'uses'),
      createMockAsset('dataset-003', 'Product Catalog', 'dataset', 'uses'),
      createMockAsset('datasource-001', 'Production Database', 'datasource', 'uses'),
      createMockAsset('datasource-002', 'Analytics Warehouse', 'datasource', 'uses'),
    ],
  },
  dashboardHeavy: {
    usedBy: [
      createMockAsset('dash-001', 'CEO Dashboard', 'dashboard', 'used_by',
        { totalViews: 2500, uniqueViewers: 85, lastViewed: '2024-01-15T08:00:00Z' }),
      createMockAsset('dash-002', 'CFO Dashboard', 'dashboard', 'used_by',
        { totalViews: 1800, uniqueViewers: 62, lastViewed: '2024-01-15T10:30:00Z' }),
      createMockAsset('dash-003', 'CMO Dashboard', 'dashboard', 'used_by',
        { totalViews: 1200, uniqueViewers: 48, lastViewed: '2024-01-14T15:45:00Z' }),
      createMockAsset('dash-004', 'COO Dashboard', 'dashboard', 'used_by',
        { totalViews: 950, uniqueViewers: 38, lastViewed: '2024-01-15T11:15:00Z' }),
      createMockAsset('dash-005', 'CTO Dashboard', 'dashboard', 'used_by',
        { totalViews: 750, uniqueViewers: 28, lastViewed: '2024-01-13T17:20:00Z' }),
    ],
    uses: [
      createMockAsset('dataset-001', 'Consolidated KPIs', 'dataset'),
    ],
  },
  datasetCentric: {
    usedBy: [
      createMockAsset('analysis-001', 'Data Quality Report', 'analysis'),
      createMockAsset('dataset-001', 'Aggregated Sales Data', 'dataset'),
      createMockAsset('dataset-002', 'Customer Master Data', 'dataset'),
    ],
    uses: [
      createMockAsset('datasource-001', 'ERP System', 'datasource'),
      createMockAsset('datasource-002', 'CRM System', 'datasource'),
      createMockAsset('datasource-003', 'Marketing Automation', 'datasource'),
    ],
  },
  empty: {
    usedBy: [],
    uses: [],
  },
  onlyUsedBy: {
    usedBy: [
      createMockAsset('dash-001', 'Operations Dashboard', 'dashboard'),
      createMockAsset('analysis-001', 'Operational Efficiency Analysis', 'analysis'),
    ],
    uses: [],
  },
  onlyUses: {
    usedBy: [],
    uses: [
      createMockAsset('dataset-001', 'Raw Event Data', 'dataset'),
      createMockAsset('datasource-001', 'Event Stream', 'datasource'),
    ],
  },
};

// Legacy array format for backward compatibility testing
const legacyArrayFormat: RelatedAsset[] = [
  { ...createMockAsset('dash-001', 'Legacy Dashboard', 'dashboard'), relationshipType: 'used_by' },
  { ...createMockAsset('analysis-001', 'Legacy Analysis', 'analysis'), relationshipType: 'used_by' },
  { ...createMockAsset('dataset-001', 'Legacy Dataset', 'dataset'), relationshipType: 'uses' },
  { ...createMockAsset('datasource-001', 'Legacy Datasource', 'datasource'), relationshipType: 'uses' },
];

export const Default: Story = {
  args: {
    open: true,
    assetName: 'Monthly Sales Analysis',
    assetType: 'analysis',
    relatedAssets: mockRelatedAssets.comprehensive,
  },
};

export const DashboardWithManyDependents: Story = {
  args: {
    open: true,
    assetName: 'Enterprise KPI Dashboard',
    assetType: 'dashboard',
    relatedAssets: mockRelatedAssets.dashboardHeavy,
  },
};

export const DatasetWithMultipleSources: Story = {
  args: {
    open: true,
    assetName: 'Unified Customer View',
    assetType: 'dataset',
    relatedAssets: mockRelatedAssets.datasetCentric,
  },
};

export const NoRelatedAssets: Story = {
  args: {
    open: true,
    assetName: 'Standalone Report',
    assetType: 'analysis',
    relatedAssets: mockRelatedAssets.empty,
  },
};

export const OnlyUsedBy: Story = {
  args: {
    open: true,
    assetName: 'Core Metrics Dataset',
    assetType: 'dataset',
    relatedAssets: mockRelatedAssets.onlyUsedBy,
  },
};

export const OnlyUses: Story = {
  args: {
    open: true,
    assetName: 'Real-time Dashboard',
    assetType: 'dashboard',
    relatedAssets: mockRelatedAssets.onlyUses,
  },
};

export const LegacyFormat: Story = {
  args: {
    open: true,
    assetName: 'Legacy Asset',
    assetType: 'analysis',
    relatedAssets: legacyArrayFormat,
  },
};

export const LongAssetNames: Story = {
  args: {
    open: true,
    assetName: 'Comprehensive Enterprise Resource Planning and Business Intelligence Integration Dashboard for Executive Leadership Team Q4 2024',
    assetType: 'dashboard',
    relatedAssets: {
      usedBy: [
        createMockAsset(
          'dash-001', 
          'Executive Summary Dashboard with Extended Financial Metrics and Operational KPIs for Board Reporting', 
          'dashboard'
        ),
      ],
      uses: [
        createMockAsset(
          'dataset-001', 
          'Consolidated Financial and Operational Data from Multiple ERP Systems Including SAP, Oracle, and Microsoft Dynamics', 
          'dataset'
        ),
      ],
    },
  },
};

export const AllAssetTypes: Story = {
  args: {
    open: true,
    assetName: 'Multi-Type Asset Example',
    assetType: 'analysis',
    relatedAssets: {
      usedBy: [
        createMockAsset('dash-001', 'Type Example Dashboard', 'dashboard'),
        createMockAsset('analysis-001', 'Type Example Analysis', 'analysis'),
        createMockAsset('dataset-001', 'Type Example Dataset', 'dataset'),
        createMockAsset('datasource-001', 'Type Example Datasource', 'datasource'),
      ],
      uses: [
        createMockAsset('dash-002', 'Source Dashboard', 'dashboard'),
        createMockAsset('analysis-002', 'Source Analysis', 'analysis'),
        createMockAsset('dataset-002', 'Source Dataset', 'dataset'),
        createMockAsset('datasource-002', 'Source Datasource', 'datasource'),
      ],
    },
  },
};

export const WithActivityIndicators: Story = {
  args: {
    open: true,
    assetName: 'Popular Sales Dashboard',
    assetType: 'dashboard',
    relatedAssets: {
      usedBy: [
        createMockAsset('dash-001', 'Regional Sales Overview', 'dashboard', 'used_by',
          { totalViews: 5420, uniqueViewers: 125, lastViewed: '2024-01-15T16:30:00Z' }),
        createMockAsset('dash-002', 'Product Performance Metrics', 'dashboard', 'used_by',
          { totalViews: 3210, uniqueViewers: 89, lastViewed: '2024-01-15T14:15:00Z' }),
        createMockAsset('analysis-001', 'Monthly Sales Trends', 'analysis', 'used_by',
          { totalViews: 1850, uniqueViewers: 45, lastViewed: '2024-01-15T12:00:00Z' }),
        createMockAsset('analysis-002', 'Customer Behavior Analysis', 'analysis', 'used_by',
          { totalViews: 950, uniqueViewers: 28, lastViewed: '2024-01-14T18:45:00Z' }),
        createMockAsset('analysis-003', 'Inactive Analysis', 'analysis', 'used_by',
          { totalViews: 0, uniqueViewers: 0, lastViewed: null }),
      ],
      uses: [
        createMockAsset('dataset-001', 'Sales Data Warehouse', 'dataset', 'uses'),
        createMockAsset('dataset-002', 'Customer Demographics', 'dataset', 'uses'),
        createMockAsset('datasource-001', 'ERP System', 'datasource', 'uses'),
      ],
    },
  },
};