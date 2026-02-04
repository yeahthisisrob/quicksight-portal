import { useState } from 'react';

import { FilterBar } from './FilterBar';
import { DEFAULT_DATE_FILTER, DEFAULT_ERROR_FILTER } from '../lib/constants';

import type {
  DateFilterState,
  TagFilter,
  TagOption,
  ErrorFilterState,
  AssetOption,
  AssetFilter,
} from '../lib/types';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof FilterBar> = {
  title: 'Widgets/FilterBar',
  component: FilterBar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FilterBar>;

const mockTags: TagOption[] = [
  { key: 'env', value: 'prod', count: 45 },
  { key: 'env', value: 'staging', count: 12 },
  { key: 'env', value: 'dev', count: 8 },
  { key: 'team', value: 'data', count: 32 },
  { key: 'team', value: 'analytics', count: 28 },
  { key: 'team', value: 'engineering', count: 15 },
  { key: 'status', value: 'active', count: 65 },
  { key: 'status', value: 'deprecated', count: 10 },
  { key: 'department', value: 'finance', count: 20 },
  { key: 'department', value: 'marketing', count: 18 },
];

const mockAssets: AssetOption[] = [
  { id: 'ds-1', name: 'Sales Dashboard', type: 'dashboard', fieldCount: 25 },
  { id: 'ds-2', name: 'Revenue Analysis', type: 'analysis', fieldCount: 18 },
  { id: 'ds-3', name: 'Customer Dataset', type: 'dataset', fieldCount: 42 },
  { id: 'ds-4', name: 'Marketing Dashboard', type: 'dashboard', fieldCount: 31 },
  { id: 'ds-5', name: 'Product Analytics', type: 'analysis', fieldCount: 22 },
];

function InteractiveWrapper(props: {
  // Date
  enableDateFiltering?: boolean;
  showActivityOption?: boolean;
  initialDateFilter?: DateFilterState;
  // Tags
  enableTagFiltering?: boolean;
  availableTags?: TagOption[];
  initialIncludeTags?: TagFilter[];
  initialExcludeTags?: TagFilter[];
  isLoadingTags?: boolean;
  // Errors
  enableErrorFiltering?: boolean;
  initialErrorFilter?: ErrorFilterState;
  errorCount?: number;
  // Assets
  enableAssetSelection?: boolean;
  availableAssets?: AssetOption[];
  initialSelectedAssets?: AssetFilter[];
  // Search
  showSearch?: boolean;
  initialSearch?: string;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilterState>(
    props.initialDateFilter || DEFAULT_DATE_FILTER
  );
  const [includeTags, setIncludeTags] = useState<TagFilter[]>(props.initialIncludeTags || []);
  const [excludeTags, setExcludeTags] = useState<TagFilter[]>(props.initialExcludeTags || []);
  const [errorFilter, setErrorFilter] = useState<ErrorFilterState>(
    props.initialErrorFilter || DEFAULT_ERROR_FILTER
  );
  const [selectedAssets, setSelectedAssets] = useState<AssetFilter[]>(
    props.initialSelectedAssets || []
  );
  const [searchTerm, setSearchTerm] = useState(props.initialSearch || '');

  return (
    <FilterBar
      // Date
      dateFilter={props.enableDateFiltering !== false ? dateFilter : undefined}
      onDateFilterChange={props.enableDateFiltering !== false ? setDateFilter : undefined}
      showActivityOption={props.showActivityOption}
      // Tags
      enableTagFiltering={props.enableTagFiltering}
      availableTags={props.availableTags}
      includeTags={includeTags}
      excludeTags={excludeTags}
      onIncludeTagsChange={setIncludeTags}
      onExcludeTagsChange={setExcludeTags}
      isLoadingTags={props.isLoadingTags}
      // Errors
      enableErrorFiltering={props.enableErrorFiltering}
      errorFilter={props.enableErrorFiltering ? errorFilter : undefined}
      onErrorFilterChange={props.enableErrorFiltering ? setErrorFilter : undefined}
      errorCount={props.errorCount}
      // Assets
      enableAssetSelection={props.enableAssetSelection}
      availableAssets={props.availableAssets}
      selectedAssets={selectedAssets}
      onSelectedAssetsChange={setSelectedAssets}
      // Search
      showSearch={props.showSearch}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    />
  );
}

export const Default: Story = {
  render: () => <InteractiveWrapper />,
};

export const WithDateFiltering: Story = {
  render: () => (
    <InteractiveWrapper
      enableDateFiltering
      showActivityOption
      initialDateFilter={{ field: 'lastUpdatedTime', range: '7d' }}
    />
  ),
};

export const WithTagFiltering: Story = {
  render: () => <InteractiveWrapper enableTagFiltering availableTags={mockTags} />,
};

export const WithErrorFiltering: Story = {
  render: () => <InteractiveWrapper enableErrorFiltering errorCount={12} />,
};

export const WithActiveFilters: Story = {
  render: () => (
    <InteractiveWrapper
      enableDateFiltering
      initialDateFilter={{ field: 'createdTime', range: '30d' }}
      enableTagFiltering
      availableTags={mockTags}
      initialIncludeTags={[
        { key: 'env', value: 'prod' },
        { key: 'team', value: 'data' },
      ]}
      initialExcludeTags={[{ key: 'status', value: 'deprecated' }]}
      enableErrorFiltering
      initialErrorFilter="with_errors"
      errorCount={5}
    />
  ),
};

export const AssetPageStyle: Story = {
  render: () => (
    <InteractiveWrapper
      enableDateFiltering
      showActivityOption
      enableTagFiltering
      availableTags={mockTags}
      enableErrorFiltering
      errorCount={8}
    />
  ),
};

export const DataCatalogStyle: Story = {
  render: () => (
    <InteractiveWrapper
      enableDateFiltering={false}
      enableTagFiltering
      availableTags={mockTags}
      enableAssetSelection
      availableAssets={mockAssets}
    />
  ),
};

export const FullFeatured: Story = {
  render: () => (
    <InteractiveWrapper
      showSearch
      initialSearch="sales"
      enableDateFiltering
      showActivityOption
      initialDateFilter={{ field: 'lastUpdatedTime', range: '7d' }}
      enableTagFiltering
      availableTags={mockTags}
      initialIncludeTags={[{ key: 'env', value: 'prod' }]}
      enableErrorFiltering
      initialErrorFilter="without_errors"
      errorCount={3}
      enableAssetSelection
      availableAssets={mockAssets}
      initialSelectedAssets={[{ id: 'ds-1', name: 'Sales Dashboard', type: 'dashboard' }]}
    />
  ),
};

export const Loading: Story = {
  render: () => <InteractiveWrapper enableTagFiltering availableTags={[]} isLoadingTags />,
};

export const MinimalDateOnly: Story = {
  render: () => (
    <InteractiveWrapper
      enableDateFiltering
      enableTagFiltering={false}
      enableErrorFiltering={false}
    />
  ),
};
