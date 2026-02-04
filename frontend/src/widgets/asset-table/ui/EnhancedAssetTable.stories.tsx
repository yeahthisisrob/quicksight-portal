import { useState, useCallback, useMemo, useRef } from 'react';

import EnhancedAssetTable, { ColumnConfig } from './EnhancedAssetTable';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Widgets/AssetTable/EnhancedAssetTable',
  component: EnhancedAssetTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A sleek, modern table component for displaying and managing assets with advanced features like search, filtering, sorting, bulk actions, and export functionality.',
      },
    },
  },
} satisfies Meta<typeof EnhancedAssetTable>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data - generated once to prevent re-renders
const generateMockAssets = (count: number) => {
  // Use a fixed seed date to ensure consistent data
  const baseDate = new Date('2024-01-01');
  return Array.from({ length: count }, (_, i) => ({
    id: `asset-${i + 1}`,
    name: `Asset ${i + 1}`,
    type: ['Dashboard', 'Analysis', 'Dataset'][i % 3],
    owner: `user${(i % 5) + 1}@example.com`,
    lastModified: new Date(baseDate.getTime() - (i * 24 * 60 * 60 * 1000)).toISOString(),
    viewCount: (i * 37) % 1000, // Deterministic view count
    tags: i % 2 === 0 ? [{ key: 'Department', value: 'Sales' }] : [],
  }));
};

// Generate mock data once outside of components
const mockAssets = generateMockAssets(50);

const columns: ColumnConfig[] = [
  {
    id: 'name',
    label: 'Name',
    flex: 1,
    minWidth: 200,
  },
  {
    id: 'type',
    label: 'Type',
    width: 120,
  },
  {
    id: 'owner',
    label: 'Owner',
    width: 200,
  },
  {
    id: 'lastModified',
    label: 'Last Modified',
    width: 180,
    valueGetter: (params: any) => new Date(params.row.lastModified).toLocaleDateString(),
  },
  {
    id: 'viewCount',
    label: 'Views',
    width: 100,
    sortable: true,
  },
];

const InteractiveWrapper = ({ 
  initialAssets = mockAssets,
  title = 'Assets',
  subtitle = 'Manage your QuickSight assets',
  enableBulkActions = true,
  onAddToFolder,
  onBulkTag,
  exportLabel,
  folderActionLabel,
}: any) => {
  const [assets, setAssets] = useState(initialAssets.slice(0, 50));
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const isInitialMount = useRef(true);

  const handleFetchAssets = useCallback(async (options: {
    page: number;
    pageSize: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    const { page, pageSize, search, sortBy, sortOrder } = options;
    // Skip the first call on mount to prevent flashing
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    let filtered = [...initialAssets];

    if (search) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.owner.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[sortBy as keyof typeof a];
        const bVal = b[sortBy as keyof typeof b];
        const comparison = aVal > bVal ? 1 : -1;
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Paginate
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    setAssets(paginated);
    setLoading(false);
  }, [initialAssets]);

  const handleRefreshAssets = useCallback(async () => {
    isInitialMount.current = false;
    await handleFetchAssets({ page: 1, pageSize: 50 });
  }, [handleFetchAssets]);

  const handleRefreshTags = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, []);

  const handleExportCSV = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
  }, []);

  // Memoize callback props
  const memoizedCallbacks = useMemo(() => ({
    onAddToFolder: onAddToFolder || (() => {}),
    onBulkTag: onBulkTag || (() => {}),
  }), [onAddToFolder, onBulkTag]);

  return (
    <EnhancedAssetTable
      title={title}
      subtitle={subtitle}
      assets={assets}
      loading={loading}
      totalRows={initialAssets.length}
      columns={columns}
      selectedRows={selectedRows}
      onSelectionChange={setSelectedRows}
      enableBulkActions={enableBulkActions}
      onFetchAssets={handleFetchAssets}
      onRefreshAssets={handleRefreshAssets}
      onRefreshTags={handleRefreshTags}
      onExportCSV={handleExportCSV}
      onAddToFolder={memoizedCallbacks.onAddToFolder}
      onBulkTag={memoizedCallbacks.onBulkTag}
      exportLabel={exportLabel}
      folderActionLabel={folderActionLabel}
    />
  );
};

export const Default = {
  render: () => <InteractiveWrapper 
    onAddToFolder={() => {}}
    onBulkTag={() => {}}
  />,
};

export const WithoutBulkActions = {
  render: () => <InteractiveWrapper 
    title="Read-Only Assets"
    subtitle="View your QuickSight assets"
    enableBulkActions={false}
  />,
};

export const Loading: Story = {
  args: {
    title: 'Assets',
    subtitle: 'Loading your assets...',
    assets: [],
    loading: true,
    totalRows: 0,
    columns: columns,
    onFetchAssets: async (_options) => {},
    onRefreshAssets: async () => {},
  },
};

export const Empty: Story = {
  args: {
    title: 'Assets',
    subtitle: 'No assets found',
    assets: [],
    loading: false,
    totalRows: 0,
    columns: columns,
    onFetchAssets: async (_options) => {},
    onRefreshAssets: async () => {},
  },
};

export const WithSelection = {
  render: () => {
    const Component = () => {
      const [selectedRows, setSelectedRows] = useState<any[]>(['asset-1', 'asset-3', 'asset-5']);
      const [assets] = useState(mockAssets);
      const [loading, setLoading] = useState(false);
      const isInitialMount = useRef(true);

      const handleFetchAssets = useCallback(async (_options: { page: number; pageSize: number }) => {
        if (isInitialMount.current) {
          isInitialMount.current = false;
          return;
        }
        setLoading(true);
        setTimeout(() => setLoading(false), 500);
      }, []);

      return (
        <EnhancedAssetTable
          title="Assets"
          subtitle="Select multiple assets for bulk actions"
          assets={assets}
          loading={loading}
          totalRows={assets.length}
          columns={columns}
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          enableBulkActions={true}
          onFetchAssets={handleFetchAssets}
          onRefreshAssets={async () => handleFetchAssets({ page: 1, pageSize: 50 })}
          onAddToFolder={() => {}}
          onBulkTag={() => {}}
        />
      );
    };

    return <Component />;
  },
};

export const CustomExportLabel = {
  render: () => <InteractiveWrapper 
    title="User Assets"
    subtitle="Export user data"
    exportLabel="Export Users"
    folderActionLabel="Add to Group"
    onAddToFolder={() => {}}
    onBulkTag={() => {}}
  />,
};