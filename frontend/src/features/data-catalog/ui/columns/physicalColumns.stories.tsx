import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import { createPhysicalColumns } from './physicalColumns';

import type { PhysicalFieldRow } from '../../types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const mockData: PhysicalFieldRow[] = [
  {
    id: '1',
    fieldName: 'customer_id',
    dataType: 'STRING',
    isCalculated: false,
    hasVariants: false,
    usageCount: 42,
    datasetsCount: 3,
    dashboardsCount: 5,
    sources: [
      { assetType: 'dataset', assetId: 'ds-1', assetName: 'Customers' },
      { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Overview' },
    ],
  },
  {
    id: '2',
    fieldName: 'order_total',
    dataType: 'DECIMAL',
    isCalculated: false,
    hasVariants: false,
    usageCount: 15,
    datasetsCount: 2,
    dashboardsCount: 2,
    sources: [
      { assetType: 'dataset', assetId: 'ds-2', assetName: 'Orders' },
      { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Overview' },
    ],
  },
  {
    id: '3',
    fieldName: 'profit_margin',
    dataType: 'DECIMAL',
    isCalculated: true,
    hasVariants: true,
    hasExpressionConflict: true,
    conflictCount: 2,
    usageCount: 8,
    datasetsCount: 1,
    dashboardsCount: 2,
    expression: '({revenue} - {cost}) / {revenue} * 100',
    expressions: ['({revenue} - {cost}) / {revenue} * 100', '{revenue} * 0.1'],
    sources: [
      { assetType: 'dataset', assetId: 'ds-3', assetName: 'Finance' },
      { assetType: 'dashboard', assetId: 'db-2', assetName: 'Exec KPIs' },
    ],
  },
  {
    id: '4',
    fieldName: 'net_revenue',
    dataType: 'DECIMAL',
    isCalculated: true,
    hasVariants: false,
    usageCount: 30,
    datasetsCount: 2,
    dashboardsCount: 3,
    expression: 'sum({amount})',
    sources: [
      { assetType: 'dataset', assetId: 'ds-3', assetName: 'Finance' },
      { assetType: 'dashboard', assetId: 'db-2', assetName: 'Exec KPIs' },
    ],
  },
  {
    id: '5',
    fieldName: 'product_price',
    dataType: 'STRING',
    isCalculated: false,
    hasVariants: true,
    usageCount: 10,
    datasetsCount: 3,
    variants: [
      { dataType: 'STRING', count: 3 },
      { dataType: 'DECIMAL', count: 2 },
      { dataType: 'INTEGER', count: 1 },
    ],
    sources: [
      { assetType: 'dataset', assetId: 'ds-4', assetName: 'Products' },
      { assetType: 'dataset', assetId: 'ds-5', assetName: 'Pricing' },
    ],
  },
  {
    id: '6',
    fieldName: 'unused_field',
    dataType: 'STRING',
    isCalculated: false,
    hasVariants: false,
    usageCount: 0,
    sources: [],
  },
];

const defaultCallbacks = {
  onShowDetails: (field: PhysicalFieldRow) =>
    alert(`Show details for: ${field.fieldName}`),
  onShowVariants: (field: PhysicalFieldRow) =>
    alert(`Show variants for: ${field.fieldName}`),
};

const meta: Meta = {
  title: 'Features/DataCatalog/Columns/PhysicalColumns',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Column definitions for the All Fields view in the data catalog. Shows field name, kind (physical vs calculated, with conflict flag), data type (with variant breakdown), where the field is used, and total usage.',
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
    const columns = createPhysicalColumns(defaultCallbacks);
    return (
      <StorySection title="All Fields View">
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

export const FieldNameVariants: Story = {
  render: () => {
    const columns = createPhysicalColumns(defaultCallbacks);
    const filteredData = mockData.filter(
      (d) => d.isCalculated || d.hasVariants
    );
    return (
      <StorySection title="Field Name Variants (Calculated & Data Type Variants)">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shows calculated field icons and warning icons for data type variants
        </Typography>
        <Box sx={{ height: 300, width: '100%' }}>
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

export const UsageCountStates: Story = {
  render: () => {
    const columns = createPhysicalColumns(defaultCallbacks);
    return (
      <StorySection title="Usage Count States">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Count cells show enabled styling when &gt; 0, disabled styling when 0
        </Typography>
        <Box sx={{ height: 300, width: '100%' }}>
          <DataGrid
            rows={mockData}
            columns={columns}
            pageSizeOptions={[5, 10]}
            disableRowSelectionOnClick
          />
        </Box>
      </StorySection>
    );
  },
};
