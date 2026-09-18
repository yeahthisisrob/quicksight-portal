/**
 * Centralized icon configuration
 * This file maps all icon usage across the application for consistency
 */
import {
  Add as AddIcon,
  Analytics as AnalysisIcon,
  Archive as ArchiveIcon,
  Block as BlockIcon,
  // JSON Viewer specific
  Functions as CalcFieldIcon,
  Functions as CalculatedFieldIcon,
  Category as CategoryIcon,
  Close as CloseIcon,
  Code as CodeIcon,
  UnfoldLess as CollapseIcon,
  ContentCopy as CopyIcon,
  // Asset types
  Dashboard as DashboardIcon,
  TableChart as DataCatalogIcon,
  Storage as DatasetIcon,
  CloudQueue as DatasourceIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Error as ErrorIcon,
  UnfoldMore as ExpandIcon,
  ExpandMore as ExpandMoreIcon,
  ImportExport as ExportManagementIcon,
  Calculate as ExpressionIcon,
  DataObject as FieldIcon,
  FilterList as FilterIcon,
  Folder as FolderIcon,
  Group as GroupIcon,
  Info as InfoIcon,
  // Actions
  Code as JsonIcon,
  AccountTree as LineageIcon,
  Lock as LockIcon,
  Logout as LogoutIcon,
  // Navigation
  Menu as MenuIcon,
  MoreVert as MoreVertIcon,
  Language as NamespaceIcon,
  OpenInNew as OpenInNewIcon,
  // Catalog specific
  ViewList as PhysicalFieldIcon,
  Public as PublicIcon,
  Refresh as RefreshIcon,
  Remove as RemoveIcon,
  RestoreFromTrash,
  Save as SaveIcon,
  Schedule,
  Search as SearchIcon,
  Security,
  Sell as SellIcon,
  Category as SemanticLayerIcon,
  Settings,
  TableChart as SheetIcon,
  // Special
  Storage as StorageIcon,
  // Status
  CheckCircle as SuccessIcon,
  LocalOffer as TagIcon,
  Timeline as TimelineNavIcon,
  HelpOutline as UnknownIcon,
  Person as UserIcon,
  Visibility as ViewsIcon,
  TableChart as VisualFieldIcon,
  Warning as WarningIcon,
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
  timeline: TimelineNavIcon,
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
  VIEWS: ViewsIcon,
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
