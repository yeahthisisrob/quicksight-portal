import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
} from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useState, useEffect, ReactNode } from 'react';

import { AddToFolderDialog } from '@/entities/folder';
import { BulkTagDialog } from '@/entities/tag';

import { assetsApi } from '@/shared/api';
import { useDebounce } from '@/shared/lib';

interface AssetListPageProps {
  title: string;
  subtitle: string;
  assetType: 'dashboard' | 'dataset' | 'analysis' | 'datasource';
  columns: GridColDef[];
  assets: any[];
  loading: boolean;
  totalRows: number;
  onFetchAssets: (page: number, pageSize: number, search?: string) => Promise<void>;
  onRefreshAssets: () => Promise<void>;
  dialogComponents?: {
    permissions?: ReactNode;
    relatedAssets?: ReactNode;
    tags?: ReactNode;
    custom?: ReactNode[];
  };
  enableBulkActions?: boolean;
  defaultPageSize?: number;
  defaultSortModel?: any[];
}

export default function AssetListPage({
  title,
  subtitle,
  assetType,
  columns,
  assets,
  loading,
  totalRows,
  onFetchAssets,
  onRefreshAssets,
  dialogComponents,
  enableBulkActions = true,
  defaultPageSize = 50,
  defaultSortModel = [{ field: 'lastExportTime', sort: 'desc' }],
}: AssetListPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingTags, setRefreshingTags] = useState(false);
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [addToFolderOpen, setAddToFolderOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: defaultPageSize });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortModel, setSortModel] = useState<any[]>(defaultSortModel);
  
  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Use lineage hook for related assets
  const getRelatedAssetsForAsset = (_assetId: string) => [];
  
  // Fetch assets when pagination or search changes
  useEffect(() => {
    onFetchAssets(
      paginationModel.page + 1,
      paginationModel.pageSize,
      debouncedSearchTerm
    );
  }, [paginationModel.page, paginationModel.pageSize, debouncedSearchTerm, onFetchAssets]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefreshAssets();
    await onFetchAssets(
      paginationModel.page + 1,
      paginationModel.pageSize,
      debouncedSearchTerm
    );
    setRefreshing(false);
  };
  
  const selectedAssets = assets.filter((asset: any) => selectedRows.includes(asset.id));
  
  const handleBulkComplete = () => {
    setSelectedRows([]);
    handleRefresh();
  };
  
  const handleRefreshTags = async () => {
    setRefreshingTags(true);
    try {
      // Get all asset IDs from the current page
      const assetIds = assets.map((asset: any) => asset.id);
      
      if (assetIds.length === 0) {
        enqueueSnackbar('No assets to refresh', { variant: 'info' });
        return;
      }
      
      const result = await assetsApi.refreshAssetTags(assetType, assetIds);
      
      if (result.successful > 0) {
        enqueueSnackbar(`Successfully refreshed tags for ${result.successful} ${assetType}s`, { 
          variant: 'success' 
        });
        
        // Refresh the current page to show updated tags
        await onFetchAssets(
          paginationModel.page + 1,
          paginationModel.pageSize,
          debouncedSearchTerm
        );
      }
      
      if (result.failed > 0) {
        enqueueSnackbar(`Failed to refresh tags for ${result.failed} ${assetType}s`, { 
          variant: 'error' 
        });
      }
    } catch (_error) {
      enqueueSnackbar('Failed to refresh tags', { variant: 'error' });
    } finally {
      setRefreshingTags(false);
    }
  };
  
  // Provide lineage data to columns via context
  const columnsWithContext = columns.map(col => ({
    ...col,
    // Add lineage data to render context
    renderCell: col.renderCell ? (params: any) => {
      const enhancedParams = { 
        ...params, 
        getRelatedAssetsForAsset: (asset: any) => getRelatedAssetsForAsset(asset || params.row)
      };
      return col.renderCell!(enhancedParams);
    } : undefined,
  }));
  
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4">{title}</Typography>
          <Typography variant="body1" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh Tags">
            <IconButton onClick={handleRefreshTags} disabled={refreshingTags}>
              {refreshingTags ? <CircularProgress size={24} /> : <TagIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Bulk Actions Toolbar */}
      {enableBulkActions && selectedRows.length > 0 && (
        <Paper sx={{ mb: 2, p: 2, backgroundColor: 'primary.main', color: 'primary.contrastText' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body1">
              {selectedRows.length} item{selectedRows.length !== 1 ? 's' : ''} selected
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton 
                onClick={() => setAddToFolderOpen(true)}
                sx={{ color: 'primary.contrastText' }}
              >
                <TagIcon />
              </IconButton>
              <IconButton 
                onClick={() => setBulkTagOpen(true)}
                sx={{ color: 'primary.contrastText' }}
              >
                <TagIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      )}
      
      {/* Search Bar */}
      <Paper sx={{ mb: 2, p: 2 }}>
        <TextField
          placeholder={`Search ${assetType}s by name, ID, tags, permissions, or metadata...`}
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            // Reset to first page when searching
            setPaginationModel(prev => ({ ...prev, page: 0 }));
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>
      
      <Paper>
        {loading && assets.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : assets.length > 0 ? (
          <DataGrid
            rows={assets.map((asset: any) => ({
              ...asset,
              id: asset.id,
            }))}
            columns={columnsWithContext}
            autoHeight
            checkboxSelection={enableBulkActions}
            rowSelectionModel={selectedRows}
            onRowSelectionModelChange={(newSelection) => setSelectedRows(newSelection)}
            disableRowSelectionOnClick
            rowCount={totalRows}
            loading={loading}
            paginationMode="server"
            sortingMode="client"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            pageSizeOptions={[25, 50, 100]}
            sx={{
              '& .MuiDataGrid-columnHeader': {
                backgroundColor: 'action.hover',
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 'bold',
              },
            }}
          />
        ) : (
          <Alert severity="info" sx={{ m: 2 }}>
            No {assetType}s found. Run an asset export to see {assetType}s here.
          </Alert>
        )}
      </Paper>
      
      {/* Dialog Components */}
      {dialogComponents?.permissions}
      {dialogComponents?.relatedAssets}
      {dialogComponents?.tags}
      {dialogComponents?.custom?.map((dialog, index) => (
        <div key={index}>{dialog}</div>
      ))}
      
      {/* Bulk Action Dialogs */}
      {enableBulkActions && (
        <>
          <AddToFolderDialog
            open={addToFolderOpen}
            onClose={() => setAddToFolderOpen(false)}
            selectedAssets={selectedAssets.map((asset: any) => ({
              id: asset.id,
              name: asset.name,
              type: assetType
            }))}
            onComplete={handleBulkComplete}
          />
          
          <BulkTagDialog
            open={bulkTagOpen}
            onClose={() => setBulkTagOpen(false)}
            selectedAssets={selectedAssets.map((asset: any) => ({
              id: asset.id,
              name: asset.name,
              type: assetType
            }))}
            onComplete={handleBulkComplete}
          />
        </>
      )}
    </Box>
  );
}