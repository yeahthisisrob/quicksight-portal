import { Stack, Box, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { JsonViewerIconButton } from '../IconButtons';
import JsonViewerModal from './components/JsonViewerModal';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Create a query client with mocked data for stories
const createQueryClientWithMocks = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity, // Prevent refetching in stories
      },
    },
  });

  // Pre-populate cache with mock data for all potential story asset IDs
  queryClient.setQueryData(['asset-json', 'dashboard', 'sample-dashboard-123'], createMockDashboardData());
  queryClient.setQueryData(['asset-json', 'dataset', 'sample-dataset-456'], createMockDatasetData());
  queryClient.setQueryData(['asset-json', 'dashboard', 'dash-001'], createMockDashboardData());
  queryClient.setQueryData(['asset-json', 'dataset', 'dataset-001'], createMockDatasetData());
  queryClient.setQueryData(['asset-json', 'analysis', 'analysis-001'], createMockDashboardData()); // Use dashboard data as fallback
  queryClient.setQueryData(['asset-json', 'dashboard', 'sample-001'], createMockDashboardData());
  
  return queryClient;
};

// Shared mock data generators (DRY principle)
const createMockDashboardData = () => ({
  '@metadata': {
    assetType: 'dashboards',
    assetId: 'sample-dashboard-123',
    status: 'enriched',
    created: '2024-01-15T10:30:00Z',
    lastUpdated: '2024-03-20T14:45:00Z',
    exportVersion: '2.0',
    name: 'Sales Performance Dashboard',
    enrichmentStatus: {
      description: '2024-03-20T14:45:00Z',
      definition: '2024-03-20T14:45:00Z',
      permissions: '2024-03-20T14:45:00Z',
      tags: '2024-03-20T14:45:00Z'
    },
    exportTime: '2024-03-20T14:45:00Z',
    sheetCount: 3,
    visualCount: 12,
    visualFieldMappingCount: 45
  },
  Dashboard: {
    DashboardId: 'sample-dashboard-123',
    Name: 'Sales Performance Dashboard',
    Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/sample-dashboard-123',
    CreatedTime: '2024-01-15T10:30:00Z',
    LastUpdatedTime: '2024-03-20T14:45:00Z',
    LastPublishedTime: '2024-03-20T14:45:00Z',
    Version: {
      VersionNumber: 5,
      Status: 'CREATION_SUCCESSFUL',
      CreatedTime: '2024-03-20T14:45:00Z',
      DataSetArns: [
        'arn:aws:quicksight:us-east-1:123456789012:dataset/sales-data-456',
        'arn:aws:quicksight:us-east-1:123456789012:dataset/customer-data-789'
      ],
      Sheets: [
        { Name: 'Overview', SheetId: 'sheet-overview-001' },
        { Name: 'Regional Analysis', SheetId: 'sheet-regional-002' },
        { Name: 'Trend Analysis', SheetId: 'sheet-trends-003' }
      ]
    }
  },
  Definition: {
    DataSetIdentifierDeclarations: [
      {
        Identifier: 'sales-data',
        DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/sales-data-456'
      },
      {
        Identifier: 'customer-data',
        DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/customer-data-789'
      }
    ],
    CalculatedFields: [
      {
        DataSetIdentifier: 'sales-data',
        Expression: 'sum({Revenue})',
        Name: 'Total Revenue'
      },
      {
        DataSetIdentifier: 'sales-data',
        Expression: 'concat({FirstName}, " ", {LastName})',
        Name: 'Full Name'
      },
      {
        DataSetIdentifier: 'customer-data',
        Expression: 'ifelse({Status} = "Premium", {Price} * 0.9, {Price})',
        Name: 'Discounted Price'
      }
    ],
    Sheets: [
      {
        SheetId: 'sheet-overview-001',
        Name: 'Overview',
        Visuals: [
          {
            BarChartVisual: {
              VisualId: 'visual-bar-001',
              Title: { Visibility: 'VISIBLE', Text: 'Revenue by Region' },
              ChartConfiguration: {
                FieldWells: {
                  BarsAggregatedFieldWells: {
                    Category: [{ CategoricalDimensionField: { FieldId: 'region-field' } }],
                    Values: [{ NumericalMeasureField: { FieldId: 'revenue-field' } }]
                  }
                }
              }
            }
          },
          {
            LineChartVisual: {
              VisualId: 'visual-line-002',
              Title: { Visibility: 'VISIBLE', Text: 'Sales Trend' },
              ChartConfiguration: {
                FieldWells: {
                  LineChartAggregatedFieldWells: {
                    Category: [{ DateDimensionField: { FieldId: 'date-field' } }],
                    Values: [{ NumericalMeasureField: { FieldId: 'sales-field' } }]
                  }
                }
              }
            }
          }
        ]
      }
    ],
    FilterGroups: [
      {
        FilterGroupId: 'filter-group-001',
        Filters: [
          {
            DateTimeFilter: {
              FilterId: 'date-filter-001',
              Column: { DataSetIdentifier: 'sales-data', ColumnName: 'OrderDate' }
            }
          },
          {
            NumericRangeFilter: {
              FilterId: 'revenue-filter-002',
              Column: { DataSetIdentifier: 'sales-data', ColumnName: 'Revenue' }
            }
          }
        ]
      }
    ]
  },
  Permissions: [
    {
      principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/john.doe',
      principalType: 'USER',
      actions: ['quicksight:DescribeDashboard', 'quicksight:QueryDashboard']
    },
    {
      principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/sales-team',
      principalType: 'GROUP',
      actions: ['quicksight:DescribeDashboard']
    }
  ],
  Tags: [
    { key: 'Department', value: 'Sales' },
    { key: 'Environment', value: 'Production' },
    { key: 'Owner', value: 'Sales Team' }
  ]
});

const createMockDatasetData = () => ({
  '@metadata': {
    assetType: 'datasets',
    assetId: 'sample-dataset-456',
    status: 'enriched',
    name: 'Customer Analytics Dataset'
  },
  DataSet: {
    DataSetId: 'sample-dataset-456',
    Name: 'Customer Analytics Dataset',
    ImportMode: 'SPICE',
    PhysicalTableMap: {
      'customer-table': {
        RelationalTable: {
          DataSourceArn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/customer-db-789',
          Schema: 'public',
          Name: 'customers',
          InputColumns: [
            { Name: 'customer_id', Type: 'INTEGER' },
            { Name: 'first_name', Type: 'STRING' },
            { Name: 'last_name', Type: 'STRING' },
            { Name: 'email', Type: 'STRING' }
          ]
        }
      }
    }
  },
  Tags: [
    { key: 'Source', value: 'Customer Database' }
  ]
});

// Shared mock data generators (consistent with other stories)
const createMockAsset = (
  id: string, 
  name: string, 
  type: 'dashboard' | 'analysis' | 'dataset' | 'datasource'
) => ({
  id,
  name,
  type,
  arn: `arn:aws:quicksight:us-east-1:123456789012:${type}/${id}`,
  lastUpdated: '2024-03-20T14:45:00Z'
});

const mockAssets = {
  dashboards: [
    createMockAsset('dash-001', 'Executive Dashboard', 'dashboard'),
    createMockAsset('dash-002', 'Sales Performance Dashboard', 'dashboard'),
    createMockAsset('dash-003', 'Operations Dashboard', 'dashboard'),
  ],
  datasets: [
    createMockAsset('dataset-001', 'Sales Data 2024', 'dataset'),
    createMockAsset('dataset-002', 'Customer Demographics', 'dataset'),
    createMockAsset('dataset-003', 'Product Catalog', 'dataset'),
  ],
  analyses: [
    createMockAsset('analysis-001', 'Quarterly Review Analysis', 'analysis'),
    createMockAsset('analysis-002', 'Customer Segmentation Study', 'analysis'),
  ],
};

const meta: Meta<typeof JsonViewerModal> = {
  title: 'Shared/UI/JsonViewerModal',
  component: JsonViewerModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A modal component for viewing and exploring asset JSON data with syntax highlighting, search, type-specific highlighting, tabs, and line numbers.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      // In docs mode, show a simple placeholder to avoid API calls
      if (context.viewMode === 'docs') {
        return (
          <Box sx={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
            <Typography color="text.secondary" align="center">
              JSON Viewer Modal<br />
              <small>Click on individual stories to see them in action</small>
            </Typography>
          </Box>
        );
      }
      
      return (
        <QueryClientProvider client={createQueryClientWithMocks()}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls whether the modal is open',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when modal is closed',
    },
    assetId: {
      control: 'text',
      description: 'ID of the asset to view',
    },
    assetName: {
      control: 'text',
      description: 'Display name of the asset',
    },
    assetType: {
      control: 'select',
      options: ['dashboard', 'analysis', 'dataset', 'datasource', 'folder', 'user', 'group'],
      description: 'Type of the asset',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Core modal stories
export const Default: Story = {
  args: {
    open: true,
    assetId: 'sample-dashboard-123',
    assetName: 'Sales Performance Dashboard',
    assetType: 'dashboard',
  },
};

export const DashboardModal: Story = {
  args: {
    open: true,
    assetId: 'sample-dashboard-123',
    assetName: 'Sales Performance Dashboard',
    assetType: 'dashboard',
  },
};

export const DatasetModal: Story = {
  args: {
    open: true,
    assetId: 'sample-dataset-456',
    assetName: 'Customer Analytics Dataset',
    assetType: 'dataset',
  },
};

export const AnalysisModal: Story = {
  args: {
    open: true,
    assetId: 'analysis-001',
    assetName: 'Quarterly Business Review',
    assetType: 'analysis',
  },
};

export const WithIconButton: Story = {
  render: () => {
    const [modalOpen, setModalOpen] = useState(false);
    const mockAsset = mockAssets.dashboards[0];
    
    return (
      <Stack spacing={2} alignItems="center">
        <Typography variant="h6">JSON Viewer Icon Button</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography>Click to view JSON:</Typography>
          <JsonViewerIconButton
            asset={mockAsset}
            assetType="dashboard"
            onView={() => setModalOpen(true)}
          />
        </Box>
        <JsonViewerModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          assetId="sample-dashboard-123"
          assetName={mockAsset.name}
          assetType="dashboard"
        />
      </Stack>
    );
  },
};

export const LongAssetName: Story = {
  args: {
    open: true,
    assetId: 'long-name-asset',
    assetName: 'Enterprise Executive Dashboard with Real-time KPIs and Advanced Analytics for Board Reporting Q4 2024',
    assetType: 'dashboard',
  },
};
