/**
 * Hook to manage dialog states for GenericAssetPage
 */
import { useSnackbar } from 'notistack';
import { useState } from 'react';

import type { AssetType } from '@/shared/types/asset';
import type { components } from '@shared/generated/types';

// Type aliases for better readability
type DashboardItem = components["schemas"]["DashboardListItem"];
type AnalysisItem = components["schemas"]["AnalysisListItem"];
type DatasetItem = components["schemas"]["DatasetListItem"];
type FolderItem = components["schemas"]["FolderListItem"];
type UserItem = components["schemas"]["UserListItem"];
type GroupItem = components["schemas"]["GroupListItem"];
type AssetWithErrors = DashboardItem | AnalysisItem;
type AssetItem = components["schemas"]["AssetListItem"];

// Dialog state types
interface JsonViewerDialogState {
  open: boolean;
  [key: string]: any; // For dynamic asset type properties
}

interface FolderMembersDialogState {
  open: boolean;
  folder: FolderItem | null;
}

interface UserGroupsDialogState {
  open: boolean;
  user: UserItem | null;
}

interface GroupMembersDialogState {
  open: boolean;
  group: GroupItem | null;
}

interface GroupAssetsDialogState {
  open: boolean;
  group: GroupItem | null;
}

interface RefreshScheduleDialogState {
  open: boolean;
  dataset: DatasetItem | null;
}

interface DefinitionErrorsDialogState {
  open: boolean;
  asset: AssetWithErrors | null;
}

interface AssetFoldersDialogState {
  open: boolean;
  asset: AssetItem | null;
}

interface UpdateGroupDialogState {
  open: boolean;
  group: GroupItem | null;
}

interface DeleteGroupDialogState {
  open: boolean;
  group: GroupItem | null;
}

interface NotifyInactiveDialogState {
  open: boolean;
  asset: DashboardItem | AnalysisItem | null;
}

export function useDialogStates(
  refreshAssetType: (type: AssetType) => Promise<void>
) {
  const { enqueueSnackbar } = useSnackbar();
  
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
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  
  const handleGroupDelete = async () => {
    if (!deleteGroupDialog.group) return;
    
    try {
      setIsDeletingGroup(true);
      const { groupsApi } = await import('@/shared/api');
      await groupsApi.deleteGroup(deleteGroupDialog.group.name);
      
      enqueueSnackbar(`Group "${deleteGroupDialog.group.name}" deleted successfully`, { variant: 'success' });
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

    // Actions
    handleGroupDelete,
    isDeletingGroup,
  };
}