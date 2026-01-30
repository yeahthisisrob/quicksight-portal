import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import { createMappingColumns } from './mappingColumns';

import type { MappingRow } from '../../types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const mockData: MappingRow[] = [
  {
    id: '1',
    fieldName: 'total_revenue',
    termName: 'Revenue',
    confidence: 95,
    method: 'manual',
    dataType: 'DECIMAL',
    datasetsCount: 3,
    analysesCount: 2,
  },
  {
    id: '2',
    fieldName: 'customer_id',
    termName: 'Customer ID',
    confidence: 88,
    method: 'auto',
    dataType: 'STRING',
    datasetsCount: 5,
    analysesCount: 1,
  },
  {
    id: '3',
    fieldName: 'order_date',
    termName: 'Order Date',
    confidence: 72,
    method: 'suggested',
    dataType: 'DATETIME',
    datasetsCount: 2,
    analysesCount: 0,
  },
  {
    id: '4',
    fieldName: 'profit_pct',
    termName: 'Profit Margin',
    confidence: 45,
    method: 'auto',
    dataType: 'DECIMAL',
    datasetsCount: 1,
    analysesCount: 1,
  },
  {
    id: '5',
    fieldName: 'region_code',
    termName: 'Region',
    confidence: 30,
    method: 'suggested',
    dataType: 'STRING',
    datasetsCount: 0,
    analysesCount: 0,
  },
  {
    id: '6',
    fieldName: 'quantity_sold',
    termName: 'Quantity',
    confidence: 100,
    method: 'manual',
    dataType: 'INTEGER',
    datasetsCount: 4,
    analysesCount: 3,
  },
];

const defaultCallbacks = {
  onEditMapping: (mapping: MappingRow) =>
    alert(`Edit mapping: ${mapping.fieldName} -> ${mapping.termName}`),
  onDeleteMapping: (mapping: MappingRow) =>
    alert(`Delete mapping: ${mapping.fieldName} -> ${mapping.termName}`),
};

const meta: Meta = {
  title: 'Features/DataCatalog/Columns/MappingColumns',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Column definitions for the field-to-term mappings view in the data catalog. Shows field names, business terms, confidence scores, and mapping methods.',
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
    const columns = createMappingColumns(defaultCallbacks);
    return (
      <StorySection title="Field Mappings View">
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

export const ConfidenceScoreVariants: Story = {
  render: () => {
    const columns = createMappingColumns(defaultCallbacks);
    return (
      <StorySection title="Confidence Score Color Coding">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Confidence progress bars are color-coded: green (&ge;80%), yellow
          (50-79%), red (&lt;50%)
        </Typography>
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={mockData}
            columns={columns}
            pageSizeOptions={[10]}
            disableRowSelectionOnClick
          />
        </Box>
      </StorySection>
    );
  },
};

export const MappingMethods: Story = {
  render: () => {
    const columns = createMappingColumns(defaultCallbacks);
    return (
      <StorySection title="Mapping Methods">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manual mappings show a filled primary chip, auto/suggested show
          outlined chips
        </Typography>
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={mockData}
            columns={columns}
            pageSizeOptions={[10]}
            disableRowSelectionOnClick
          />
        </Box>
      </StorySection>
    );
  },
};

export const HighConfidenceMappings: Story = {
  render: () => {
    const columns = createMappingColumns(defaultCallbacks);
    const filteredData = mockData.filter((d) => d.confidence >= 80);
    return (
      <StorySection title="High Confidence Mappings">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mappings with confidence score &ge; 80%
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

export const LowConfidenceMappings: Story = {
  render: () => {
    const columns = createMappingColumns(defaultCallbacks);
    const filteredData = mockData.filter((d) => d.confidence < 50);
    return (
      <StorySection title="Low Confidence Mappings">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mappings with confidence score &lt; 50% that may need review
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

export const ManualMappings: Story = {
  render: () => {
    const columns = createMappingColumns(defaultCallbacks);
    const filteredData = mockData.filter((d) => d.method === 'manual');
    return (
      <StorySection title="Manual Mappings">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mappings created manually by users
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
