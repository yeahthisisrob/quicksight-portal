export type DateFieldOption = 'lastUpdatedTime' | 'createdTime' | 'lastActivity';
export type DateRangeOption = 'all' | '24h' | '7d' | '30d' | '90d';

export interface DateFilterState {
  field: DateFieldOption;
  range: DateRangeOption;
}

export interface TagOption {
  key: string;
  value: string;
  count: number;
}

export interface TagFilter {
  key: string;
  value: string;
}

export type ErrorFilterState = 'all' | 'with_errors' | 'without_errors';

export type ActivityFilterState = 'all' | 'with_activity' | 'without_activity';

export interface FolderOption {
  id: string;
  name: string;
  assetCount?: number;
}

export interface FolderFilter {
  id: string;
  name: string;
}

export interface AssetOption {
  id: string;
  name: string;
  type: string;
  fieldCount?: number;
}

export interface AssetFilter {
  id: string;
  name: string;
  type: string;
}

export interface MatchReasonSummary {
  reason: string;
  count: number;
}

export interface FilterBarProps {
  // Date filtering
  dateFilter?: DateFilterState;
  onDateFilterChange?: (filter: DateFilterState) => void;
  showActivityOption?: boolean;

  // Tag filtering
  enableTagFiltering?: boolean;
  availableTags?: TagOption[];
  includeTags?: TagFilter[];
  excludeTags?: TagFilter[];
  onIncludeTagsChange?: (tags: TagFilter[]) => void;
  onExcludeTagsChange?: (tags: TagFilter[]) => void;
  isLoadingTags?: boolean;

  // Error filtering
  enableErrorFiltering?: boolean;
  errorFilter?: ErrorFilterState;
  onErrorFilterChange?: (filter: ErrorFilterState) => void;
  errorCount?: number;

  // Activity filtering
  enableActivityFiltering?: boolean;
  activityFilter?: ActivityFilterState;
  onActivityFilterChange?: (filter: ActivityFilterState) => void;

  // Folder filtering
  enableFolderFiltering?: boolean;
  availableFolders?: FolderOption[];
  includeFolders?: FolderFilter[];
  excludeFolders?: FolderFilter[];
  onIncludeFoldersChange?: (folders: FolderFilter[]) => void;
  onExcludeFoldersChange?: (folders: FolderFilter[]) => void;
  isLoadingFolders?: boolean;

  // Asset selection (for data catalog)
  enableAssetSelection?: boolean;
  availableAssets?: AssetOption[];
  selectedAssets?: AssetFilter[];
  onSelectedAssetsChange?: (assets: AssetFilter[]) => void;

  // Search (optional - can be handled externally)
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  matchReasonSummary?: MatchReasonSummary[];
}
