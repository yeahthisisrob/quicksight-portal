import { Box } from '@mui/material';
import { useState } from 'react';

import { TagFilterBar } from './TagFilterBar';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Features/DataCatalog/TagFilterBar',
  component: TagFilterBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A unified filter component for the data catalog with include/exclude tag filtering and asset filtering.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof TagFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockTags = [
  { key: 'Environment', value: 'Production', count: 45 },
  { key: 'Environment', value: 'Development', count: 32 },
  { key: 'Environment', value: 'Staging', count: 18 },
  { key: 'BusinessUnit', value: 'Sales', count: 28 },
  { key: 'BusinessUnit', value: 'Marketing', count: 23 },
  { key: 'BusinessUnit', value: 'Operations', count: 35 },
  { key: 'DataClassification', value: 'Public', count: 67 },
  { key: 'DataClassification', value: 'Internal', count: 89 },
  { key: 'DataClassification', value: 'Confidential', count: 34 },
  { key: 'Region', value: 'US-East', count: 78 },
  { key: 'Region', value: 'US-West', count: 45 },
  { key: 'Region', value: 'EU-Central', count: 23 },
];

const mockAssets = [
  { id: 'dash-001', name: 'Sales Dashboard', type: 'dashboard', fieldCount: 42 },
  { id: 'dash-002', name: 'Marketing Analytics', type: 'dashboard', fieldCount: 38 },
  { id: 'dash-003', name: 'Executive Summary', type: 'dashboard', fieldCount: 25 },
  { id: 'analysis-001', name: 'Customer Segmentation', type: 'analysis', fieldCount: 56 },
  { id: 'analysis-002', name: 'Product Performance', type: 'analysis', fieldCount: 31 },
  { id: 'ds-001', name: 'Customer Data', type: 'dataset', fieldCount: 89 },
  { id: 'ds-002', name: 'Sales Transactions', type: 'dataset', fieldCount: 67 },
  { id: 'ds-003', name: 'Product Catalog', type: 'dataset', fieldCount: 45 },
];

export const Default: Story = {
  args: {
    availableTags: mockTags,
    includeTags: [],
    excludeTags: [],
    onIncludeTagsChange: (tags) => console.log('Include tags changed:', tags),
    onExcludeTagsChange: (tags) => console.log('Exclude tags changed:', tags),
    isLoading: false,
    availableAssets: mockAssets,
    selectedAssets: [],
    onSelectedAssetsChange: (assets) => console.log('Selected assets changed:', assets),
  },
};

export const WithActiveFilters: Story = {
  args: {
    availableTags: mockTags,
    includeTags: [
      { key: 'Environment', value: 'Production' },
    ],
    excludeTags: [
      { key: 'DataClassification', value: 'Confidential' },
    ],
    onIncludeTagsChange: (tags) => console.log('Include tags changed:', tags),
    onExcludeTagsChange: (tags) => console.log('Exclude tags changed:', tags),
    isLoading: false,
    availableAssets: mockAssets,
    selectedAssets: [
      { id: 'dash-001', name: 'Sales Dashboard', type: 'dashboard' },
      { id: 'ds-001', name: 'Customer Data', type: 'dataset' },
    ],
    onSelectedAssetsChange: (assets) => console.log('Selected assets changed:', assets),
  },
};

export const TagsOnly: Story = {
  args: {
    availableTags: mockTags,
    includeTags: [],
    excludeTags: [],
    onIncludeTagsChange: (tags) => console.log('Include tags changed:', tags),
    onExcludeTagsChange: (tags) => console.log('Exclude tags changed:', tags),
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    availableTags: [],
    includeTags: [],
    excludeTags: [],
    onIncludeTagsChange: (tags) => console.log('Include tags changed:', tags),
    onExcludeTagsChange: (tags) => console.log('Exclude tags changed:', tags),
    isLoading: true,
    availableAssets: [],
    selectedAssets: [],
    onSelectedAssetsChange: (assets) => console.log('Selected assets changed:', assets),
  },
};

export const Interactive: Story = {
  args: {
    availableTags: mockTags,
    includeTags: [],
    excludeTags: [],
    onIncludeTagsChange: (tags) => console.log('Include tags changed:', tags),
    onExcludeTagsChange: (tags) => console.log('Exclude tags changed:', tags),
    isLoading: false,
    availableAssets: mockAssets,
    selectedAssets: [],
    onSelectedAssetsChange: (assets) => console.log('Selected assets changed:', assets),
  },
  render: (args) => {
    const [includeTags, setIncludeTags] = useState<{ key: string; value: string }[]>([]);
    const [excludeTags, setExcludeTags] = useState<{ key: string; value: string }[]>([]);
    const [selectedAssets, setSelectedAssets] = useState<{ id: string; name: string; type: string }[]>([]);

    return (
      <Box>
        <TagFilterBar
          {...args}
          includeTags={includeTags}
          excludeTags={excludeTags}
          selectedAssets={selectedAssets}
          onIncludeTagsChange={setIncludeTags}
          onExcludeTagsChange={setExcludeTags}
          onSelectedAssetsChange={setSelectedAssets}
        />

        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Box sx={{ mb: 1 }}>
            <strong>Selected Assets ({selectedAssets.length}):</strong>{' '}
            {selectedAssets.length > 0
              ? selectedAssets.map(a => `${a.name} (${a.type})`).join(', ')
              : 'None'}
          </Box>
          <Box sx={{ mb: 1 }}>
            <strong>Include Tags ({includeTags.length}):</strong>{' '}
            {includeTags.length > 0
              ? includeTags.map(t => `${t.key}=${t.value}`).join(', ')
              : 'None'}
          </Box>
          <Box>
            <strong>Exclude Tags ({excludeTags.length}):</strong>{' '}
            {excludeTags.length > 0
              ? excludeTags.map(t => `${t.key}=${t.value}`).join(', ')
              : 'None'}
          </Box>
        </Box>
      </Box>
    );
  },
};
