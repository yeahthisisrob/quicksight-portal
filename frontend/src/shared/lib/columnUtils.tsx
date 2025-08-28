interface ColumnConfig {
  id: string;
  label: string;
  width?: number;
  flex?: number;
  minWidth?: number;
  required?: boolean;
  visible?: boolean;
  sortable?: boolean;
  renderCell?: (params: any) => React.ReactNode;
  valueGetter?: (params: any) => any;
}

interface ColumnAction {
  id: string;
  render: (params: any) => React.ReactNode;
}

/**
 * Enhances table columns by adding additional actions to the actions column
 */
export function enhanceColumnsWithActions(
  columns: ColumnConfig[], 
  actions: ColumnAction[]
): ColumnConfig[] {
  return columns.map(col => {
    if (col.id === 'actions') {
      return {
        ...col,
        renderCell: (params) => (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {col.renderCell?.(params)}
            {actions.map(action => {
              const node = action.render(params);
              return <span key={action.id}>{node}</span>;
            })}
          </div>
        ),
      };
    }
    return col;
  });
}

/**
 * Creates bulk action handlers for assets
 */
export interface BulkActionHandlerOptions {
  selectedAssets: any[];
  assetType: string;
  onComplete?: () => void;
}

export function createBulkActionHandlers({
  selectedAssets,
  assetType,
  onComplete,
}: BulkActionHandlerOptions) {
  const formatAssets = (assets: any[]) => 
    assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      type: assetType,
    }));

  return {
    addToFolder: {
      assets: formatAssets(selectedAssets),
      onComplete,
    },
    bulkTag: {
      assets: formatAssets(selectedAssets),
      onComplete,
    },
  };
}

/**
 * Common column configurations used across asset tables
 */
export const commonColumns = {
  name: (overrides?: Partial<ColumnConfig>): ColumnConfig => ({
    id: 'name',
    label: 'Name',
    flex: 2,
    minWidth: 200,
    required: true,
    ...overrides,
  }),
  
  description: (overrides?: Partial<ColumnConfig>): ColumnConfig => ({
    id: 'description',
    label: 'Description',
    flex: 2,
    minWidth: 200,
    ...overrides,
  }),
  
  tags: (overrides?: Partial<ColumnConfig>): ColumnConfig => ({
    id: 'tags',
    label: 'Tags',
    width: 200,
    sortable: false,
    ...overrides,
  }),
  
  owner: (overrides?: Partial<ColumnConfig>): ColumnConfig => ({
    id: 'owner',
    label: 'Owner',
    width: 150,
    ...overrides,
  }),
  
  createdTime: (overrides?: Partial<ColumnConfig>): ColumnConfig => ({
    id: 'createdTime',
    label: 'Created',
    width: 180,
    ...overrides,
  }),
  
  lastModifiedTime: (overrides?: Partial<ColumnConfig>): ColumnConfig => ({
    id: 'lastModifiedTime',
    label: 'Modified',
    width: 180,
    ...overrides,
  }),
  
  actions: (overrides?: Partial<ColumnConfig>): ColumnConfig => ({
    id: 'actions',
    label: 'Actions',
    width: 150,
    sortable: false,
    required: true,
    ...overrides,
  }),
};