import { GridRowSelectionModel, GridSortModel } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useState, useEffect } from 'react';

import { assetsApi } from '@/shared/api';

interface UseAssetPageOptions {
  assetType: 'dashboard' | 'dataset' | 'analysis' | 'datasource' | 'folder' | 'user' | 'group';
  assets: any[];
  refreshAssetType: (type: 'dashboard' | 'dataset' | 'analysis' | 'datasource' | 'folder' | 'user' | 'group') => Promise<void>;
  updateAssetTags: (type: string, id: string, tags: any[]) => void;
}

export function useAssetPage({
  assetType,
  assets,
  refreshAssetType,
  updateAssetTags,
}: UseAssetPageOptions) {
  const { enqueueSnackbar } = useSnackbar();

  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [permissionsDialog, setPermissionsDialog] = useState<{ open: boolean; asset?: any }>({ open: false });
  const [relatedAssetsDialog, setRelatedAssetsDialog] = useState<{ open: boolean; asset?: any; relatedAssets?: any[] }>({ open: false });
  const [tagsDialog, setTagsDialog] = useState<{ open: boolean; asset?: any }>({ open: false });
  const [addToFolderOpen, setAddToFolderOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [viewStatsDialog, setViewStatsDialog] = useState<{ open: boolean; asset?: any }>({ open: false });

  const openPermissionsDialog = (asset: any) => setPermissionsDialog({ open: true, asset });
  const openTagsDialog = (asset: any) => setTagsDialog({ open: true, asset });
  const openRelatedAssetsDialog = (asset: any, relatedAssets: any[]) => 
    setRelatedAssetsDialog({ open: true, asset, relatedAssets });
  const openViewStatsDialog = (asset: any) => setViewStatsDialog({ open: true, asset });

  const handleRefreshTags = async () => {
    try {
      const assetIds = assets.map((asset: any) => asset.id);
      
      if (assetIds.length === 0) {
        enqueueSnackbar(`No ${assetType}s to refresh`, { variant: 'info' });
        return;
      }
      
      const result = await assetsApi.refreshAssetTags(assetType, assetIds);
      
      if (result.successful > 0) {
        enqueueSnackbar(`Successfully refreshed tags for ${result.successful} ${assetType}s`, { 
          variant: 'success' 
        });
        await refreshAssetType(assetType);
      }
      
      if (result.failed > 0) {
        enqueueSnackbar(`Failed to refresh tags for ${result.failed} ${assetType}s`, { 
          variant: 'error' 
        });
      }
    } catch (_error) {
      enqueueSnackbar('Failed to refresh tags', { variant: 'error' });
    }
  };

  const handleBulkComplete = () => {
    setSelectedRows([]);
    refreshAssetType(assetType);
  };

  const selectedAssets = assets.filter((asset: any) => selectedRows.includes(asset.id));

  const defaultSortModel: GridSortModel = [
    { field: 'lastModified', sort: 'desc' }
  ];

  // Listen for bulk action events
  useEffect(() => {
    const handleBulkAddToFolder = () => setAddToFolderOpen(true);
    const handleBulkTag = () => setBulkTagOpen(true);
    const handleBulkDelete = () => setBulkDeleteOpen(true);

    window.addEventListener('bulkAddToFolder', handleBulkAddToFolder as any);
    window.addEventListener('bulkTag', handleBulkTag as any);
    window.addEventListener('bulkDelete', handleBulkDelete as any);

    return () => {
      window.removeEventListener('bulkAddToFolder', handleBulkAddToFolder as any);
      window.removeEventListener('bulkTag', handleBulkTag as any);
      window.removeEventListener('bulkDelete', handleBulkDelete as any);
    };
  }, []);

  return {
    selectedRows,
    setSelectedRows,
    permissionsDialog,
    setPermissionsDialog,
    relatedAssetsDialog,
    setRelatedAssetsDialog,
    tagsDialog,
    setTagsDialog,
    addToFolderOpen,
    setAddToFolderOpen,
    bulkTagOpen,
    setBulkTagOpen,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    handleRefreshTags,
    handleBulkComplete,
    selectedAssets,
    defaultSortModel,
    updateAssetTags: (assetId: string, tags: any[]) => {
      updateAssetTags(assetType, assetId, tags);
    },
    viewStatsDialog,
    setViewStatsDialog,
    openPermissionsDialog,
    openTagsDialog,
    openRelatedAssetsDialog,
    openViewStatsDialog,
  };
}