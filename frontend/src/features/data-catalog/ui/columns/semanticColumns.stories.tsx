import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import { createSemanticColumns } from './semanticColumns';

import type { SemanticTermRow } from '../../types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const mockData: SemanticTermRow[] = [
  {
    id: '1',
    businessName: 'Revenue',
    description: 'Total revenue generated from all sales transactions',
    mappedFieldsCount: 5,
    businessUsageCount: 45,
    businessDatasetsCount: 3,
    businessAnalysesCount: 4,
    businessDashboardsCount: 6,
    hasCalculatedFields: true,
    hasVariants: false,
    source: 'Manual',
  },
  {
    id: '2',
    businessName: 'Customer ID',
    description: 'Unique identifier for each customer in the system',
    mappedFieldsCount: 8,
    businessUsageCount: 32,
    businessDatasetsCount: 5,
    businessAnalysesCount: 2,
    businessDashboardsCount: 4,
    hasCalculatedFields: false,
    hasVariants: false,
    source: 'Auto',
  },
  {
    id: '3',
    businessName: 'Profit Margin',
    description: 'Calculated profit margin percentage',
    mappedFieldsCount: 3,
    businessUsageCount: 18,
    businessDatasetsCount: 2,
    businessAnalysesCount: 3,
    businessDashboardsCount: 2,
    hasCalculatedFields: true,
    hasVariants: true,
    variantFields: [
      { fieldName: 'profit_margin_pct', dataType: 'DECIMAL' },
      { fieldName: 'margin_rate', dataType: 'DECIMAL' },
      { fieldName: 'profit_margin', dataType: 'INTEGER' },
    ],
    source: 'Manual',
  },
  {
    id: '4',
    businessName: 'Order Date',
    description: 'Date when the order was placed',
    mappedFieldsCount: 4,
    businessUsageCount: 28,
    businessDatasetsCount: 3,
    businessAnalysesCount: 2,
    businessDashboardsCount: 3,
    hasCalculatedFields: false,
    hasVariants: false,
    source: 'Auto',
  },
  {
    id: '5',
    businessName: 'Region',
    description: 'Geographic region classification',
    mappedFieldsCount: 0,
    businessUsageCount: 0,
    businessDatasetsCount: 0,
    businessAnalysesCount: 0,
    businessDashboardsCount: 0,
    hasCalculatedFields: false,
    hasVariants: false,
    source: 'Manual',
  },
];

const defaultCallbacks = {
  onEditTerm: (term: SemanticTermRow) =>
    alert(`Edit term: ${term.businessName}`),
  onDeleteTerm: (term: SemanticTermRow) =>
    alert(`Delete term: ${term.businessName}`),
  onShowMappedFields: (term: SemanticTermRow) =>
    alert(`Show mapped fields for: ${term.businessName}`),
};

const meta: Meta = {
  title: 'Features/DataCatalog/Columns/SemanticColumns',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Column definitions for the semantic/business terms view in the data catalog. Shows business terms, descriptions, mapped field counts, and usage metrics.',
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
    const columns = createSemanticColumns({
      ...defaultCallbacks,
      visualFieldCatalog: { termUsageCounts: { Revenue: 45, 'Customer ID': 32 } },
    });
    return (
      <StorySection title="Semantic Terms View">
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

export const TermsWithCalculatedFields: Story = {
  render: () => {
    const columns = createSemanticColumns({
      ...defaultCallbacks,
      visualFieldCatalog: { termUsageCounts: {} },
    });
    const filteredData = mockData.filter((d) => d.hasCalculatedFields);
    return (
      <StorySection title="Terms with Calculated Fields">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Terms that include calculated fields show a calculator icon
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

export const TermsWithVariants: Story = {
  render: () => {
    const columns = createSemanticColumns({
      ...defaultCallbacks,
      visualFieldCatalog: { termUsageCounts: {} },
    });
    const filteredData = mockData.filter(
      (d) => d.variantFields && d.variantFields.length > 1
    );
    return (
      <StorySection title="Terms with Data Type Variants">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Terms mapped to fields with different data types show a variants chip
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

export const WithoutUsageData: Story = {
  render: () => {
    const columns = createSemanticColumns({
      ...defaultCallbacks,
      visualFieldCatalog: undefined,
    });
    return (
      <StorySection title="Without Visual Usage Data">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          When visual field catalog is not available, usage column shows "-"
        </Typography>
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={mockData}
            columns={columns}
            pageSizeOptions={[5]}
            disableRowSelectionOnClick
          />
        </Box>
      </StorySection>
    );
  },
};

export const UnusedTerms: Story = {
  render: () => {
    const columns = createSemanticColumns({
      ...defaultCallbacks,
      visualFieldCatalog: { termUsageCounts: {} },
    });
    const filteredData = mockData.filter((d) => d.mappedFieldsCount === 0);
    return (
      <StorySection title="Unused Terms">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Terms with no mapped fields show disabled styling
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
