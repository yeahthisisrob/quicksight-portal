import { GridRowSelectionModel } from '@mui/x-data-grid';
import { useState, useMemo } from 'react';
import { EMPTY_SELECTION, isRowSelected, selectionCount } from '@/shared/lib/gridSelection';

interface Asset {
  id: string;
  name: string;
  [key: string]: any;
}

export function useBulkActions<T extends Asset>(assets: T[], assetType: string) {
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>(EMPTY_SELECTION);
  const [addToFolderOpen, setAddToFolderOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const selectedAssets = useMemo(() => {
    return assets.filter((asset) => isRowSelected(selectedRows, asset.id));
  }, [assets, selectedRows]);

  const selectedAssetsForDialog = useMemo(() => {
    return selectedAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: assetType,
    }));
  }, [selectedAssets, assetType]);

  const clearSelection = () => {
    setSelectedRows(EMPTY_SELECTION);
  };

  const handleBulkComplete = (onComplete?: () => void) => {
    clearSelection();
    onComplete?.();
  };

  return {
    // State
    selectedRows,
    setSelectedRows,
    addToFolderOpen,
    setAddToFolderOpen,
    bulkTagOpen,
    setBulkTagOpen,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    
    // Computed
    selectedAssets,
    selectedAssetsForDialog,
    selectedCount: selectionCount(selectedRows, assets.length),
    
    // Actions
    clearSelection,
    handleBulkComplete,
  };
}