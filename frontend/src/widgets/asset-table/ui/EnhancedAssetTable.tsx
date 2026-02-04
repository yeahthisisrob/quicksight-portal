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
  includeFolders?: string;
  excludeFolders?: string;
}

interface EnhancedAssetTableProps {
  title: string;
  subtitle: string;
  assets: any[];
  loading: boolean;
  totalRows: number;
  columns: ColumnConfig[];
  onFetchAssets: (options: FetchAssetsOptions) => Promise<void>;
  onRefreshAssets: () => Promise<void>;
  onRefreshTags?: () => Promise<void>;
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
  /** Enable folder filtering UI */
  enableFolderFiltering?: boolean;
  /** Available folders for filtering */
  availableFolders?: FolderOption[];
  /** Loading state for folder options */
  isLoadingFolders?: boolean;
}

export default function EnhancedAssetTable({
  title,
  subtitle,
  assets,
  loading,
  totalRows,
  columns: initialColumns,
  onFetchAssets,
  onRefreshAssets,
  onRefreshTags,
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
  enableFolderFiltering = false,
  availableFolders = [],
  isLoadingFolders = false,
}: EnhancedAssetTableProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingTags, setRefreshingTags] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortModel, setSortModel] = useState<GridSortModel>(defaultSortModel);
  const [exporting, setExporting] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterState>(DEFAULT_DATE_FILTER);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const [includeTags, setIncludeTags] = useState<TagFilter[]>([]);
  const [excludeTags, setExcludeTags] = useState<TagFilter[]>([]);
  const [errorFilter, setErrorFilter] = useState<ErrorFilterState>(DEFAULT_ERROR_FILTER);
  const [activityFilter, setActivityFilter] = useState<ActivityFilterState>(DEFAULT_ACTIVITY_FILTER);
  const [includeFolders, setIncludeFolders] = useState<FolderFilter[]>([]);
  const [excludeFolders, setExcludeFolders] = useState<FolderFilter[]>([]);

  // Dynamic height calculation
  const [availableHeight, setAvailableHeight] = useState<string>('auto');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const topOffset = rect.top;
        const bottomPadding = 20;
        const height = window.innerHeight - topOffset - bottomPadding;
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

  // Build columns
  const visibleColumnsConfig = useMemo(() => {
    return initialColumns
      .filter((col) => col.id && col.label)
      .map(
        (col) =>
          ({
            field: col.id,
            headerName: col.label,
            width: col.width,
            flex: col.flex,
            minWidth: col.minWidth,
            sortable: col.sortable !== false,
            hideable: col.hideable !== false,
            renderCell: col.renderCell,
            valueGetter: col.valueGetter,
          }) as GridColDef
      );
  }, [initialColumns]);

  // Build initial column visibility model
  const initialColumnVisibilityModel = useMemo(() => {
    const model: Record<string, boolean> = {};
    initialColumns.forEach((col) => {
      if (col.visible === false && !col.required) {
        model[col.id] = false;
      }
    });
    return model;
  }, [initialColumns]);

  // Convert DataGrid filter model to backend format
  const convertFiltersToBackend = useCallback(
    (filterModel: GridFilterModel): Record<string, any> => {
      const filters: Record<string, any> = {};

      filterModel.items.forEach((item) => {
        if (item.value !== undefined && item.value !== '') {
          const field = item.field;
          const operator = item.operator;
          const value = item.value;

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
    },
    []
  );

  // Map frontend sort field to backend field
  const mapSortField = useCallback((sortField: string | undefined) => {
    if (!sortField) return undefined;
    if (sortField === 'viewStats') return 'viewCount';
    return sortField;
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshAssets();

      const sortField = sortModel.length > 0 ? sortModel[0].field : undefined;
      const sortOrder = sortModel.length > 0 && sortModel[0].sort ? sortModel[0].sort : undefined;
      const backendSortField = mapSortField(sortField);
      const filters = convertFiltersToBackend(filterModel);

      await onFetchAssets({
        page: currentPage,
        pageSize,
        search: debouncedSearchTerm,
        dateRange: dateFilter.range,
        sortBy: backendSortField,
        sortOrder,
        filters,
        dateField: dateFilter.field !== 'lastUpdatedTime' ? dateFilter.field : undefined,
        includeTags: includeTags.length > 0 ? JSON.stringify(includeTags) : undefined,
        excludeTags: excludeTags.length > 0 ? JSON.stringify(excludeTags) : undefined,
        errorFilter: errorFilter !== 'all' ? errorFilter : undefined,
        activityFilter: activityFilter !== 'all' ? activityFilter : undefined,
        includeFolders: includeFolders.length > 0 ? JSON.stringify(includeFolders) : undefined,
        excludeFolders: excludeFolders.length > 0 ? JSON.stringify(excludeFolders) : undefined,
      });
    } finally {
      setRefreshing(false);
    }
  }, [
    onRefreshAssets,
    onFetchAssets,
    sortModel,
    currentPage,
    pageSize,
    debouncedSearchTerm,
    dateFilter,
    filterModel,
    convertFiltersToBackend,
    mapSortField,
    includeTags,
    excludeTags,
    errorFilter,
    activityFilter,
    includeFolders,
    excludeFolders,
  ]);

  const handleRefreshTags = useCallback(async () => {
    if (!onRefreshTags) return;
    setRefreshingTags(true);
    try {
      await onRefreshTags();
    } finally {
      setRefreshingTags(false);
    }
  }, [onRefreshTags]);

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

  // Compute match reasons summary from assets that have searchMatchReasons
  const matchReasonSummary = useMemo((): MatchReasonSummary[] => {
    if (!debouncedSearchTerm) return [];

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
  }, [assets, debouncedSearchTerm]);

  // Fetch assets when pagination, search, date filter, tags, or sort changes
  useEffect(() => {
    const sortField = sortModel.length > 0 ? sortModel[0].field : undefined;
    const sortOrder = sortModel.length > 0 && sortModel[0].sort ? sortModel[0].sort : undefined;
    const backendSortField = mapSortField(sortField);
    const filters = convertFiltersToBackend(filterModel);

    onFetchAssets({
      page: currentPage,
      pageSize,
      search: debouncedSearchTerm,
      dateRange: dateFilter.range,
      sortBy: backendSortField,
      sortOrder,
      filters,
      dateField: dateFilter.field !== 'lastUpdatedTime' ? dateFilter.field : undefined,
      includeTags: includeTags.length > 0 ? JSON.stringify(includeTags) : undefined,
      excludeTags: excludeTags.length > 0 ? JSON.stringify(excludeTags) : undefined,
      errorFilter: errorFilter !== 'all' ? errorFilter : undefined,
      activityFilter: activityFilter !== 'all' ? activityFilter : undefined,
      includeFolders: includeFolders.length > 0 ? JSON.stringify(includeFolders) : undefined,
      excludeFolders: excludeFolders.length > 0 ? JSON.stringify(excludeFolders) : undefined,
    });
  }, [
    currentPage,
    pageSize,
    debouncedSearchTerm,
    dateFilter,
    sortModel,
    onFetchAssets,
    filterModel,
    convertFiltersToBackend,
    mapSortField,
    includeTags,
    excludeTags,
    errorFilter,
    activityFilter,
    includeFolders,
    excludeFolders,
  ]);

  return (
    <Box>
      <TableHeader
        title={title}
        subtitle={subtitle}
        onRefreshAssets={handleRefresh}
        onRefreshTags={onRefreshTags ? handleRefreshTags : undefined}
        refreshing={refreshing}
        refreshingTags={refreshingTags}
        extraToolbarActions={extraToolbarActions}
      />

      {enableBulkActions && selectedRows.length > 0 && (
        <Box sx={{ mb: spacing.md / 8 }}>
          <BulkActionsToolbar
            selectedCount={selectedRows.length}
            onAddToFolder={onAddToFolder}
            onBulkTag={() => {
              if (onBulkTag) {
                onBulkTag();
              } else {
                const action = bulkActions?.find((a) => a.label === 'Manage Tags');
                if (action) {
                  action.onClick();
                }
              }
            }}
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
            rows={assets.filter((asset) => asset && (asset.id || (getRowId && getRowId(asset))))}
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
