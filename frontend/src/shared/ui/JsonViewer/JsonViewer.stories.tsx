import type { Meta, StoryObj } from '@storybook/react-vite';

import { MockedApi, type MockRoute } from '../../../../.storybook/mocks/api';
import JsonViewerModal from './components/JsonViewerModal';

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
      tags: '2024-03-20T14:45:00Z',
    },
    exportTime: '2024-03-20T14:45:00Z',
    sheetCount: 3,
    visualCount: 12,
    visualFieldMappingCount: 45,
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
        'arn:aws:quicksight:us-east-1:123456789012:dataset/customer-data-789',
      ],
      Sheets: [
        { Name: 'Overview', SheetId: 'sheet-overview-001' },
        { Name: 'Regional Analysis', SheetId: 'sheet-regional-002' },
        { Name: 'Trend Analysis', SheetId: 'sheet-trends-003' },
      ],
    },
  },
  Definition: {
    DataSetIdentifierDeclarations: [
      {
        Identifier: 'sales-data',
        DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/sales-data-456',
      },
      {
        Identifier: 'customer-data',
        DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/customer-data-789',
      },
    ],
    CalculatedFields: [
      {
        DataSetIdentifier: 'sales-data',
        Expression: 'sum({Revenue})',
        Name: 'Total Revenue',
      },
      {
        DataSetIdentifier: 'sales-data',
        Expression: 'concat({FirstName}, " ", {LastName})',
        Name: 'Full Name',
      },
      {
        DataSetIdentifier: 'customer-data',
        Expression: 'ifelse({Status} = "Premium", {Price} * 0.9, {Price})',
        Name: 'Discounted Price',
      },
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
                    Values: [{ NumericalMeasureField: { FieldId: 'revenue-field' } }],
                  },
                },
              },
            },
          },
          {
            LineChartVisual: {
              VisualId: 'visual-line-002',
              Title: { Visibility: 'VISIBLE', Text: 'Sales Trend' },
              ChartConfiguration: {
                FieldWells: {
                  LineChartAggregatedFieldWells: {
                    Category: [{ DateDimensionField: { FieldId: 'date-field' } }],
                    Values: [{ NumericalMeasureField: { FieldId: 'sales-field' } }],
                  },
                },
              },
            },
          },
        ],
      },
    ],
    FilterGroups: [
      {
        FilterGroupId: 'filter-group-001',
        Filters: [
          {
            DateTimeFilter: {
              FilterId: 'date-filter-001',
              Column: { DataSetIdentifier: 'sales-data', ColumnName: 'OrderDate' },
            },
          },
          {
            NumericRangeFilter: {
              FilterId: 'revenue-filter-002',
              Column: { DataSetIdentifier: 'sales-data', ColumnName: 'Revenue' },
            },
          },
        ],
      },
    ],
  },
  Permissions: [
    {
      principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/john.doe',
      principalType: 'USER',
      actions: ['quicksight:DescribeDashboard', 'quicksight:QueryDashboard'],
    },
    {
      principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/sales-team',
      principalType: 'GROUP',
      actions: ['quicksight:DescribeDashboard'],
    },
  ],
  Tags: [
    { key: 'Department', value: 'Sales' },
    { key: 'Environment', value: 'Production' },
    { key: 'Owner', value: 'Sales Team' },
  ],
});

const cachedAssetRoute = (respond: MockRoute['respond']): MockRoute[] => [
  { method: 'get', url: /\/assets\/[^/]+\/[^/]+\/cached$/, respond },
];

const serveCachedAssets = cachedAssetRoute(() => ({
  body: { success: true, data: createMockDashboardData() },
}));

const meta = {
  title: 'Shared/UI/JsonViewerModal',
  component: JsonViewerModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          "Views an asset's cached JSON in tabs (full, describe, definition, metadata, permissions, tags) with search and type highlighting.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => {},
    assetId: 'sample-dashboard-123',
    assetName: 'Sales Performance Dashboard',
    assetType: 'dashboard',
  },
  render: (args, { parameters }) => (
    <MockedApi routes={(parameters.routes as MockRoute[] | undefined) ?? serveCachedAssets}>
      <JsonViewerModal {...args} />
    </MockedApi>
  ),
} satisfies Meta<typeof JsonViewerModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Each story uses its own asset id: the preview's query client is shared.

export const Default: Story = {};

export const LoadError: Story = {
  args: {
    assetId: 'missing-dashboard',
    assetName:
      'Enterprise Executive Dashboard with Real-time KPIs and Advanced Analytics for Board Reporting Q4 2024',
  },
  parameters: {
    routes: cachedAssetRoute(() => ({
      status: 404,
      body: { success: false, error: 'Asset not found in cache' },
    })),
  },
};
