/**
 * Create column handlers for GenericAssetPage
 */
import type { AssetType } from '@/shared/types/asset';

interface DialogSetters {
  setJsonViewerDialog: (state: any) => void;
  setFolderMembersDialog: (state: any) => void;
  setAssetFoldersDialog: (state: any) => void;
  setUserGroupsDialog: (state: any) => void;
  setGroupMembersDialog: (state: any) => void;
  setGroupAssetsDialog: (state: any) => void;
  setUpdateGroupDialog: (state: any) => void;
  setDeleteGroupDialog: (state: any) => void;
  setRefreshScheduleDialog: (state: any) => void;
  setDefinitionErrorsDialog: (state: any) => void;
  setNotifyInactiveDialog: (state: any) => void;
}

interface PageStateActions {
  openPermissionsDialog: (asset: any) => void;
  openTagsDialog: (asset: any) => void;
  openRelatedAssetsDialog: (asset: any, relatedAssets: any[]) => void;
  pageState: {
    openPermissionsDialog: (asset: any, type: AssetType) => void;
    openTagsDialog: (asset: any, type: AssetType) => void;
    openRelatedAssetsDialog: (asset: any, type: AssetType) => void;
  };
}

export function createColumnHandlers(
  assetType: AssetType,
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
    setRefreshScheduleDialog,
    setDefinitionErrorsDialog,
    setNotifyInactiveDialog,
  } = dialogSetters;
  
  const {
    openPermissionsDialog,
    openTagsDialog,
    openRelatedAssetsDialog,
    pageState,
  } = pageStateActions;
  
  return {
    onPermissionsClick: (asset: any) => {
      openPermissionsDialog(asset);
      pageState.openPermissionsDialog(asset, assetType);
    },
    onTagsClick: (asset: any) => {
      openTagsDialog(asset);
      pageState.openTagsDialog(asset, assetType);
    },
    onRelatedAssetsClick: (asset: any) => {
      const relatedAssets = asset?.relatedAssets || [];
      openRelatedAssetsDialog(asset, relatedAssets);
      pageState.openRelatedAssetsDialog(asset, assetType);
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
    onRefreshScheduleClick: (dataset: any) => {
      setRefreshScheduleDialog({ open: true, dataset });
    },
    onDefinitionErrorsClick: (asset: any) => {
      setDefinitionErrorsDialog({ open: true, asset });
    },
    onNotifyInactive: (asset: any) => {
      setNotifyInactiveDialog({ open: true, asset });
    },
  };
}