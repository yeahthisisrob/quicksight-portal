import type { GridRowSelectionModel, GridSortModel } from '@mui/x-data-grid';
import { useCallback, useEffect, useState } from 'react';

import { announceAssetChanges, type ChangedAssetType } from '@/shared/lib/assetChanges';
import { EMPTY_SELECTION, isRowSelected } from '@/shared/lib/gridSelection';
import type { AssetType } from '@/shared/types/asset';

// Module-level constant so the grid receives a stable sort-model identity
const DEFAULT_SORT_MODEL: GridSortModel = [{ field: 'lastModified', sort: 'desc' }];

interface UseAssetPageOptions {
  assetType: AssetType;
  assets: any[];
  updateAssetTags: (type: string, id: string, tags: any[]) => void;
}

export function useAssetPage({ assetType, assets, updateAssetTags }: UseAssetPageOptions) {
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>(EMPTY_SELECTION);
  const [permissionsDialog, setPermissionsDialog] = useState<{ open: boolean; asset?: any }>({
    open: false,
  });
  const [relatedAssetsDialog, setRelatedAssetsDialog] = useState<{
    open: boolean;
    asset?: any;
    relatedAssets?: any[];
  }>({ open: false });
  const [tagsDialog, setTagsDialog] = useState<{ open: boolean; asset?: any }>({ open: false });
  const [addToFolderOpen, setAddToFolderOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [viewStatsDialog, setViewStatsDialog] = useState<{ open: boolean; asset?: any }>({
    open: false,
  });

  const openPermissionsDialog = useCallback(
    (asset: any) => setPermissionsDialog({ open: true, asset }),
    []
  );
  const openTagsDialog = useCallback((asset: any) => setTagsDialog({ open: true, asset }), []);
  const openRelatedAssetsDialog = useCallback(
    (asset: any, relatedAssets: any[]) =>
      setRelatedAssetsDialog({ open: true, asset, relatedAssets }),
    []
  );
  const openViewStatsDialog = useCallback(
    (asset: any) => setViewStatsDialog({ open: true, asset }),
    []
  );

  const handleBulkComplete = () => {
    setSelectedRows(EMPTY_SELECTION);
    // This list, and what is built from it (tag filters, search, the catalog)
    announceAssetChanges([assetType as ChangedAssetType]);
  };

  const selectedAssets = assets.filter((asset: any) => isRowSelected(selectedRows, asset.id));

  const defaultSortModel = DEFAULT_SORT_MODEL;

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
