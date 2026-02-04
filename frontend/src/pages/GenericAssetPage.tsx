/**
 * Refactored GenericAssetPage with reduced complexity
 */
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { EnhancedAssetTable } from '@/widgets';

import { 
  createColumnHandlers, 
  DialogManager, 
  useDialogStates 
} from '@/widgets/asset-page-dialogs';
import { createAssetColumns ,type  FetchAssetsOptions } from '@/widgets/asset-table';

import { useAssetPage } from '@/features/asset-management';

import { useAssetPageState, useExportCSV } from '@/shared/lib';

import type { AssetType } from '@/shared/types/asset';
import type { TagOption, FolderOption } from '@/widgets/filter-bar';

interface GenericAssetPageProps {
  assetType: AssetType;
  title: string;
  subtitle: string;
  assets: any[];
  loading: boolean;
  pagination: { totalItems: number } | null;
  fetchAssets: (options: FetchAssetsOptions) => Promise<void>;
  refreshAssetType: (type: AssetType) => Promise<void>;
  updateAssetTags: (type: string, id: string, tags: any[]) => void;
  extraToolbarActions?: ReactNode;
  onActivityClick?: (asset: any) => void;
  /** Enable tag filtering UI */
  enableTagFiltering?: boolean;
  /** Available tags for filtering */
  availableTags?: TagOption[];
  /** Loading state for tag options */
  isLoadingTags?: boolean;
  /** Enable error filtering UI */
  enableErrorFiltering?: boolean;
  /** Count of assets with errors */
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

/**
 * Determine if asset type allows deletion
 */
function canDeleteAssetType(assetType: AssetType): boolean {
  return ['dashboard', 'analysis', 'dataset', 'datasource'].includes(assetType);
}

/**
 * Get folder action label based on asset type
 */
function getFolderActionLabel(assetType: AssetType): string {
  return assetType === 'user' ? 'Add to Group' : 'Add to Folder';
}

export default function GenericAssetPage({
  assetType,
  title,
  subtitle,
  assets,
  loading,
  pagination,
  fetchAssets,
  refreshAssetType,
  updateAssetTags,
  extraToolbarActions,
  onActivityClick,
  enableTagFiltering = false,
  availableTags = [],
  isLoadingTags = false,
  enableErrorFiltering = false,
  errorCount,
  enableActivityFiltering = false,
  enableFolderFiltering = false,
  availableFolders = [],
  isLoadingFolders = false,
}: GenericAssetPageProps) {
  const navigate = useNavigate();
  const pageState = useAssetPageState();
  const handleExportCSV = useExportCSV(assetType, 'Export');
  
  // Asset page hook for core functionality
  const {
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
    openPermissionsDialog,
    openTagsDialog,
    openRelatedAssetsDialog,
  } = useAssetPage({
    assetType,
    assets,
    refreshAssetType,
    updateAssetTags,
  });
  
  // Dialog states hook
  const dialogStates = useDialogStates(refreshAssetType);
  
  // Create column handlers
  const columnHandlers = createColumnHandlers(
    assetType,
    {
      setJsonViewerDialog: dialogStates.setJsonViewerDialog,
      setFolderMembersDialog: dialogStates.setFolderMembersDialog,
      setAssetFoldersDialog: dialogStates.setAssetFoldersDialog,
      setUserGroupsDialog: dialogStates.setUserGroupsDialog,
      setGroupMembersDialog: dialogStates.setGroupMembersDialog,
      setGroupAssetsDialog: dialogStates.setGroupAssetsDialog,
      setUpdateGroupDialog: dialogStates.setUpdateGroupDialog,
      setDeleteGroupDialog: dialogStates.setDeleteGroupDialog,
      setRefreshScheduleDialog: dialogStates.setRefreshScheduleDialog,
      setDefinitionErrorsDialog: dialogStates.setDefinitionErrorsDialog,
    },
    {
      openPermissionsDialog,
      openTagsDialog,
      openRelatedAssetsDialog,
      pageState,
    },
    onActivityClick
  );
  
  // Create columns with handlers
  const columns = createAssetColumns(assetType, navigate, columnHandlers);
  
  // Determine capabilities
  const canDelete = canDeleteAssetType(assetType);
  const folderActionLabel = getFolderActionLabel(assetType);
  
  // Determine folder action handler
  const handleFolderAction = () => {
    if (assetType === 'user') {
      dialogStates.setAddToGroupOpen(true);
    } else if (assetType !== 'group') {
      setAddToFolderOpen(true);
    }
  };
  
  return (
    <EnhancedAssetTable
      title={title}
      subtitle={subtitle}
      assets={assets}
      loading={loading}
      totalRows={pagination?.totalItems || 0}
      columns={columns}
      onFetchAssets={fetchAssets}
      onRefreshAssets={() => refreshAssetType(assetType)}
      onRefreshTags={handleRefreshTags}
      selectedRows={selectedRows}
      onSelectionChange={setSelectedRows}
      enableBulkActions={true}
      defaultSortModel={defaultSortModel}
      onExportCSV={handleExportCSV}
      exportLabel="Export"
      onAddToFolder={assetType !== 'group' ? handleFolderAction : undefined}
      onBulkTag={() => setBulkTagOpen(true)}
      onBulkDelete={canDelete ? () => setBulkDeleteOpen(true) : undefined}
      showDeleteAction={canDelete}
      extraToolbarActions={extraToolbarActions}
      folderActionLabel={folderActionLabel}
      enableTagFiltering={enableTagFiltering}
      availableTags={availableTags}
      isLoadingTags={isLoadingTags}
      enableErrorFiltering={enableErrorFiltering}
      errorCount={errorCount}
      enableActivityFiltering={enableActivityFiltering}
      showActivityOption={['dashboard', 'analysis'].includes(assetType)}
      enableFolderFiltering={enableFolderFiltering}
      availableFolders={availableFolders}
      isLoadingFolders={isLoadingFolders}
    >
      <DialogManager
        // Core dialog states
        permissionsDialog={permissionsDialog}
        setPermissionsDialog={setPermissionsDialog}
        relatedAssetsDialog={relatedAssetsDialog}
        setRelatedAssetsDialog={setRelatedAssetsDialog}
        tagsDialog={tagsDialog}
        setTagsDialog={setTagsDialog}
        
        // Bulk action dialogs
        addToFolderOpen={addToFolderOpen}
        setAddToFolderOpen={setAddToFolderOpen}
        bulkTagOpen={bulkTagOpen}
        setBulkTagOpen={setBulkTagOpen}
        bulkDeleteOpen={bulkDeleteOpen}
        setBulkDeleteOpen={setBulkDeleteOpen}
        
        // Asset-specific dialogs
        {...dialogStates}
        
        // Other props
        assetType={assetType}
        selectedAssets={selectedAssets}
        handleRefreshTags={handleRefreshTags}
        handleBulkComplete={handleBulkComplete}
        refreshAssetType={refreshAssetType}
      />
    </EnhancedAssetTable>
  );
}