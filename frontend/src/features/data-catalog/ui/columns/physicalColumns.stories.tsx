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
  },
  {
    id: '2',
    fieldName: 'order_total',
    dataType: 'DECIMAL',
    isCalculated: false,
    hasVariants: false,
    usageCount: 15,
  },
  {
    id: '3',
    fieldName: 'profit_margin',
    dataType: 'DECIMAL',
    isCalculated: true,
    hasVariants: true,
    usageCount: 8,
    expressions: ['[Revenue] - [Cost]', '[Revenue] * 0.1'],
  },
  {
    id: '4',
    fieldName: 'order_date',
    dataType: 'DATETIME',
    isCalculated: false,
    hasVariants: false,
    usageCount: 25,
  },
  {
    id: '5',
    fieldName: 'product_price',
    dataType: 'STRING',
    isCalculated: false,
    hasVariants: true,
    usageCount: 10,
    variants: [
      { dataType: 'STRING', count: 3 },
      { dataType: 'DECIMAL', count: 2 },
      { dataType: 'INTEGER', count: 1 },
    ],
  },
  {
    id: '6',
    fieldName: 'unused_field',
    dataType: 'STRING',
    isCalculated: false,
    hasVariants: false,
    usageCount: 0,
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
          'Column definitions for the physical fields view in the data catalog. Shows field names, data types, usage counts, and action buttons.',
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
      <StorySection title="Physical Columns View">
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
