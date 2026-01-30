import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

import { createCalculatedColumns } from './calculatedColumns';

import type { CalculatedFieldRow } from '../../types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const mockData: CalculatedFieldRow[] = [
  {
    id: '1',
    fieldName: 'total_revenue',
    dataType: 'DECIMAL',
    isCalculated: true,
    hasVariants: false,
    expression: 'sum({amount})',
    expressionLength: 13,
    hasComments: false,
    usageCount: 25,
    sources: [
      { assetType: 'dataset', assetId: 'ds-1', assetName: 'Sales Dataset' },
      { assetType: 'dataset', assetId: 'ds-2', assetName: 'Revenue Dataset' },
      { assetType: 'dashboard', assetId: 'db-1', assetName: 'Sales Dashboard' },
    ],
    fieldReferences: ['amount'],
  },
  {
    id: '2',
    fieldName: 'profit_margin',
    dataType: 'DECIMAL',
    isCalculated: true,
    hasVariants: true,
    expression: '({revenue} - {cost}) / {revenue} * 100',
    expressionLength: 42,
    hasComments: true,
    usageCount: 12,
    sources: [
      { assetType: 'analysis', assetId: 'an-1', assetName: 'Profit Analysis' },
    ],
    fieldReferences: ['revenue', 'cost'],
    expressions: [
      '({revenue} - {cost}) / {revenue} * 100',
      '({total_revenue} - {total_cost}) / {total_revenue} * 100',
      'ifelse({revenue} > 0, ({revenue} - {cost}) / {revenue} * 100, 0)',
    ],
  },
  {
    id: '3',
    fieldName: 'year_over_year_growth',
    dataType: 'DECIMAL',
    isCalculated: true,
    hasVariants: false,
    expression:
      'percentDifference(sum({amount}), [{date} ASC], PRE_AGG, -1, Year)',
    expressionLength: 68,
    hasComments: false,
    usageCount: 5,
    sources: [
      { assetType: 'dashboard', assetId: 'db-2', assetName: 'Growth Dashboard' },
      { assetType: 'dashboard', assetId: 'db-3', assetName: 'Executive Dashboard' },
    ],
    fieldReferences: ['amount', 'date'],
  },
  {
    id: '4',
    fieldName: 'complex_calculation',
    dataType: 'DECIMAL',
    isCalculated: true,
    hasVariants: false,
    expression: `ifelse(
  {region} = 'North America',
  sum({amount}) * 1.1,
  ifelse(
    {region} = 'Europe',
    sum({amount}) * 1.05,
    sum({amount})
  )
)`,
    expressionLength: 180,
    hasComments: true,
    usageCount: 3,
    sources: [
      { assetType: 'dataset', assetId: 'ds-3', assetName: 'Regional Dataset' },
    ],
    fieldReferences: ['region', 'amount'],
  },
  {
    id: '5',
    fieldName: 'simple_count',
    dataType: 'INTEGER',
    isCalculated: true,
    hasVariants: false,
    expression: 'count({id})',
    expressionLength: 12,
    hasComments: false,
    usageCount: 0,
    sources: [],
    fieldReferences: ['id'],
  },
  {
    id: '6',
    fieldName: 'very_complex_nested_calculation',
    dataType: 'DECIMAL',
    isCalculated: true,
    hasVariants: false,
    expression: `// This is a complex calculation with nested conditions and multiple field references
sumOver(
  ifelse(
    {status} = 'Active' AND {region} IN ('US', 'CA', 'MX'),
    {amount} * {exchange_rate} * (1 - {discount_rate}),
    ifelse(
      {status} = 'Pending',
      {amount} * {exchange_rate} * 0.5,
      0
    )
  ),
  [{category}],
  PRE_AGG
)`,
    expressionLength: 520,
    hasComments: true,
    usageCount: 8,
    sources: [
      { assetType: 'dataset', assetId: 'ds-4', assetName: 'Complex Dataset' },
      { assetType: 'analysis', assetId: 'an-2', assetName: 'Deep Analysis' },
      { assetType: 'analysis', assetId: 'an-3', assetName: 'Regional Analysis' },
      { assetType: 'dashboard', assetId: 'db-4', assetName: 'Complex Dashboard' },
    ],
    fieldReferences: [
      'status',
      'region',
      'amount',
      'exchange_rate',
      'discount_rate',
      'category',
    ],
  },
];

const defaultCallbacks = {
  onShowExpression: (field: CalculatedFieldRow) =>
    alert(`Show expression for: ${field.fieldName}`),
  onShowDetails: (field: CalculatedFieldRow) =>
    alert(`Show details for: ${field.fieldName}`),
  onShowVariants: (field: CalculatedFieldRow) =>
    alert(`Show variants for: ${field.fieldName}`),
};

const meta: Meta = {
  title: 'Features/DataCatalog/Columns/CalculatedColumns',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Column definitions for the calculated fields view in the data catalog. Shows field expressions, dependencies, sources, and complexity indicators.',
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
    const columns = createCalculatedColumns(defaultCallbacks);
    return (
      <StorySection title="Calculated Fields View">
        <Box sx={{ height: 500, width: '100%' }}>
          <DataGrid
            rows={mockData}
            columns={columns}
            pageSizeOptions={[5, 10]}
            initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
            disableRowSelectionOnClick
            getRowHeight={() => 'auto'}
          />
        </Box>
      </StorySection>
    );
  },
};

export const ExpressionLengthVariants: Story = {
  render: () => {
    const columns = createCalculatedColumns(defaultCallbacks);
    return (
      <StorySection title="Expression Length Color Coding">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Expression length chips are color-coded: green (&lt;100), yellow
          (100-500), red (&gt;500)
        </Typography>
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={mockData}
            columns={columns}
            pageSizeOptions={[10]}
            disableRowSelectionOnClick
            getRowHeight={() => 'auto'}
          />
        </Box>
      </StorySection>
    );
  },
};

export const FieldsWithVariants: Story = {
  render: () => {
    const columns = createCalculatedColumns(defaultCallbacks);
    const filteredData = mockData.filter((d) => d.hasVariants);
    return (
      <StorySection title="Fields with Expression Variants">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Fields with different expressions across assets show a warning icon
          and variants button
        </Typography>
        <Box sx={{ height: 300, width: '100%' }}>
          <DataGrid
            rows={filteredData}
            columns={columns}
            pageSizeOptions={[5]}
            disableRowSelectionOnClick
            getRowHeight={() => 'auto'}
          />
        </Box>
      </StorySection>
    );
  },
};

export const FieldsWithComments: Story = {
  render: () => {
    const columns = createCalculatedColumns(defaultCallbacks);
    const filteredData = mockData.filter((d) => d.hasComments);
    return (
      <StorySection title="Fields with Comments">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Fields with comments in their expressions show a comment icon
        </Typography>
        <Box sx={{ height: 350, width: '100%' }}>
          <DataGrid
            rows={filteredData}
            columns={columns}
            pageSizeOptions={[5]}
            disableRowSelectionOnClick
            getRowHeight={() => 'auto'}
          />
        </Box>
      </StorySection>
    );
  },
};

export const SourcesDisplay: Story = {
  render: () => {
    const columns = createCalculatedColumns(defaultCallbacks);
    return (
      <StorySection title="Asset Sources Display">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sources column shows grouped asset chips with tooltips containing
          asset names
        </Typography>
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={mockData}
            columns={columns}
            pageSizeOptions={[10]}
            disableRowSelectionOnClick
            getRowHeight={() => 'auto'}
          />
        </Box>
      </StorySection>
    );
  },
};
