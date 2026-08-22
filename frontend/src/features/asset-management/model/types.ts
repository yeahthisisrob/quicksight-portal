import type { components } from '@shared/generated';

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
  /** When set, this column appears as an option in the date filter dropdown. Value is the backend field name. */
  dateFilterField?: string;
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

// Archive and deployment types — grounded in the generated OpenAPI schema
export type ArchivedAssetItem = components['schemas']['ArchivedAssetItem'] & {
  size?: number;
  metadata?: {
    importMode?: string;
    rowCount?: number;
    consumedSpiceCapacityInBytes?: number;
  };
};
/**
 * Metadata extracted from an archived asset's stored API responses
 * (used by metadataExtractor and the restore flow)
 */
export interface AssetMetadata {
  permissions?: any[];
  tags?: Array<{ key: string; value: string }>;
  refreshSchedules?: any[];
  refreshProperties?: any;
  folderMemberships?: any[];
  originalName?: string;
  description?: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  importMode?: string;
  rowCount?: number;
  consumedSpiceCapacityInBytes?: number;
  [key: string]: any;
}
