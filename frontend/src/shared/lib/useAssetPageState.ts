import { GridRowSelectionModel } from '@mui/x-data-grid';
import { useState, useCallback } from 'react';

export interface DialogState<T = any> {
  open: boolean;
  asset?: T;
  dashboard?: T;
  analysis?: T;
  dataset?: T;
  datasource?: T;
  folder?: T;
}

export interface AssetPageState {
  permissionsDialog: DialogState;
  relatedAssetsDialog: DialogState;
  tagsDialog: DialogState;
  jsonViewerDialog: DialogState;
  addToFolderOpen: boolean;
  bulkTagOpen: boolean;
  selectedRows: GridRowSelectionModel;
}

export interface AssetPageActions {
  openPermissionsDialog: (asset: any, assetType: string) => void;
  closePermissionsDialog: () => void;
  openRelatedAssetsDialog: (asset: any, assetType: string) => void;
  closeRelatedAssetsDialog: () => void;
  openTagsDialog: (asset: any, assetType: string) => void;
  closeTagsDialog: () => void;
  openJsonViewerDialog: (asset: any, assetType: string) => void;
  closeJsonViewerDialog: () => void;
  openAddToFolder: () => void;
  closeAddToFolder: () => void;
  openBulkTag: () => void;
  closeBulkTag: () => void;
  setSelectedRows: (rows: GridRowSelectionModel) => void;
  clearSelection: () => void;
}

export function useAssetPageState(): AssetPageState & AssetPageActions {
  const [permissionsDialog, setPermissionsDialog] = useState<DialogState>({ open: false });
  const [relatedAssetsDialog, setRelatedAssetsDialog] = useState<DialogState>({ open: false });
  const [tagsDialog, setTagsDialog] = useState<DialogState>({ open: false });
  const [jsonViewerDialog, setJsonViewerDialog] = useState<DialogState>({ open: false });
  const [addToFolderOpen, setAddToFolderOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);

  const openPermissionsDialog = useCallback((asset: any, assetType: string) => {
    setPermissionsDialog({ open: true, [assetType]: asset });
  }, []);

  const closePermissionsDialog = useCallback(() => {
    setPermissionsDialog({ open: false });
  }, []);

  const openRelatedAssetsDialog = useCallback((asset: any, assetType: string) => {
    setRelatedAssetsDialog({ open: true, [assetType]: asset });
  }, []);

  const closeRelatedAssetsDialog = useCallback(() => {
    setRelatedAssetsDialog({ open: false });
  }, []);

  const openTagsDialog = useCallback((asset: any, assetType: string) => {
    setTagsDialog({ open: true, [assetType]: asset });
  }, []);

  const closeTagsDialog = useCallback(() => {
    setTagsDialog({ open: false });
  }, []);

  const openJsonViewerDialog = useCallback((asset: any, assetType: string) => {
    setJsonViewerDialog({ open: true, [assetType]: asset });
  }, []);

  const closeJsonViewerDialog = useCallback(() => {
    setJsonViewerDialog({ open: false });
  }, []);

  const openAddToFolder = useCallback(() => {
    setAddToFolderOpen(true);
  }, []);

  const closeAddToFolder = useCallback(() => {
    setAddToFolderOpen(false);
  }, []);

  const openBulkTag = useCallback(() => {
    setBulkTagOpen(true);
  }, []);

  const closeBulkTag = useCallback(() => {
    setBulkTagOpen(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows([]);
  }, []);

  return {
    // State
    permissionsDialog,
    relatedAssetsDialog,
    tagsDialog,
    jsonViewerDialog,
    addToFolderOpen,
    bulkTagOpen,
    selectedRows,
    // Actions
    openPermissionsDialog,
    closePermissionsDialog,
    openRelatedAssetsDialog,
    closeRelatedAssetsDialog,
    openTagsDialog,
    closeTagsDialog,
    openJsonViewerDialog,
    closeJsonViewerDialog,
    openAddToFolder,
    closeAddToFolder,
    openBulkTag,
    closeBulkTag,
    setSelectedRows,
    clearSelection,
  };
}