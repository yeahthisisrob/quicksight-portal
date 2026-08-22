/**
 * Hook to manage dialog states for GenericAssetPage
 */
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import { useAssetsOptional } from '@/entities/asset';

import type { AssetType } from '@/shared/types/asset';
import type { components } from '@shared/generated/types';

// Type aliases for better readability. The intersections add enrichment
// fields the backend attaches to list items but the OpenAPI schema does not
// declare yet (activity, definitionErrors, refreshProperties) — tighten the
// schema and drop these when it catches up.
export type DashboardItem = components["schemas"]["DashboardListItem"] & {
  activity?: { lastViewed?: string | null; totalViews?: number };
  definitionErrors?: any[];
};
export type AnalysisItem = components["schemas"]["AnalysisListItem"] & {
  activity?: { lastViewed?: string | null; totalViews?: number };
  definitionErrors?: any[];
};
export type DatasetItem = components["schemas"]["DatasetListItem"] & {
  refreshProperties?: any;
};
export type FolderItem = components["schemas"]["FolderListItem"];
export type UserItem = components["schemas"]["UserListItem"];
export type GroupItem = components["schemas"]["GroupListItem"];
export type AssetWithErrors = DashboardItem | AnalysisItem;
export type AssetItem = components["schemas"]["AssetListItem"];

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

export function useDialogStates(
  refreshAssetType: (type: AssetType) => Promise<void>
) {
  const { enqueueSnackbar } = useSnackbar();
  // Optional: absent in Storybook, present under the app's AssetsProvider
  const assetsContext = useAssetsOptional();
  
  // Core dialog states - now properly typed
  const [jsonViewerDialog, setJsonViewerDialog] = useState<JsonViewerDialogState>({ open: false });
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  const [folderMembersDialog, setFolderMembersDialog] = useState<FolderMembersDialogState>({ open: false, folder: null });
  const [userGroupsDialog, setUserGroupsDialog] = useState<UserGroupsDialogState>({ open: false, user: null });
  const [groupMembersDialog, setGroupMembersDialog] = useState<GroupMembersDialogState>({ open: false, group: null });
  const [groupAssetsDialog, setGroupAssetsDialog] = useState<GroupAssetsDialogState>({ open: false, group: null });
  const [refreshScheduleDialog, setRefreshScheduleDialog] = useState<RefreshScheduleDialogState>({ open: false, dataset: null });
  const [definitionErrorsDialog, setDefinitionErrorsDialog] = useState<DefinitionErrorsDialogState>({ open: false, asset: null });
  const [assetFoldersDialog, setAssetFoldersDialog] = useState<AssetFoldersDialogState>({ open: false, asset: null });
  const [updateGroupDialog, setUpdateGroupDialog] = useState<UpdateGroupDialogState>({ open: false, group: null });
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<DeleteGroupDialogState>({ open: false, group: null });
  const [notifyInactiveDialog, setNotifyInactiveDialog] = useState<NotifyInactiveDialogState>({ open: false, asset: null });
  const [userAssetAccessDialog, setUserAssetAccessDialog] = useState<UserAssetAccessDialogState>({ open: false, user: null });
  const [notifyInactiveAnalysesDialog, setNotifyInactiveAnalysesDialog] = useState<NotifyInactiveAnalysesDialogState>({ open: false, user: null });
  const [notifyUnusedDatasetsDialog, setNotifyUnusedDatasetsDialog] = useState<NotifyUnusedDatasetsDialogState>({ open: false, user: null });
  const [deleteUserDialog, setDeleteUserDialog] = useState<DeleteUserDialogState>({ open: false, user: null });
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleUserDelete = async () => {
    if (!deleteUserDialog.user) return;

    try {
      setIsDeletingUser(true);
      const { usersApi } = await import('@/shared/api');
      await usersApi.deleteUser(deleteUserDialog.user.name);

      enqueueSnackbar(`User "${deleteUserDialog.user.name}" deleted successfully`, { variant: 'success' });
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

  const handleGroupDelete = async () => {
    if (!deleteGroupDialog.group) return;
    
    try {
      setIsDeletingGroup(true);
      const { groupsApi } = await import('@/shared/api');
      await groupsApi.deleteGroup(deleteGroupDialog.group.name);
      
      enqueueSnackbar(`Group "${deleteGroupDialog.group.name}" deleted successfully`, { variant: 'success' });
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