import { GridRowSelectionModel } from '@mui/x-data-grid';
import { useState, useMemo } from 'react';

interface Asset {
  id: string;
  name: string;
  [key: string]: any;
}

export function useBulkActions<T extends Asset>(assets: T[], assetType: string) {
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [addToFolderOpen, setAddToFolderOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const selectedAssets = useMemo(() => {
    return assets.filter((asset) => selectedRows.includes(asset.id));
  }, [assets, selectedRows]);

  const selectedAssetsForDialog = useMemo(() => {
    return selectedAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: assetType,
    }));
  }, [selectedAssets, assetType]);

  const clearSelection = () => {
    setSelectedRows([]);
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
    selectedCount: selectedRows.length,
    
    // Actions
    clearSelection,
    handleBulkComplete,
  };
}