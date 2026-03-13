import { Box, Paper } from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
  GridSortModel,
  GridPaginationModel,
  GridFilterModel,
} from '@mui/x-data-grid';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';

import { BulkActionsToolbar } from '@/widgets';

import {
  FilterBar,
  type DateFilterState,
  type TagFilter,
  type TagOption,
  type FolderFilter,
  type FolderOption,
  type ErrorFilterState,
  type ActivityFilterState,
  type RoleOption,
  type GroupOption,
  type GroupMembershipFilterState,
  type PermissionsFilterState,
  type MatchReasonSummary,
  DEFAULT_DATE_FILTER,
  DEFAULT_ERROR_FILTER,
  DEFAULT_ACTIVITY_FILTER,
} from '@/widgets/filter-bar';

import { spacing } from '@/shared/design-system/theme';
import { useDebounce, usePagination } from '@/shared/lib';

import { TableHeader, TableToolbar } from './components';
import { tableStyles } from '../lib/tableStyles';

import type { SearchMatchReason } from '@shared/generated';

export interface ColumnConfig {
  id: string;
  label: string;
  width?: number;
  flex?: number;
  minWidth?: number;
  required?: boolean;
  visible?: boolean;
  sortable?: boolean;
  hideable?: boolean;
  renderCell?: (params: any) => React.ReactNode;
  valueGetter?: (params: any) => any;
  /** When set, this column appears as an option in the date filter dropdown. Value is the backend field name. */
  dateFilterField?: string;
}

export interface FetchAssetsOptions {
  page: number;
  pageSize: number;
  search?: string;
  dateRange?: string;
  sortBy?: string;
  sortOrder?: string;
  filters?: Record<string, any>;
  dateField?: string;
  includeTags?: string;
  excludeTags?: string;
  errorFilter?: ErrorFilterState;
  activityFilter?: ActivityFilterState;
  roleFilter?: string;
  permissionsFilter?: PermissionsFilterState;
  groupMembershipFilter?: GroupMembershipFilterState;
  groupFilter?: string;
  includeFolders?: string;
  excludeFolders?: string;
}

interface EnhancedAssetTableProps {
  title?: string;
  assets: any[];
  loading: boolean;
  totalRows: number;
  columns: ColumnConfig[];
  onFetchAssets: (options: FetchAssetsOptions) => Promise<void>;
  selectedRows?: GridRowSelectionModel;
  onSelectionChange?: (selection: GridRowSelectionModel) => void;
  enableBulkActions?: boolean;
  defaultPageSize?: number;
  defaultSortModel?: GridSortModel;
  children?: React.ReactNode;
  extraToolbarActions?: React.ReactNode;
  onSearchChange?: (search: string) => void;
  onDateRangeChange?: (dateRange: string) => void;
  onSortChange?: (field: string, order: 'asc' | 'desc') => void;
  getRowId?: (row: any) => string;
  bulkActions?: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
  onAddToFolder?: () => void;
  onBulkTag?: () => void;
  onBulkDelete?: () => void;
  showDeleteAction?: boolean;
  onExportCSV?: () => Promise<void>;
  exportLabel?: string;
  folderActionLabel?: string;
  /** Show the "Last Activity" option in date field dropdown */
  showActivityOption?: boolean;
  /** Enable tag filtering UI */
  enableTagFiltering?: boolean;
  /** Available tags for filtering */
  availableTags?: TagOption[];
  /** Loading state for tag options */
  isLoadingTags?: boolean;
  /** Enable error filtering UI */
  enableErrorFiltering?: boolean;
  /** Count of assets with errors (for display) */
  errorCount?: number;
  /** Enable activity filtering UI */
  enableActivityFiltering?: boolean;
  /** Enable role filtering UI */
  enableRoleFiltering?: boolean;
  /** Available roles for filtering */
  availableRoles?: RoleOption[];
  /** Enable permissions filtering UI */
  enablePermissionsFiltering?: boolean;
  /** Enable group filtering UI */
  enableGroupFiltering?: boolean;
  /** Available groups for filtering */
  availableGroups?: GroupOption[];
  /** Enable folder filtering UI */
  enableFolderFiltering?: boolean;
  /** Available folders for filtering */
  availableFolders?: FolderOption[];
  /** Loading state for folder options */
  isLoadingFolders?: boolean;
  /** Refresh trigger - when incremented, re-fetches data with current params */
  refreshKey?: number;
}

// Convert DataGrid filter model to backend format (extracted to reduce component complexity)
function convertGridFiltersToBackend(model: GridFilterModel): Record<string, any> {
  const filters: Record<string, any> = {};
  model.items.forEach((item) => {
    if (item.value !== undefined && item.value !== '') {
      const { field, operator, value } = item;
      switch (operator) {
        case 'contains':
        case 'equals':
          filters[field] = value;
          break;
        case 'startsWith':
          filters[field] = { startsWith: value };
          break;
        case 'endsWith':
          filters[field] = { endsWith: value };
          break;
        case '>':
        case '>=':
          filters[field] = { min: value };
          break;
        case '<':
        case '<=':
          filters[field] = { max: value };
          break;
        case 'isAnyOf':
          filters[field] = value;
          break;
      }
    }
  });
  return filters;
}

// Build fetch options from filter state (extracted to reduce component complexity)
function buildFetchOptionsFromState(state: {
  currentPage: number; pageSize: number; debouncedSearchTerm: string;
  dateFilter: DateFilterState; sortModel: GridSortModel; filterModel: GridFilterModel;
  mapSortField: (f: string | undefined) => string | undefined;
  includeTags: TagFilter[]; excludeTags: TagFilter[];
  errorFilter: ErrorFilterState; activityFilter: ActivityFilterState;
  selectedRoles: string[]; permissionsFilter: PermissionsFilterState;
  groupMembershipFilter: GroupMembershipFilterState; selectedGroups: string[];
  includeFolders: FolderFilter[]; excludeFolders: FolderFilter[];
}): FetchAssetsOptions {
  const { sortModel, currentPage, pageSize, debouncedSearchTerm, dateFilter, filterModel } = state;
  const sortField = sortModel.length > 0 ? sortModel[0].field : undefined;
  const sortOrder = sortModel.length > 0 && sortModel[0].sort ? sortModel[0].sort : undefined;
  return {
    page: currentPage, pageSize,
    search: debouncedSearchTerm,
    dateRange: dateFilter.range,
    sortBy: state.mapSortField(sortField),
    sortOrder,
    filters: convertGridFiltersToBackend(filterModel),
    dateField: dateFilter.field,
    includeTags: state.includeTags.length > 0 ? JSON.stringify(state.includeTags) : undefined,
    excludeTags: state.excludeTags.length > 0 ? JSON.stringify(state.excludeTags) : undefined,
    errorFilter: state.errorFilter !== 'all' ? state.errorFilter : undefined,
    activityFilter: state.activityFilter !== 'all' ? state.activityFilter : undefined,
    roleFilter: state.selectedRoles.length > 0 ? JSON.stringify(state.selectedRoles) : undefined,
    permissionsFilter: state.permissionsFilter !== 'all' ? state.permissionsFilter : undefined,
    groupMembershipFilter: state.groupMembershipFilter !== 'all' ? state.groupMembershipFilter : undefined,
    groupFilter: state.selectedGroups.length > 0 ? JSON.stringify(state.selectedGroups) : undefined,
    includeFolders: state.includeFolders.length > 0 ? JSON.stringify(state.includeFolders) : undefined,
    excludeFolders: state.excludeFolders.length > 0 ? JSON.stringify(state.excludeFolders) : undefined,
  };
}

// Compute match reason summary from search results (extracted to reduce component complexity)
function computeMatchReasonSummary(
  assets: any[],
  hasSearch: boolean
): MatchReasonSummary[] {
  if (!hasSearch) return [];
  const reasonCounts = new Map<SearchMatchReason, number>();
  for (const asset of assets) {
    const reasons = asset.searchMatchReasons as SearchMatchReason[] | undefined;
    if (reasons && Array.isArray(reasons)) {
      for (const reason of reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      }
    }
  }
  return Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

// Filter valid rows for DataGrid (extracted to reduce component complexity)
function filterValidRows(assets: any[], getRowId?: (row: any) => string): any[] {
  return assets.filter((asset) => asset && (asset.id || (getRowId && getRowId(asset))));
}

// Map frontend sort field to backend field name
function mapFrontendSortField(sortField: string | undefined): string | undefined {
  if (!sortField) return undefined;
  if (sortField === 'viewStats') return 'viewCount';
  return sortField;
}

// Custom hook for dynamic height calculation (extracted to reduce component complexity)
function useAutoHeight() {
  const [availableHeight, setAvailableHeight] = useState<string>('auto');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const height = window.innerHeight - rect.top - 20;
        setAvailableHeight(`${height}px`);
      }
    };
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    const timer = setTimeout(calculateHeight, 100);
    return () => {
      window.removeEventListener('resize', calculateHeight);
      clearTimeout(timer);
    };
  }, []);

  return { availableHeight, containerRef };
}

// Build column configs from ColumnConfig[] (extracted to reduce component complexity)
function buildColumnsConfig(columns: ColumnConfig[]): { visible: GridColDef[]; visibilityModel: Record<string, boolean> } {
  const visible = columns
    .filter((col) => col.id && col.label)
    .map((col) => ({
      field: col.id,
      headerName: col.label,
      width: col.width,
      flex: col.flex,
      minWidth: col.minWidth,
      sortable: col.sortable !== false,
      hideable: col.hideable !== false,
      renderCell: col.renderCell,
      valueGetter: col.valueGetter,
    }) as GridColDef);

  const visibilityModel: Record<string, boolean> = {};
  columns.forEach((col) => {
    if (col.visible === false && !col.required) {
      visibilityModel[col.id] = false;
    }
  });

  return { visible, visibilityModel };
}

// eslint-disable-next-line complexity
export default function EnhancedAssetTable({
  title,
  assets,
  loading,
  totalRows,
  columns: initialColumns,
  onFetchAssets,
  selectedRows = [],
  onSelectionChange,
  enableBulkActions = true,
  defaultPageSize = 50,
  defaultSortModel = [],
  children,
  extraToolbarActions,
  onSearchChange: _onSearchChange,
  onDateRangeChange: _onDateRangeChange,
  onSortChange: _onSortChange,
  getRowId,
  bulkActions,
  onAddToFolder,
  onBulkTag,
  onBulkDelete,
  showDeleteAction = false,
  onExportCSV,
  exportLabel = 'Export',
  folderActionLabel = 'Add to Folder',
  showActivityOption = false,
  enableTagFiltering = false,
  availableTags = [],
  isLoadingTags = false,
  enableErrorFiltering = false,
  errorCount,
  enableActivityFiltering = false,
  enableRoleFiltering = false,
  availableRoles = [],
  enablePermissionsFiltering = false,
  enableGroupFiltering = false,
  availableGroups = [],
  enableFolderFiltering = false,
  availableFolders = [],
  isLoadingFolders = false,
  refreshKey = 0,
}: EnhancedAssetTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortModel, setSortModel] = useState<GridSortModel>(defaultSortModel);
  const [exporting, setExporting] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterState>(
    () => {
      const firstDateCol = initialColumns.find((col) => col.dateFilterField);
      return firstDateCol
        ? { field: firstDateCol.dateFilterField!, range: 'all' as const }
        : DEFAULT_DATE_FILTER;
    }
  );
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const [includeTags, setIncludeTags] = useState<TagFilter[]>([]);
  const [excludeTags, setExcludeTags] = useState<TagFilter[]>([]);
  const [errorFilter, setErrorFilter] = useState<ErrorFilterState>(DEFAULT_ERROR_FILTER);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterState>(DEFAULT_ACTIVITY_FILTER);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [permissionsFilter, setPermissionsFilter] = useState<PermissionsFilterState>('all');
  const [groupMembershipFilter, setGroupMembershipFilter] = useState<GroupMembershipFilterState>('all');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [includeFolders, setIncludeFolders] = useState<FolderFilter[]>([]);
  const [excludeFolders, setExcludeFolders] = useState<FolderFilter[]>([]);

  const { availableHeight, containerRef } = useAutoHeight();

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Use the pagination hook
  const { currentPage, pageSize, goToPage, setPageSize, updateTotalItems } = usePagination({
    initialPage: 1,
    initialPageSize: defaultPageSize,
  });

  // Update total items when totalRows changes
  useEffect(() => {
    updateTotalItems(totalRows);
  }, [totalRows, updateTotalItems]);

  const dateFieldOptions = useMemo(() => {
    const opts = initialColumns
      .filter((col) => col.dateFilterField)
      .map((col) => ({ value: col.dateFilterField!, label: col.label }));
    return opts.length > 0 ? opts : undefined;
  }, [initialColumns]);

  const { visible: visibleColumnsConfig, visibilityModel: initialColumnVisibilityModel } = useMemo(
    () => buildColumnsConfig(initialColumns),
    [initialColumns]
  );

  const mapSortField = mapFrontendSortField;

  const handleExportCSV = useCallback(async () => {
    if (!onExportCSV) return;

    setExporting(true);
    try {
      await onExportCSV();
    } finally {
      setExporting(false);
    }
  }, [onExportCSV]);

  const handleDateFilterChange = useCallback((filter: DateFilterState) => {
    setDateFilter(filter);
  }, []);

  // Handle pagination model changes from DataGrid
  const handlePaginationModelChange = useCallback(
    (model: GridPaginationModel) => {
      if (model.page + 1 !== currentPage) {
        goToPage(model.page + 1);
      }
      if (model.pageSize !== pageSize) {
        setPageSize(model.pageSize);
      }
    },
    [currentPage, pageSize, goToPage, setPageSize]
  );

  const matchReasonSummary = useMemo(
    () => computeMatchReasonSummary(assets, !!debouncedSearchTerm),
    [assets, debouncedSearchTerm]
  );

  // Build fetch options from current filter state
  const buildFetchOptions = useCallback(
    () => buildFetchOptionsFromState({
      currentPage, pageSize, debouncedSearchTerm, dateFilter, sortModel, filterModel,
      mapSortField, includeTags, excludeTags, errorFilter, activityFilter,
      selectedRoles, permissionsFilter, groupMembershipFilter, selectedGroups,
      includeFolders, excludeFolders,
    }),
    [currentPage, pageSize, debouncedSearchTerm, dateFilter, sortModel, filterModel,
      mapSortField, includeTags, excludeTags, errorFilter, activityFilter,
      selectedRoles, permissionsFilter, groupMembershipFilter, selectedGroups,
      includeFolders, excludeFolders]
  );

  // Handle bulk tag action - prefer direct handler, fall back to custom action
  const handleBulkTag = useCallback(() => {
    if (onBulkTag) {
      onBulkTag();
    } else {
      const action = bulkActions?.find((a) => a.label === 'Manage Tags');
      if (action) action.onClick();
    }
  }, [onBulkTag, bulkActions]);

  // Fetch assets when pagination, search, date filter, tags, or sort changes
  useEffect(() => {
    onFetchAssets(buildFetchOptions());
  }, [onFetchAssets, buildFetchOptions, refreshKey]);

  return (
    <Box>
      {title && (
        <TableHeader
          title={title}
          totalRows={totalRows}
          extraActions={extraToolbarActions}
        />
      )}

      {enableBulkActions && selectedRows.length > 0 && (
        <Box sx={{ mb: spacing.md / 8 }}>
          <BulkActionsToolbar
            selectedCount={selectedRows.length}
            onAddToFolder={onAddToFolder}
            onBulkTag={handleBulkTag}
            onBulkDelete={onBulkDelete}
            showDeleteAction={showDeleteAction}
            onClearSelection={() => onSelectionChange?.([])}
            customActions={bulkActions?.filter(
              (a) => !['Add to Folder', 'Manage Tags'].includes(a.label)
            )}
            folderActionLabel={folderActionLabel}
          />
        </Box>
      )}

      <Paper
        ref={containerRef}
        sx={{
          ...tableStyles.container,
          height: availableHeight,
          maxHeight: availableHeight,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <FilterBar
          showSearch
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          dateFilter={dateFilter}
          onDateFilterChange={handleDateFilterChange}
          dateFieldOptions={dateFieldOptions}
          showActivityOption={showActivityOption}
          matchReasonSummary={matchReasonSummary}
          enableTagFiltering={enableTagFiltering}
          availableTags={availableTags}
          includeTags={includeTags}
          excludeTags={excludeTags}
          onIncludeTagsChange={setIncludeTags}
          onExcludeTagsChange={setExcludeTags}
          isLoadingTags={isLoadingTags}
          enableErrorFiltering={enableErrorFiltering}
          errorFilter={errorFilter}
          onErrorFilterChange={setErrorFilter}
          errorCount={errorCount}
          enableActivityFiltering={enableActivityFiltering}
          activityFilter={activityFilter}
          onActivityFilterChange={setActivityFilter}
          enableRoleFiltering={enableRoleFiltering}
          availableRoles={availableRoles}
          selectedRoles={selectedRoles}
          onSelectedRolesChange={setSelectedRoles}
          enablePermissionsFiltering={enablePermissionsFiltering}
          permissionsFilter={permissionsFilter}
          onPermissionsFilterChange={setPermissionsFilter}
          enableGroupFiltering={enableGroupFiltering}
          availableGroups={availableGroups}
          groupMembershipFilter={groupMembershipFilter}
          onGroupMembershipFilterChange={setGroupMembershipFilter}
          selectedGroups={selectedGroups}
          onSelectedGroupsChange={setSelectedGroups}
          enableFolderFiltering={enableFolderFiltering}
          availableFolders={availableFolders}
          includeFolders={includeFolders}
          excludeFolders={excludeFolders}
          onIncludeFoldersChange={setIncludeFolders}
          onExcludeFoldersChange={setExcludeFolders}
          isLoadingFolders={isLoadingFolders}
        />

        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
          <DataGrid
            rows={filterValidRows(assets, getRowId)}
            columns={visibleColumnsConfig}
            loading={loading}
            paginationModel={{
              page: currentPage - 1,
              pageSize: pageSize,
            }}
            onPaginationModelChange={handlePaginationModelChange}
            pageSizeOptions={[10, 25, 50, 100]}
            rowCount={totalRows}
            paginationMode="server"
            sortingMode="server"
            filterMode="server"
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            filterModel={filterModel}
            onFilterModelChange={setFilterModel}
            checkboxSelection={enableBulkActions}
            rowSelectionModel={selectedRows}
            onRowSelectionModelChange={onSelectionChange}
            disableRowSelectionOnClick
            getRowId={getRowId || ((row) => row.id)}
            slots={{
              toolbar: () => (
                <TableToolbar
                  onExportCSV={handleExportCSV}
                  exportLabel={exportLabel}
                  exporting={exporting}
                />
              ),
            }}
            initialState={{
              columns: {
                columnVisibilityModel: initialColumnVisibilityModel,
              },
            }}
            sx={{ ...tableStyles.dataGrid, height: '100%' }}
          />
        </Box>
      </Paper>

      {children}
    </Box>
  );
}
