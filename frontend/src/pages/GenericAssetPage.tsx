/**
 * Refactored GenericAssetPage with reduced complexity
 */
import { ReactNode, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { EnhancedAssetTable } from '@/widgets';

import { 
  createColumnHandlers, 
  DialogManager, 
  useDialogStates 
} from '@/widgets/asset-page-dialogs';
import { createAssetColumns ,type  FetchAssetsOptions ,type  TagOption,type  FolderOption,type  RoleOption,type  GroupOption,type  SourceTypeOption } from '@/widgets/asset-table';

import { useAssetPage } from '@/features/asset-management';

import { useExportCSV } from '@/shared/lib';

import type { AssetType } from '@/shared/types/asset';

interface GenericAssetPageProps {
  assetType: AssetType;
  title: string;
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
  enableSmusFiltering?: boolean;
  enableImportModeFiltering?: boolean;
  /** Enable folder filtering UI */
  enableFolderFiltering?: boolean;
  /** Available folders for filtering */
  availableFolders?: FolderOption[];
  /** Loading state for folder options */
  isLoadingFolders?: boolean;
  /** Enable role filtering UI */
  enableRoleFiltering?: boolean;
  /** Available roles for filtering */
  availableRoles?: RoleOption[];
  /** Enable permissions filtering UI */
  enablePermissionsFiltering?: boolean;
  /** Enable group filtering UI */
  enableGroupFiltering?: boolean;
  /** Available groups for filtering */
  availableGroups?: GroupOption[];
  /** Enable source type filtering UI */
  enableSourceTypeFiltering?: boolean;
  /** Available source types for filtering */
  availableSourceTypes?: SourceTypeOption[];
  /** Refresh trigger from context */
  refreshKey?: number;
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
  enableSmusFiltering = false,
  enableImportModeFiltering = false,
  enableRoleFiltering = false,
  availableRoles = [],
  enablePermissionsFiltering = false,
  enableGroupFiltering = false,
  availableGroups = [],
  enableSourceTypeFiltering = false,
  availableSourceTypes = [],
  enableFolderFiltering = false,
  availableFolders = [],
  isLoadingFolders = false,
  refreshKey = 0,
}: GenericAssetPageProps) {
  const navigate = useNavigate();
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

  // All of these are stable across renders (useState setters / useCallbacks),
  // so the memoized column handlers below only rebuild when assetType changes
  const {
    setJsonViewerDialog,
    setFolderMembersDialog,
    setAssetFoldersDialog,
    setUserGroupsDialog,
    setGroupMembersDialog,
    setGroupAssetsDialog,
    setUpdateGroupDialog,
    setDeleteGroupDialog,
    setDeleteUserDialog,
    setRefreshScheduleDialog,
    setDefinitionErrorsDialog,
    setUserAssetAccessDialog,
    setNotifyInactiveDialog,
    setNotifyInactiveAnalysesDialog,
    setNotifyUnusedDatasetsDialog,
    setAddToGroupOpen,
  } = dialogStates;
  // Create column handlers (memoized so the DataGrid keeps a stable column
  // identity instead of re-initializing all columns/cells on every render)
  const columnHandlers = useMemo(
    () =>
      createColumnHandlers(
        assetType,
        {
          setJsonViewerDialog,
          setFolderMembersDialog,
          setAssetFoldersDialog,
          setUserGroupsDialog,
          setGroupMembersDialog,
          setGroupAssetsDialog,
          setUpdateGroupDialog,
          setDeleteGroupDialog,
          setDeleteUserDialog,
          setRefreshScheduleDialog,
          setDefinitionErrorsDialog,
          setUserAssetAccessDialog,
          setNotifyInactiveDialog,
          setNotifyInactiveAnalysesDialog,
          setNotifyUnusedDatasetsDialog,
        },
        {
          openPermissionsDialog,
          openTagsDialog,
          openRelatedAssetsDialog,
        },
        onActivityClick
      ),
    [
      assetType,
      onActivityClick,
      openPermissionsDialog,
      openTagsDialog,
      openRelatedAssetsDialog,
      setJsonViewerDialog,
      setFolderMembersDialog,
      setAssetFoldersDialog,
      setUserGroupsDialog,
      setGroupMembersDialog,
      setGroupAssetsDialog,
      setUpdateGroupDialog,
      setDeleteGroupDialog,
      setDeleteUserDialog,
      setRefreshScheduleDialog,
      setDefinitionErrorsDialog,
      setUserAssetAccessDialog,
      setNotifyInactiveDialog,
      setNotifyInactiveAnalysesDialog,
      setNotifyUnusedDatasetsDialog,
    ]
  );

  // Create columns with handlers (stable while assetType/handlers are stable)
  const columns = useMemo(
    () => createAssetColumns(assetType, navigate, columnHandlers),
    [assetType, navigate, columnHandlers]
  );

  // Determine capabilities
  const canDelete = canDeleteAssetType(assetType);
  const folderActionLabel = getFolderActionLabel(assetType);

  // Determine folder action handler
  const handleFolderAction = useCallback(() => {
    if (assetType === 'user') {
      setAddToGroupOpen(true);
    } else if (assetType !== 'group') {
      setAddToFolderOpen(true);
    }
  }, [assetType, setAddToGroupOpen, setAddToFolderOpen]);
  
  return (
    <EnhancedAssetTable
      title={title}
      assets={assets}
      loading={loading}
      totalRows={pagination?.totalItems || 0}
      columns={columns}
      onFetchAssets={fetchAssets}
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
      enableSmusFiltering={enableSmusFiltering}
      enableImportModeFiltering={enableImportModeFiltering}
      showActivityOption={['dashboard', 'analysis', 'user'].includes(assetType)}
      enableRoleFiltering={enableRoleFiltering}
      availableRoles={availableRoles}
      enablePermissionsFiltering={enablePermissionsFiltering}
      enableGroupFiltering={enableGroupFiltering}
      availableGroups={availableGroups}
      enableSourceTypeFiltering={enableSourceTypeFiltering}
      availableSourceTypes={availableSourceTypes}
      enableFolderFiltering={enableFolderFiltering}
      availableFolders={availableFolders}
      isLoadingFolders={isLoadingFolders}
      refreshKey={refreshKey}
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
        handleBulkComplete={handleBulkComplete}
        refreshAssetType={refreshAssetType}
        updateAssetTags={updateAssetTags}
      />
    </EnhancedAssetTable>
  );
}