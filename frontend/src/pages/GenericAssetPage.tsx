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
import { createAssetColumns } from '@/widgets/asset-table';

import { useAssetPage } from '@/features/asset-management';

import { useAssetPageState, useExportCSV } from '@/shared/lib';

import type { AssetType } from '@/shared/types/asset';

interface GenericAssetPageProps {
  assetType: AssetType;
  title: string;
  subtitle: string;
  assets: any[];
  loading: boolean;
  pagination: { totalItems: number } | null;
  fetchAssets: (page: number, pageSize: number, search?: string, dateRange?: string, sortBy?: string, sortOrder?: string) => Promise<void>;
  refreshAssetType: (type: AssetType) => Promise<void>;
  updateAssetTags: (type: string, id: string, tags: any[]) => void;
  extraToolbarActions?: ReactNode;
  onActivityClick?: (asset: any) => void;
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