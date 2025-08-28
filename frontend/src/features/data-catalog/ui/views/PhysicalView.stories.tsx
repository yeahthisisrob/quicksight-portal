import { useState } from 'react';

import PhysicalView from './PhysicalView';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataCatalog/Views/PhysicalView',
  component: PhysicalView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Physical fields view for the data catalog, displaying all fields from datasets and analyses with their properties, mapping status, and usage information.',
      },
    },
  },
} satisfies Meta<typeof PhysicalView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data
const sampleFields = Array.from({ length: 50 }, (_, i) => ({
  id: `field-${i + 1}`,
  fieldName: `customer_field_${i + 1}`,
  dataType: ['STRING', 'INTEGER', 'DECIMAL', 'DATETIME', 'BOOLEAN'][i % 5],
  mapping: i % 3 === 0 ? {
    termName: `Business Term ${i}`,
    confidence: 0.85 + (i % 15) / 100,
  } : null,
  datasetsCount: Math.floor(Math.random() * 10),
  analysesCount: Math.floor(Math.random() * 5),
  dashboardsCount: Math.floor(Math.random() * 15),
  sources: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, j) => ({
    assetType: ['dataset', 'analysis'][j % 2],
    assetId: `asset-${i}-${j}`,
    assetName: `Asset ${i}-${j}`,
  })),
  description: i % 4 === 0 ? `Description for field ${i + 1}` : undefined,
  tags: i % 5 === 0 ? [{ key: 'Department', value: 'Sales' }] : [],
  usageCount: Math.floor(Math.random() * 1000),
  isCalculated: i % 3 === 0,
  hasVariants: i % 7 === 0,
  variants: i % 7 === 0 ? [
    { dataType: 'STRING', count: 3 },
    { dataType: 'INTEGER', count: 2 },
  ] : [],
  expression: i % 3 === 0 ? `sum({field_${i}}) / count({field_${i}})` : undefined,
  expressions: i % 3 === 0 && i % 7 === 0 ? [
    { expression: `sum({field_${i}})`, assetId: 'asset-1' },
    { expression: `avg({field_${i}})`, assetId: 'asset-2' },
  ] : [],
  semanticFieldId: `field:${i}`,
}));

const sampleTerms = [
  { id: 'term-1', businessName: 'Customer Revenue', term: 'customer_revenue' },
  { id: 'term-2', businessName: 'Order Total', term: 'order_total' },
  { id: 'term-3', businessName: 'Product Price', term: 'product_price' },
];

const InteractiveWrapper = () => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortModel, setSortModel] = useState<any[]>([]);

  return (
    <PhysicalView
      data={sampleFields.slice(page * pageSize, (page + 1) * pageSize)}
      terms={sampleTerms}
      mappings={[]}
      loading={false}
      totalItems={sampleFields.length}
      page={page}
      pageSize={pageSize}
      sortModel={sortModel}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      onSortModelChange={setSortModel}
      onMapField={() => {}}
      onShowDetails={() => {}}
      onShowVariants={() => {}}
      onShowAssets={() => {}}
    />
  );
};

export const Default: Story = {
  render: () => <InteractiveWrapper />,
  args: {} as any, // Required by Storybook type but not used with render
};

export const Loading: Story = {
  args: {
    data: [],
    terms: [],
    mappings: [],
    loading: true,
    totalItems: 0,
    page: 0,
    pageSize: 25,
    sortModel: [],
    onPageChange: () => {},
    onPageSizeChange: () => {},
    onSortModelChange: () => {},
    onMapField: () => {},
    onShowDetails: () => {},
    onShowVariants: () => {},
    onShowAssets: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Physical view in loading state.',
      },
    },
  },
};

export const Empty: Story = {
  args: {
    data: [],
    terms: sampleTerms,
    mappings: [],
    loading: false,
    totalItems: 0,
    page: 0,
    pageSize: 25,
    sortModel: [],
    onPageChange: () => {},
    onPageSizeChange: () => {},
    onSortModelChange: () => {},
    onMapField: () => {},
    onShowDetails: () => {},
    onShowVariants: () => {},
    onShowAssets: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: 'Physical view with no data.',
      },
    },
  },
};

export const WithCalculatedFields: Story = {
  render: () => {
    const calculatedFields = sampleFields.filter(f => f.isCalculated);
    return (
      <PhysicalView
        data={calculatedFields}
        terms={sampleTerms}
        mappings={[]}
        loading={false}
        totalItems={calculatedFields.length}
        page={0}
        pageSize={25}
        sortModel={[]}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        onSortModelChange={() => {}}
        onMapField={() => {}}
        onShowDetails={() => {}}
        onShowVariants={() => {}}
        onShowAssets={() => {}}
      />
    );
  },
  args: {} as any, // Required by Storybook type but not used with render
  parameters: {
    docs: {
      description: {
        story: 'Physical view showing only calculated fields with expressions.',
      },
    },
  },
};

export const WithVariants: Story = {
  render: () => {
    const variantFields = sampleFields.filter(f => f.hasVariants);
    return (
      <PhysicalView
        data={variantFields}
        terms={sampleTerms}
        mappings={[]}
        loading={false}
        totalItems={variantFields.length}
        page={0}
        pageSize={25}
        sortModel={[]}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        onSortModelChange={() => {}}
        onMapField={() => {}}
        onShowDetails={() => {}}
        onShowVariants={() => {}}
        onShowAssets={() => {}}
      />
    );
  },
  args: {} as any, // Required by Storybook type but not used with render
  parameters: {
    docs: {
      description: {
        story: 'Physical view showing fields with data type variants and warning indicators.',
      },
    },
  },
};