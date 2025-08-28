import { Paper, alpha } from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridSortModel,
  GridPaginationModel,
  GridToolbar,
} from '@mui/x-data-grid';
import { useState, useEffect, useCallback } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

export interface CatalogDataGridProps {
  data: any[];
  columns: GridColDef[];
  loading: boolean;
  totalRows: number;
  page: number;
  pageSize: number;
  sortModel?: GridSortModel;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortModelChange?: (model: GridSortModel) => void;
  height?: number | string;
  pageSizeOptions?: number[];
  showToolbar?: boolean;
  disableColumnFilter?: boolean;
  disableColumnSelector?: boolean;
  disableDensitySelector?: boolean;
  getRowId?: (row: any) => string;
}

export default function CatalogDataGrid({
  data,
  columns,
  loading,
  totalRows,
  page,
  pageSize,
  sortModel = [],
  onPageChange,
  onPageSizeChange,
  onSortModelChange,
  height = 'calc(100vh - 400px)',
  pageSizeOptions = [25, 50, 100],
  showToolbar = true,
  disableColumnFilter = false,
  disableColumnSelector = false,
  disableDensitySelector = false,
  getRowId,
}: CatalogDataGridProps) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page,
    pageSize,
  });

  // Sync pagination model with props
  useEffect(() => {
    setPaginationModel({ page, pageSize });
  }, [page, pageSize]);

  const handlePaginationModelChange = useCallback((model: GridPaginationModel) => {
    if (model.page !== page) {
      onPageChange(model.page);
    }
    if (model.pageSize !== pageSize) {
      onPageSizeChange(model.pageSize);
    }
  }, [page, pageSize, onPageChange, onPageSizeChange]);

  return (
    <Paper 
      sx={{ 
        height,
        width: '100%',
        borderRadius: `${spacing.md / 8}px`,
        overflow: 'hidden',
        boxShadow: `0 1px 3px ${alpha(colors.neutral[900], 0.05)}, 0 1px 2px ${alpha(colors.neutral[900], 0.1)}`,
        border: `1px solid ${colors.neutral[200]}`,
        background: 'white',
      }}
    >
      <DataGrid
        rows={data || []}
        columns={columns}
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        sortingMode="server"
        sortModel={sortModel}
        onSortModelChange={onSortModelChange}
        pageSizeOptions={pageSizeOptions}
        disableRowSelectionOnClick
        getRowId={getRowId}
        autoHeight={false}
        slots={{
          toolbar: showToolbar ? GridToolbar : undefined,
        }}
        slotProps={{
          toolbar: showToolbar ? {
            showQuickFilter: false,
            csvOptions: { disableToolbarButton: true },
            printOptions: { disableToolbarButton: true },
          } : undefined,
        }}
        componentsProps={{
          toolbar: showToolbar ? {
            showColumnsButton: !disableColumnSelector,
            showFilterButton: !disableColumnFilter,
            showDensitySelector: !disableDensitySelector,
          } : undefined,
        }}
        sx={{
          border: 'none',
          '& .MuiDataGrid-main': {
            borderRadius: 0,
          },
          '& .MuiDataGrid-cell': {
            borderBottom: `1px solid ${colors.neutral[100]}`,
            py: spacing.md / 8,
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: colors.neutral[50],
            borderBottom: `2px solid ${colors.neutral[200]}`,
            borderRadius: 0,
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 600,
            color: colors.neutral[700],
          },
          '& .MuiDataGrid-row': {
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.04),
            },
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: `1px solid ${colors.neutral[200]}`,
            backgroundColor: colors.neutral[50],
          },
          '& .MuiDataGrid-toolbarContainer': {
            padding: spacing.md / 8,
            borderBottom: `1px solid ${colors.neutral[200]}`,
            backgroundColor: alpha(colors.neutral[50], 0.5),
            '& .MuiButton-root': {
              color: colors.neutral[700],
              '&:hover': {
                backgroundColor: alpha(colors.primary.main, 0.08),
              },
            },
          },
          '& .MuiDataGrid-columnSeparator': {
            color: colors.neutral[200],
          },
          '& .MuiTablePagination-root': {
            color: colors.neutral[700],
          },
          '& .MuiDataGrid-menuIcon': {
            '& .MuiSvgIcon-root': {
              color: colors.neutral[400],
            },
          },
          '& .MuiDataGrid-sortIcon': {
            color: colors.primary.main,
          },
          '& .MuiCircularProgress-root': {
            color: colors.primary.main,
          },
        }}
      />
    </Paper>
  );
}