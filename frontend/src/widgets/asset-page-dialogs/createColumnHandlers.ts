/**
 * Create column handlers for GenericAssetPage
 */
import type {
  AssetFoldersDialogState,
  DefinitionErrorsDialogState,
  DeleteGroupDialogState,
  DeleteUserDialogState,
  FolderMembersDialogState,
  GroupAssetsDialogState,
  GroupMembersDialogState,
  JsonViewerDialogState,
  NotifyInactiveAnalysesDialogState,
  NotifyInactiveDialogState,
  NotifyUnusedDatasetsDialogState,
  RefreshScheduleDialogState,
  UpdateGroupDialogState,
  UserAssetAccessDialogState,
  UserGroupsDialogState,
} from './useDialogStates';
import type { AssetType } from '@/shared/types/asset';


interface DialogSetters {
  setJsonViewerDialog: (state: JsonViewerDialogState) => void;
  setFolderMembersDialog: (state: FolderMembersDialogState) => void;
  setAssetFoldersDialog: (state: AssetFoldersDialogState) => void;
  setUserGroupsDialog: (state: UserGroupsDialogState) => void;
  setGroupMembersDialog: (state: GroupMembersDialogState) => void;
  setGroupAssetsDialog: (state: GroupAssetsDialogState) => void;
  setUpdateGroupDialog: (state: UpdateGroupDialogState) => void;
  setDeleteGroupDialog: (state: DeleteGroupDialogState) => void;
  setDeleteUserDialog: (state: DeleteUserDialogState) => void;
  setRefreshScheduleDialog: (state: RefreshScheduleDialogState) => void;
  setDefinitionErrorsDialog: (state: DefinitionErrorsDialogState) => void;
  setUserAssetAccessDialog: (state: UserAssetAccessDialogState) => void;
  setNotifyInactiveDialog: (state: NotifyInactiveDialogState) => void;
  setNotifyInactiveAnalysesDialog: (state: NotifyInactiveAnalysesDialogState) => void;
  setNotifyUnusedDatasetsDialog: (state: NotifyUnusedDatasetsDialogState) => void;
}

interface PageStateActions {
  openPermissionsDialog: (asset: any) => void;
  openTagsDialog: (asset: any) => void;
  openRelatedAssetsDialog: (asset: any, relatedAssets: any[]) => void;
}

export function createColumnHandlers(
  _assetType: AssetType,
  dialogSetters: DialogSetters,
  pageStateActions: PageStateActions,
  onActivityClick?: (asset: any) => void
) {
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
  } = dialogSetters;
  
  const {
    openPermissionsDialog,
    openTagsDialog,
    openRelatedAssetsDialog,
  } = pageStateActions;

  return {
    onPermissionsClick: (asset: any) => {
      openPermissionsDialog(asset);
    },
    onTagsClick: (asset: any) => {
      openTagsDialog(asset);
    },
    onRelatedAssetsClick: (asset: any) => {
      const relatedAssets = asset?.relatedAssets || [];
      openRelatedAssetsDialog(asset, relatedAssets);
    },
    onFolderMembersClick: (folder: any) => {
      setFolderMembersDialog({ open: true, folder });
    },
    onFoldersClick: (asset: any) => {
      setAssetFoldersDialog({ open: true, asset });
    },
    onJsonViewerClick: (asset: any, type: string) => {
      setJsonViewerDialog({ open: true, [type]: asset });
    },
    onActivityClick,
    onUserGroupsClick: (user: any) => {
      setUserGroupsDialog({ open: true, user });
    },
    onUserAssetAccessClick: (user: any) => {
      setUserAssetAccessDialog({ open: true, user });
    },
    onGroupMembersClick: (group: any) => {
      setGroupMembersDialog({ open: true, group });
    },
    onGroupAssetsClick: (group: any) => {
      setGroupAssetsDialog({ open: true, group });
    },
    onGroupUpdate: (group: any) => {
      setUpdateGroupDialog({ open: true, group });
    },
    onGroupDelete: (group: any) => {
      setDeleteGroupDialog({ open: true, group });
    },
    onUserDelete: (user: any) => {
      setDeleteUserDialog({ open: true, user });
    },
    onRefreshScheduleClick: (dataset: any) => {
      setRefreshScheduleDialog({ open: true, dataset });
    },
    onDefinitionErrorsClick: (asset: any) => {
      setDefinitionErrorsDialog({ open: true, asset });
    },
    onNotifyInactive: (asset: any) => {
      setNotifyInactiveDialog({ open: true, asset });
    },
    onNotifyInactiveAnalyses: (user: any) => {
      setNotifyInactiveAnalysesDialog({ open: true, user });
    },
    onNotifyUnusedDatasets: (user: any) => {
      setNotifyUnusedDatasetsDialog({ open: true, user });
    },
  };
}