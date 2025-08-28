/**
 * Centralized icon configuration
 * This file maps all icon usage across the application for consistency
 */
import { 
  // Asset types
  Dashboard as DashboardIcon,
  Analytics as AnalysisIcon,
  Storage as DatasetIcon,
  CloudQueue as DatasourceIcon,
  Folder as FolderIcon,
  Person as UserIcon,
  Group as GroupIcon,
  Language as NamespaceIcon,
  Public as PublicIcon,
  
  // JSON Viewer specific
  Functions as CalcFieldIcon,
  DataObject as FieldIcon,
  TableChart as SheetIcon,
  FilterList as FilterIcon,
  Calculate as ExpressionIcon,
  
  // Actions
  Code as JsonIcon,
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  UnfoldMore as ExpandIcon,
  UnfoldLess as CollapseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  LocalOffer as TagIcon,
  Download as DownloadIcon,
  RestoreFromTrash,
  Schedule,
  Settings,
  Security,
  
  // Navigation
  Menu as MenuIcon,
  TableChart as DataCatalogIcon,
  ImportExport as ExportManagementIcon,
  Logout as LogoutIcon,
  Archive as ArchiveIcon,
  Code as CodeIcon,
  
  // Status
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  HelpOutline as UnknownIcon,
  
  // Special
  Storage as StorageIcon,
  Block as BlockIcon,
  Sell as SellIcon,
  ExpandMore as ExpandMoreIcon,
  AccountTree as LineageIcon,
  Save as SaveIcon,
  Category as CategoryIcon,
  
  // Catalog specific
  ViewList as PhysicalFieldIcon,
  TableChart as VisualFieldIcon,
  Functions as CalculatedFieldIcon,
  Category as SemanticLayerIcon,
  Lock as LockIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

// Asset type icons mapping
export const assetIcons = {
  DASHBOARD: DashboardIcon,
  ANALYSIS: AnalysisIcon,
  DATASET: DatasetIcon,
  DATASOURCE: DatasourceIcon,
  FOLDER: FolderIcon,
  USER: UserIcon,
  GROUP: GroupIcon,
  NAMESPACE: NamespaceIcon,
  PUBLIC: PublicIcon,
  // Lowercase variants for backward compatibility
  dashboard: DashboardIcon,
  analysis: AnalysisIcon,
  dataset: DatasetIcon,
  datasource: DatasourceIcon,
  folder: FolderIcon,
  user: UserIcon,
  group: GroupIcon,
  namespace: NamespaceIcon,
  public: PublicIcon,
} as const;

// JSON viewer highlight icons
export const highlightIcons = {
  FIELDS: FieldIcon,
  CALCULATED_FIELDS: CalcFieldIcon,
  VISUALS: DashboardIcon,
  SHEETS: SheetIcon,
  FILTERS: FilterIcon,
  EXPRESSIONS: ExpressionIcon,
} as const;

// Common action icons
export const actionIcons = {
  json: JsonIcon,
  copy: CopyIcon,
  close: CloseIcon,
  search: SearchIcon,
  expand: ExpandIcon,
  collapse: CollapseIcon,
  delete: DeleteIcon,
  edit: EditIcon,
  add: AddIcon,
  remove: RemoveIcon,
  openInNew: OpenInNewIcon,
  refresh: RefreshIcon,
  tag: TagIcon,
  download: DownloadIcon,
  filter: FilterIcon,
  more: MoreVertIcon,
  restore: RestoreFromTrash,
  schedule: Schedule,
  settings: Settings,
  security: Security,
  user: UserIcon,
  group: GroupIcon,
  folder: FolderIcon,
} as const;

// Navigation icons
export const navigationIcons = {
  menu: MenuIcon,
  dashboard: DashboardIcon,
  analysis: AnalysisIcon,
  dataset: DatasetIcon,
  datasource: DatasourceIcon,
  folder: FolderIcon,
  user: UserIcon,
  group: GroupIcon,
  dataCatalog: DataCatalogIcon,
  exportManagement: ExportManagementIcon,
  archive: ArchiveIcon,
  code: CodeIcon,
  logout: LogoutIcon,
  storage: StorageIcon,
} as const;

// Status icons
export const statusIcons = {
  success: SuccessIcon,
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
  unknown: UnknownIcon,
} as const;

// Special icons
export const specialIcons = {
  storage: StorageIcon,
  block: BlockIcon,
  sell: SellIcon,
  expandMore: ExpandMoreIcon,
  lineage: LineageIcon,
  save: SaveIcon,
  category: CategoryIcon,
} as const;

// Catalog specific icons
export const catalogIcons = {
  physical: PhysicalFieldIcon,
  visual: VisualFieldIcon,
  calculated: CalculatedFieldIcon,
  semantic: SemanticLayerIcon,
  lock: LockIcon,
} as const;

// Combined icons export for TypedChip
export const chipIcons = {
  ...assetIcons,
  ...highlightIcons,
  UNKNOWN: UnknownIcon,
  TAG: TagIcon,
  CATALOG_HIDDEN: StorageIcon,
  PORTAL_HIDDEN: BlockIcon,
  RELATIONSHIP: LineageIcon,
} as const;

// Type exports
export type AssetIconType = keyof typeof assetIcons;
export type HighlightIconType = keyof typeof highlightIcons;
export type ActionIconType = keyof typeof actionIcons;
export type NavigationIconType = keyof typeof navigationIcons;
export type StatusIconType = keyof typeof statusIcons;
export type ChipIconType = keyof typeof chipIcons;