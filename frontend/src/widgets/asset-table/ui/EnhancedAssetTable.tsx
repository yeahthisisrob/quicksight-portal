import { Box, Paper, SelectChangeEvent } from '@mui/material';
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

import { spacing } from '@/shared/design-system/theme';
import { useDebounce, usePagination } from '@/shared/lib';

import { TableHeader, SearchBar, TableToolbar, type MatchReasonSummary } from './components';
import { tableStyles, DATE_RANGES } from '../lib/tableStyles';

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

export interface DateFilter {
  range: 'all' | '24h' | '7d' | '30d' | '90d' | 'custom';
  startDate?: Date;
  endDate?: Date;
}

interface EnhancedAssetTableProps {
  title: string;
  subtitle: string;
  assets: any[];
  loading: boolean;
  totalRows: number;
  columns: ColumnConfig[];
  onFetchAssets: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string, filters?: Record<string, any>) => Promise<void>;
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
}: EnhancedAssetTableProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingTags, setRefreshingTags] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortModel, setSortModel] = useState<GridSortModel>(defaultSortModel);
  const [exporting, setExporting] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    range: 'all',
  });
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  
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
  const {
    currentPage,
    pageSize,
    goToPage,
    setPageSize,
    updateTotalItems,
  } = usePagination({
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
      .filter(col => col.id && col.label)
      .map(col => ({
        field: col.id,
        headerName: col.label,
        width: col.width,
        flex: col.flex,
        minWidth: col.minWidth,
        sortable: col.sortable !== false,
        hideable: col.hideable !== false, // Default to true unless explicitly false
        renderCell: col.renderCell,
        valueGetter: col.valueGetter,
      } as GridColDef));
  }, [initialColumns]);

  // Build initial column visibility model
  const initialColumnVisibilityModel = useMemo(() => {
    const model: Record<string, boolean> = {};
    initialColumns.forEach(col => {
      if (col.visible === false && !col.required) {
        model[col.id] = false;
      }
    });
    return model;
  }, [initialColumns]);

  // Convert DataGrid filter model to backend format
  const convertFiltersToBackend = useCallback((filterModel: GridFilterModel): Record<string, any> => {
    const filters: Record<string, any> = {};
    
    filterModel.items.forEach(item => {
      if (item.value !== undefined && item.value !== '') {
        const field = item.field;
        const operator = item.operator;
        const value = item.value;
        
        // Convert operators to backend format
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
            filters[field] = { min: value };
            break;
          case '>=':
            filters[field] = { min: value };
            break;
          case '<':
            filters[field] = { max: value };
            break;
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
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshAssets();
      
      const sortField = sortModel.length > 0 ? sortModel[0].field : undefined;
      const sortOrder = sortModel.length > 0 && sortModel[0].sort ? sortModel[0].sort : undefined;
      let backendSortField = sortField;
      if (sortField === 'viewStats') {
        backendSortField = 'viewCount';
      } else if (sortField === 'activity') {
        // Keep 'activity' as is - the backend handles it based on asset type
        backendSortField = 'activity';
      } else if (sortField === 'groups') {
        // Keep 'groups' as is - the backend handles it
        backendSortField = 'groups';
      }
      
      const filters = convertFiltersToBackend(filterModel);
      
      await onFetchAssets(
        currentPage,
        pageSize,
        debouncedSearchTerm,
        dateFilter.range,
        backendSortField,
        sortOrder,
        filters
      );
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshAssets, onFetchAssets, sortModel, currentPage, pageSize, debouncedSearchTerm, dateFilter.range, filterModel, convertFiltersToBackend]);

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

  const handleDateRangeChange = useCallback((event: SelectChangeEvent<string>) => {
    setDateFilter(prev => ({
      ...prev,
      range: event.target.value as DateFilter['range'],
    }));
  }, []);

  // Handle pagination model changes from DataGrid
  const handlePaginationModelChange = useCallback((model: GridPaginationModel) => {
    if (model.page + 1 !== currentPage) {
      goToPage(model.page + 1);
    }
    if (model.pageSize !== pageSize) {
      setPageSize(model.pageSize);
    }
  }, [currentPage, pageSize, goToPage, setPageSize]);

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

    // Convert to array and sort by count descending
    return Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [assets, debouncedSearchTerm]);

  // Fetch assets when pagination, search, date filter, or sort changes
  useEffect(() => {
    const sortField = sortModel.length > 0 ? sortModel[0].field : undefined;
    const sortOrder = sortModel.length > 0 && sortModel[0].sort ? sortModel[0].sort : undefined;
    
    // Map frontend field names to backend field names
    let backendSortField = sortField;
    if (sortField === 'viewStats') {
      backendSortField = 'viewCount';
    } else if (sortField === 'activity') {
      // Keep 'activity' as is - the backend handles it based on asset type
      backendSortField = 'activity';
    } else if (sortField === 'groups') {
      // Keep 'groups' as is - the backend handles it
      backendSortField = 'groups';
    }
    
    const filters = convertFiltersToBackend(filterModel);
    
    onFetchAssets(
      currentPage,
      pageSize,
      debouncedSearchTerm,
      dateFilter.range,
      backendSortField,
      sortOrder,
      filters
    );
  }, [currentPage, pageSize, debouncedSearchTerm, dateFilter.range, sortModel, onFetchAssets, filterModel, convertFiltersToBackend]);

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
                const action = bulkActions?.find(a => a.label === 'Manage Tags');
                if (action) {
                  action.onClick();
                }
              }
            }}
            onBulkDelete={onBulkDelete}
            showDeleteAction={showDeleteAction}
            onClearSelection={() => onSelectionChange?.([])}
            customActions={bulkActions?.filter(a => !['Add to Folder', 'Manage Tags'].includes(a.label))}
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
          flexDirection: 'column' 
        }}>
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          dateFilter={dateFilter.range}
          onDateFilterChange={handleDateRangeChange}
          dateRanges={DATE_RANGES}
          matchReasonSummary={matchReasonSummary}
        />

        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
          <DataGrid
            rows={assets.filter(asset => asset && (asset.id || (getRowId && getRowId(asset))))}
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