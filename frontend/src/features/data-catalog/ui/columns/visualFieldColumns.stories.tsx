import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import { createVisualFieldColumns } from './visualFieldColumns';

import type { VisualFieldRow } from '../../types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const mockData: VisualFieldRow[] = [
  {
    id: '1',
    fieldName: 'total_revenue',
    fieldType: 'CALCULATED_FIELD',
    dataType: 'DECIMAL',
    datasetName: 'Sales Dataset',
    visualsCount: 12,
    visualTypes: ['BAR_CHART', 'LINE_CHART', 'TABLE'],
    sources: [
      { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Dashboard' },
      { assetType: 'analysis', assetId: 'an-1', assetName: 'Revenue Analysis' },
    ],
    dashboardsCount: 3,
    analysesCount: 2,
  },
  {
    id: '2',
    fieldName: 'customer_name',
    fieldType: 'DIMENSION',
    dataType: 'STRING',
    datasetName: 'Customer Dataset',
    visualsCount: 8,
    visualTypes: ['TABLE', 'PIE_CHART'],
    sources: [
      { assetType: 'dashboard', assetId: 'db-2', assetName: 'Customer Dashboard' },
    ],
    dashboardsCount: 2,
    analysesCount: 0,
  },
  {
    id: '3',
    fieldName: 'order_date',
    fieldType: 'DIMENSION',
    dataType: 'DATETIME',
    datasetName: 'Orders Dataset',
    visualsCount: 15,
    visualTypes: ['LINE_CHART', 'AREA_CHART', 'COMBO_CHART', 'HEAT_MAP', 'SCATTER_PLOT'],
    sources: [
      { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Dashboard' },
      { assetType: 'dashboard', assetId: 'db-3', assetName: 'Orders Dashboard' },
      { assetType: 'analysis', assetId: 'an-2', assetName: 'Time Analysis' },
    ],
    dashboardsCount: 5,
    analysesCount: 3,
  },
  {
    id: '4',
    fieldName: 'quantity',
    fieldType: 'MEASURE',
    dataType: 'INTEGER',
    datasetName: 'Orders Dataset',
    visualsCount: 0,
    visualTypes: [],
    sources: [],
    dashboardsCount: 0,
    analysesCount: 0,
  },
];

const defaultCallbacks = {
  onShowDetails: (field: VisualFieldRow) =>
    alert(`Show details for: ${field.fieldName}`),
};

const meta: Meta = {
  title: 'Features/DataCatalog/Columns/VisualFieldColumns',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Column definitions for the visual fields view in the data catalog. Shows field usage across visuals, visual types, and asset counts.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const StorySection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 500 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

export const AllColumns: Story = {
  render: () => {
    const columns = createVisualFieldColumns(defaultCallbacks);
    return (
      <StorySection title="Visual Fields View">
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={mockData}
            columns={columns}
            pageSizeOptions={[5, 10]}
            initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
            disableRowSelectionOnClick
          />
        </Box>
      </StorySection>
    );
  },
};

export const CalculatedFields: Story = {
  render: () => {
    const columns = createVisualFieldColumns(defaultCallbacks);
    const filteredData = mockData.filter(
      (d) => d.fieldType === 'CALCULATED_FIELD'
    );
    return (
      <StorySection title="Calculated Fields">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Calculated fields show a calculator icon
        </Typography>
        <Box sx={{ height: 250, width: '100%' }}>
          <DataGrid
            rows={filteredData}
            columns={columns}
            pageSizeOptions={[5]}
            disableRowSelectionOnClick
          />
        </Box>
      </StorySection>
    );
  },
};

export const VisualTypesOverflow: Story = {
  render: () => {
    const columns = createVisualFieldColumns(defaultCallbacks);
    const filteredData = mockData.filter(
      (d) => d.visualTypes && d.visualTypes.length > 3
    );
    return (
      <StorySection title="Visual Types Overflow">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          When there are more than 3 visual types, shows +N more chip
        </Typography>
        <Box sx={{ height: 250, width: '100%' }}>
          <DataGrid
            rows={filteredData}
            columns={columns}
            pageSizeOptions={[5]}
            disableRowSelectionOnClick
          />
        </Box>
      </StorySection>
    );
  },
};

export const UnusedFields: Story = {
  render: () => {
    const columns = createVisualFieldColumns(defaultCallbacks);
    const filteredData = mockData.filter((d) => d.visualsCount === 0);
    return (
      <StorySection title="Unused Fields">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Fields with zero usage show disabled styling
        </Typography>
        <Box sx={{ height: 250, width: '100%' }}>
          <DataGrid
            rows={filteredData}
            columns={columns}
            pageSizeOptions={[5]}
            disableRowSelectionOnClick
          />
        </Box>
      </StorySection>
    );
  },
};
