export interface ColumnConfig {
  id: string;
  label: string;
  field?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: number;
  sortable?: boolean;
  filterable?: boolean;
  hideable?: boolean;
  required?: boolean;
  visible?: boolean;
  align?: 'left' | 'center' | 'right';
  headerAlign?: 'left' | 'center' | 'right';
  type?: 'string' | 'number' | 'date' | 'dateTime' | 'boolean' | 'singleSelect' | 'actions';
  valueGetter?: (params: any) => any;
  valueFormatter?: (params: any) => string;
  renderCell?: (params: any) => React.ReactNode;
  renderHeader?: (params: any) => React.ReactNode;
  getActions?: (params: any) => any[];
}

export interface AssetListPageProps {
  title: string;
  assetType: string;
  columns: string[];
  bulkActions?: boolean;
  showRelatedAssets?: boolean;
  defaultSort?: {
    field: string;
    sort: 'asc' | 'desc';
  };
}

export interface MetadataFormProps {
  metadata: any;
  metadataFields?: string[];
  title?: string;
  hiddenFields?: string[];
}

export interface PermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  permissions: any[];
}

export interface RelatedAssetsDialogProps {
  open: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  relatedAssets: any[];
}

export interface TagsDialogProps {
  open: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  tags: string[];
  onUpdateTags: (tags: string[]) => void;
}

// Archive and deployment types
export interface ArchivedAssetItem {
  type: string;
  id: string;
  name: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  lastPublishedTime?: string;
  lastExportTime?: string;
  lastActivity?: string | null;
  archivedDate?: string;
  archiveReason?: string;
  archivedBy?: string;
  size?: number;
  status?: string;
  tags?: Array<{ key: string; value: string }>;
  metadata?: {
    importMode?: string;
    rowCount?: number;
    consumedSpiceCapacityInBytes?: number;
  };
}