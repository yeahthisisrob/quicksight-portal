/**
 * Centralized icon configuration
 * This file maps all icon usage across the application for consistency
 */
import {
  AccountCircle as AccountIcon,
  Add as AddIcon,
  Analytics as AnalysisIcon,
  Archive as ArchiveIcon,
  AutoAwesome as AuthorIcon,
  Block as BlockIcon,
  // JSON Viewer specific
  Functions as CalcFieldIcon,
  Close as CloseIcon,
  Code as CodeIcon,
  UnfoldLess as CollapseIcon,
  ChevronLeft as CollapseNavIcon,
  ContentCopy as CopyIcon,
  DarkMode as DarkModeIcon,
  // Asset types
  Dashboard as DashboardIcon,
  TableChart as DataCatalogIcon,
  Storage as DatasetIcon,
  CloudQueue as DatasourceIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  UnfoldMore as ExpandIcon,
  ChevronRight as ExpandNavIcon,
  ImportExport as ExportManagementIcon,
  Calculate as ExpressionIcon,
  DataObject as FieldIcon,
  FilterList as FilterIcon,
  Folder as FolderIcon,
  Group as GroupIcon,
  WorkHistoryOutlined as JobsNavIcon,
  // Actions
  Code as JsonIcon,
  LightMode as LightModeIcon,
  AccountTree as LineageIcon,
  Logout as LogoutIcon,
  // Navigation
  Menu as MenuIcon,
  MoreVert as MoreVertIcon,
  Language as NamespaceIcon,
  OpenInNew as OpenInNewIcon,
  Build as OperationsIcon,
  Public as PublicIcon,
  Refresh as RefreshIcon,
  Remove as RemoveIcon,
  RestoreFromTrash,
  Schedule,
  Search as SearchIcon,
  Security,
  Settings,
  TableChart as SheetIcon,
  // Special
  Storage as StorageIcon,
  LocalOffer as TagIcon,
  Timeline as TimelineNavIcon,
  HelpOutlined as UnknownIcon,
  Person as UserIcon,
  Visibility as ViewsIcon,
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
const highlightIcons = {
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
  jobs: JobsNavIcon,
  author: AuthorIcon,
  operations: OperationsIcon,
  settings: Settings,
  account: AccountIcon,
  collapse: CollapseNavIcon,
  expand: ExpandNavIcon,
  darkMode: DarkModeIcon,
  lightMode: LightModeIcon,
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
export type NavigationIconType = keyof typeof navigationIcons;
