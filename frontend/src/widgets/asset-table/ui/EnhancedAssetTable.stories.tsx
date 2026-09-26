import type { Meta, StoryObj } from '@storybook/react-vite';

import { selectionOf } from '@/shared/lib/gridSelection';

import EnhancedAssetTable, { type ColumnConfig } from './EnhancedAssetTable';

/**
 * The generic table. The populated Dashboards and Datasets lists, with their
 * real columns, are the "Health columns" stories; these cover the table's own
 * states.
 */
const meta = {
  title: 'Widgets/AssetTable/EnhancedAssetTable',
  component: EnhancedAssetTable,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The asset list: server-side paging, search, filtering, sorting, bulk actions and export.',
      },
    },
  },
  args: {
    title: 'Assets',
    assets: [],
    loading: false,
    totalRows: 0,
    onFetchAssets: async () => {},
  },
} satisfies Meta<typeof EnhancedAssetTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseDate = new Date('2024-01-01').getTime();
const assets = Array.from({ length: 25 }, (_, i) => ({
  id: `asset-${i + 1}`,
  name: `Asset ${i + 1}`,
  type: ['Dashboard', 'Analysis', 'Dataset'][i % 3],
  owner: `user${(i % 5) + 1}@example.com`,
  lastModified: new Date(baseDate - i * 86_400_000).toISOString(),
  viewCount: (i * 37) % 1000,
}));

const columns: ColumnConfig[] = [
  { id: 'name', label: 'Name', flex: 1, minWidth: 200 },
  { id: 'type', label: 'Type', width: 120 },
  { id: 'owner', label: 'Owner', width: 200 },
  { id: 'lastModified', label: 'Last Modified', width: 180 },
  { id: 'viewCount', label: 'Views', width: 100, sortable: true },
];

/** Three rows selected, so the bulk actions toolbar is showing. */
export const WithSelection: Story = {
  args: {
    assets,
    totalRows: 50,
    columns,
    enableBulkActions: true,
    selectedRows: selectionOf(['asset-1', 'asset-3', 'asset-5']),
    onSelectionChange: () => {},
    onAddToFolder: () => {},
    onBulkTag: () => {},
    onExportCSV: async () => {},
  },
};

export const Loading: Story = {
  args: { columns, loading: true },
};

export const Empty: Story = {
  args: { columns },
};
