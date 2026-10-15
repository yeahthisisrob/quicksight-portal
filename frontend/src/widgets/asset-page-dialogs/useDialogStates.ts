/**
 * Hook to manage dialog states for GenericAssetPage
 */

import type { components } from '@shared/generated/types';
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { useAssetsOptional } from '@/entities/asset';

import type { AssetType } from '@/shared/types/asset';

// Type aliases for better readability - all fields come from the generated
// OpenAPI schema (activity/definitionErrors/dataSetRefreshProperties included)
type DashboardItem = components['schemas']['DashboardListItem'];
type AnalysisItem = components['schemas']['AnalysisListItem'];
type DatasetItem = components['schemas']['DatasetListItem'];
type FolderItem = components['schemas']['FolderListItem'];
type UserItem = components['schemas']['UserListItem'];
type GroupItem = components['schemas']['GroupListItem'];
type AssetWithErrors = DashboardItem | AnalysisItem;
type AssetItem = components['schemas']['AssetListItem'];

// Dialog state types
export interface JsonViewerDialogState {
  open: boolean;
  [key: string]: any; // For dynamic asset type properties
}

export interface FolderMembersDialogState {
  open: boolean;
  folder: FolderItem | null;
}

export interface UserGroupsDialogState {
  open: boolean;
  user: UserItem | null;
}

export interface GroupMembersDialogState {
  open: boolean;
  group: GroupItem | null;
}

export interface GroupAssetsDialogState {
  open: boolean;
  group: GroupItem | null;
}

export interface RefreshScheduleDialogState {
  open: boolean;
  dataset: DatasetItem | null;
}

export interface DefinitionErrorsDialogState {
  open: boolean;
  asset: AssetWithErrors | null;
}

export interface AssetFoldersDialogState {
  open: boolean;
  asset: AssetItem | null;
}

export interface UpdateGroupDialogState {
  open: boolean;
  group: GroupItem | null;
}

export interface DeleteGroupDialogState {
  open: boolean;
  group: GroupItem | null;
}

export interface DeleteUserDialogState {
  open: boolean;
  user: UserItem | null;
}

export interface NotifyInactiveDialogState {
  open: boolean;
  asset: DashboardItem | AnalysisItem | null;
}

export interface RenameAssetDialogState {
  open: boolean;
  asset: { id: string; name: string } | null;
}

export interface DatasetSourceDialogState {
  open: boolean;
  dataset: { id: string; name: string } | null;
}

export interface WireframeDialogState {
  open: boolean;
  asset: { id: string; name: string } | null;
}

export interface FolderSharingDialogState {
  open: boolean;
  folder: { id: string; name: string } | null;
}

export interface DeleteFolderDialogState {
  open: boolean;
  folder: { id: string; name: string; memberCount?: number } | null;
}

export interface VersionHistoryDialogState {
  open: boolean;
  asset: { id: string; name: string } | null;
}

export interface RebindDialogState {
  open: boolean;
  asset: { id: string; name: string } | null;
}

export interface UserAssetAccessDialogState {
  open: boolean;
  user: UserItem | null;
}

export interface NotifyInactiveAnalysesDialogState {
  open: boolean;
  user: UserItem | null;
}

export interface NotifyUnusedDatasetsDialogState {
  open: boolean;
  user: UserItem | null;
}

export function useDialogStates(refreshAssetType: (type: AssetType) => Promise<void>) {
  const { enqueueSnackbar } = useSnackbar();
  // Optional: absent in Storybook, present under the app's AssetsProvider
  const assetsContext = useAssetsOptional();

  // Core dialog states - now properly typed
  const [jsonViewerDialog, setJsonViewerDialog] = useState<JsonViewerDialogState>({ open: false });
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  const [folderMembersDialog, setFolderMembersDialog] = useState<FolderMembersDialogState>({
    open: false,
    folder: null,
  });
  const [userGroupsDialog, setUserGroupsDialog] = useState<UserGroupsDialogState>({
    open: false,
    user: null,
  });
  const [groupMembersDialog, setGroupMembersDialog] = useState<GroupMembersDialogState>({
    open: false,
    group: null,
  });
  const [groupAssetsDialog, setGroupAssetsDialog] = useState<GroupAssetsDialogState>({
    open: false,
    group: null,
  });
  const [refreshScheduleDialog, setRefreshScheduleDialog] = useState<RefreshScheduleDialogState>({
    open: false,
    dataset: null,
  });
  const [definitionErrorsDialog, setDefinitionErrorsDialog] = useState<DefinitionErrorsDialogState>(
    { open: false, asset: null }
  );
  const [assetFoldersDialog, setAssetFoldersDialog] = useState<AssetFoldersDialogState>({
    open: false,
    asset: null,
  });
  const [updateGroupDialog, setUpdateGroupDialog] = useState<UpdateGroupDialogState>({
    open: false,
    group: null,
  });
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<DeleteGroupDialogState>({
    open: false,
    group: null,
  });
  const [notifyInactiveDialog, setNotifyInactiveDialog] = useState<NotifyInactiveDialogState>({
    open: false,
    asset: null,
  });
  const [renameAssetDialog, setRenameAssetDialog] = useState<RenameAssetDialogState>({
    open: false,
    asset: null,
  });
  const [datasetSourceDialog, setDatasetSourceDialog] = useState<DatasetSourceDialogState>({
    open: false,
    dataset: null,
  });
  const [wireframeDialog, setWireframeDialog] = useState<WireframeDialogState>({
    open: false,
    asset: null,
  });
  const [versionHistoryDialog, setVersionHistoryDialog] = useState<VersionHistoryDialogState>({
    open: false,
    asset: null,
  });
  const [folderSharingDialog, setFolderSharingDialog] = useState<FolderSharingDialogState>({
    open: false,
    folder: null,
  });
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<DeleteFolderDialogState>({
    open: false,
    folder: null,
  });
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [rebindDialog, setRebindDialog] = useState<RebindDialogState>({
    open: false,
    asset: null,
  });
  const [userAssetAccessDialog, setUserAssetAccessDialog] = useState<UserAssetAccessDialogState>({
    open: false,
    user: null,
  });
  const [notifyInactiveAnalysesDialog, setNotifyInactiveAnalysesDialog] =
    useState<NotifyInactiveAnalysesDialogState>({ open: false, user: null });
  const [notifyUnusedDatasetsDialog, setNotifyUnusedDatasetsDialog] =
    useState<NotifyUnusedDatasetsDialogState>({ open: false, user: null });
  const [deleteUserDialog, setDeleteUserDialog] = useState<DeleteUserDialogState>({
    open: false,
    user: null,
  });
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleUserDelete = async () => {
    if (!deleteUserDialog.user) return;

    try {
      setIsDeletingUser(true);
      const { usersApi } = await import('@/shared/api');
      await usersApi.deleteUser(deleteUserDialog.user.name);

      enqueueSnackbar(`User "${deleteUserDialog.user.name}" deleted successfully`, {
        variant: 'success',
      });
      // Optimistic removal: the immediate list refetch can race the backend's
      // cache revalidation window; drop the row locally right away
      assetsContext?.removeAssets('user', [deleteUserDialog.user.id]);
      setDeleteUserDialog({ open: false, user: null });
      refreshAssetType('user');
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      enqueueSnackbar(error.message || 'Failed to delete user', { variant: 'error' });
    } finally {
      setIsDeletingUser(false);
    }
  };

  /** Delete the folder; one that still holds assets is emptied first (the assets stay). */
  const handleFolderDelete = async () => {
    if (!deleteFolderDialog.folder) return;
    const folder = deleteFolderDialog.folder;
    try {
      setIsDeletingFolder(true);
      const { foldersApi } = await import('@/shared/api');
      const result = await foldersApi.remove(folder.id, true);
      enqueueSnackbar(
        result.removedMembers > 0
          ? `Deleted folder "${folder.name}"; ${result.removedMembers} asset${result.removedMembers === 1 ? '' : 's'} taken out of it first`
          : `Deleted folder "${folder.name}"`,
        { variant: 'success' }
      );
      assetsContext?.removeAssets('folder', [folder.id]);
      setDeleteFolderDialog({ open: false, folder: null });
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'The folder could not be deleted', { variant: 'error' });
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const handleGroupDelete = async () => {
    if (!deleteGroupDialog.group) return;

    try {
      setIsDeletingGroup(true);
      const { groupsApi } = await import('@/shared/api');
      await groupsApi.deleteGroup(deleteGroupDialog.group.name);

      enqueueSnackbar(`Group "${deleteGroupDialog.group.name}" deleted successfully`, {
        variant: 'success',
      });
      assetsContext?.removeAssets('group', [deleteGroupDialog.group.id]);
      setDeleteGroupDialog({ open: false, group: null });
      refreshAssetType('group');
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      enqueueSnackbar(error.message || 'Failed to delete group', { variant: 'error' });
    } finally {
      setIsDeletingGroup(false);
    }
  };

  return {
    // Dialog states
    jsonViewerDialog,
    setJsonViewerDialog,
    addToGroupOpen,
    setAddToGroupOpen,
    folderMembersDialog,
    setFolderMembersDialog,
    userGroupsDialog,
    setUserGroupsDialog,
    groupMembersDialog,
    setGroupMembersDialog,
    groupAssetsDialog,
    setGroupAssetsDialog,
    refreshScheduleDialog,
    setRefreshScheduleDialog,
    definitionErrorsDialog,
    setDefinitionErrorsDialog,
    assetFoldersDialog,
    setAssetFoldersDialog,
    updateGroupDialog,
    setUpdateGroupDialog,
    deleteGroupDialog,
    setDeleteGroupDialog,
    notifyInactiveDialog,
    setNotifyInactiveDialog,
    renameAssetDialog,
    setRenameAssetDialog,
    datasetSourceDialog,
    setDatasetSourceDialog,
    wireframeDialog,
    setWireframeDialog,
    versionHistoryDialog,
    setVersionHistoryDialog,
    folderSharingDialog,
    setFolderSharingDialog,
    deleteFolderDialog,
    setDeleteFolderDialog,
    handleFolderDelete,
    isDeletingFolder,
    rebindDialog,
    setRebindDialog,
    userAssetAccessDialog,
    setUserAssetAccessDialog,
    notifyInactiveAnalysesDialog,
    setNotifyInactiveAnalysesDialog,
    notifyUnusedDatasetsDialog,
    setNotifyUnusedDatasetsDialog,

    deleteUserDialog,
    setDeleteUserDialog,

    // Actions
    handleGroupDelete,
    isDeletingGroup,
    handleUserDelete,
    isDeletingUser,
  };
}
