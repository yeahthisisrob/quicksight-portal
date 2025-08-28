import { GridSortModel } from '@mui/x-data-grid';
import { useState, useEffect } from 'react';

export type ViewMode = 'physical' | 'semantic' | 'mapping' | 'visual-fields' | 'calculated';

export interface DialogState {
  selectedTerm: any;
  selectedField: any;
  selectedVisualField: any;
  selectedAssetType: string;
  selectedAssets: any[];
  termDialogOpen: boolean;
  mappingDialogOpen: boolean;
  unmappedDialogOpen: boolean;
  detailsDialogOpen: boolean;
  assetListDialogOpen: boolean;
  mappedFieldsDialogOpen: boolean;
  visualFieldDetailsDialogOpen: boolean;
  expressionViewerDialogOpen: boolean;
  unifiedFieldDetailsDialogOpen: boolean;
  confirmDialog: {
    open: boolean;
    message: string;
    title: string;
    onConfirm: () => void;
  };
}

export function useDataCatalogState() {
  const [viewMode, setViewMode] = useState<ViewMode>('physical');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  
  const [dialogState, setDialogState] = useState<DialogState>({
    selectedTerm: null,
    selectedField: null,
    selectedVisualField: null,
    selectedAssetType: '',
    selectedAssets: [],
    termDialogOpen: false,
    mappingDialogOpen: false,
    unmappedDialogOpen: false,
    detailsDialogOpen: false,
    assetListDialogOpen: false,
    mappedFieldsDialogOpen: false,
    visualFieldDetailsDialogOpen: false,
    expressionViewerDialogOpen: false,
    unifiedFieldDetailsDialogOpen: false,
    confirmDialog: {
      open: false,
      message: '',
      title: '',
      onConfirm: () => {},
    },
  });

  // Reset page and sort when viewMode changes
  useEffect(() => {
    setPage(0);
    setSortModel([]);
  }, [viewMode]);

  const updateDialogState = (updates: Partial<DialogState>) => {
    setDialogState(prev => ({ ...prev, ...updates }));
  };

  const openDialog = (dialogName: keyof DialogState, data?: any) => {
    const updates: Partial<DialogState> = { [dialogName]: true };
    
    if (dialogName === 'termDialogOpen' && data) {
      updates.selectedTerm = data;
    } else if (dialogName === 'mappingDialogOpen' && data) {
      updates.selectedField = data;
    } else if (dialogName === 'detailsDialogOpen' && data) {
      updates.selectedField = data;
    } else if (dialogName === 'visualFieldDetailsDialogOpen' && data) {
      updates.selectedVisualField = data;
    } else if (dialogName === 'assetListDialogOpen' && data) {
      updates.selectedField = data.field;
      updates.selectedAssetType = data.assetType;
      updates.selectedAssets = data.assets;
    } else if (dialogName === 'mappedFieldsDialogOpen' && data) {
      updates.selectedTerm = data;
    } else if (dialogName === 'expressionViewerDialogOpen' && data) {
      updates.selectedField = data;
    } else if (dialogName === 'unifiedFieldDetailsDialogOpen' && data) {
      updates.selectedField = data;
    }
    
    updateDialogState(updates);
  };

  const closeDialog = (dialogName: keyof DialogState) => {
    const updates: Partial<DialogState> = { [dialogName]: false };
    
    // Clear related data when closing dialogs
    if (dialogName === 'termDialogOpen') {
      updates.selectedTerm = null;
    } else if (dialogName === 'mappingDialogOpen' || dialogName === 'detailsDialogOpen' || dialogName === 'expressionViewerDialogOpen' || dialogName === 'unifiedFieldDetailsDialogOpen') {
      updates.selectedField = null;
    } else if (dialogName === 'visualFieldDetailsDialogOpen') {
      updates.selectedVisualField = null;
    } else if (dialogName === 'assetListDialogOpen') {
      updates.selectedAssetType = '';
      updates.selectedAssets = [];
    }
    
    updateDialogState(updates);
  };

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    updateDialogState({
      confirmDialog: {
        open: true,
        title,
        message,
        onConfirm,
      },
    });
  };

  const closeConfirmDialog = () => {
    updateDialogState({
      confirmDialog: {
        open: false,
        message: '',
        title: '',
        onConfirm: () => {},
      },
    });
  };

  return {
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortModel,
    setSortModel,
    dialogState,
    openDialog,
    closeDialog,
    showConfirmDialog,
    closeConfirmDialog,
  };
}