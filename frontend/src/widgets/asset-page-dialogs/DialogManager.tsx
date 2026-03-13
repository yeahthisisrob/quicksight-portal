/**
 * Dialog manager for GenericAssetPage
 */
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { memo } from 'react';

import { 
  AssetFoldersDialog, 
  PermissionsDialog, 
  RelatedAssetsDialog, 
  TagsDialog 
} from '@/widgets/asset-dialogs';

import { InactivityMailtoDialog, UserInactiveMailtoDialog, UserUnusedDatasetsDialog } from '@/features/activity';
import {
  AddToGroupDialog,
  FolderMembersDialog,
  GroupAssetsDialog,
  GroupMembersDialog,
  UpdateGroupDialog,
  UserAssetAccessDialog,
  UserGroupsDialog
} from '@/features/organization';

import { BulkDeleteDialog, DefinitionErrorsDialog } from '@/entities/asset';
import { RefreshScheduleDialog } from '@/entities/dataset';
import { AddToFolderDialog } from '@/entities/folder';
import { BulkTagDialog } from '@/entities/tag';

import { normalizePermissions } from '@/shared/lib/dataGridColumns';
import { JsonViewerModal } from '@/shared/ui';


import type { AssetType } from '@/shared/types/asset';

// Sub-component for Core Asset Dialogs
const CoreAssetDialogs = memo(({
  permissionsDialog,
  setPermissionsDialog,
  relatedAssetsDialog,
  setRelatedAssetsDialog,
  tagsDialog,
  setTagsDialog,
  typeCapitalized,
  assetType,
  updateAssetTags,
  refreshAssetType
}: any) => (
  <>
    {permissionsDialog.asset && (
      <PermissionsDialog
        open={permissionsDialog.open}
        onClose={() => setPermissionsDialog({ open: false })}
        assetId={permissionsDialog.asset.id}
        assetName={permissionsDialog.asset.name}
        assetType={typeCapitalized}
        permissions={normalizePermissions(permissionsDialog.asset?.permissions || [])}
        onPermissionRevoked={() => refreshAssetType(assetType)}
      />
    )}

    {relatedAssetsDialog.asset && (
      <RelatedAssetsDialog
        open={relatedAssetsDialog.open}
        onClose={() => setRelatedAssetsDialog({ open: false })}
        assetName={relatedAssetsDialog.asset.name}
        assetType={typeCapitalized}
        relatedAssets={relatedAssetsDialog.relatedAssets || []}
      />
    )}

    {tagsDialog.asset && (
      <TagsDialog
        open={tagsDialog.open}
        onClose={() => setTagsDialog({ open: false })}
        assetId={tagsDialog.asset.id}
        assetName={tagsDialog.asset.name}
        assetType={typeCapitalized}
        resourceType={assetType}
        initialTags={tagsDialog.asset?.tags || []}
        onTagsUpdate={(tags: any[]) => updateAssetTags(assetType, tagsDialog.asset.id, tags)}
      />
    )}
  </>
));

// Sub-component for Bulk Action Dialogs
const BulkActionDialogs = memo(({
  addToFolderOpen,
  setAddToFolderOpen,
  addToGroupOpen,
  setAddToGroupOpen,
  bulkTagOpen,
  setBulkTagOpen,
  bulkDeleteOpen,
  setBulkDeleteOpen,
  selectedAssets,
  handleBulkComplete
}: any) => (
  <>
    <AddToFolderDialog
      open={addToFolderOpen}
      onClose={() => setAddToFolderOpen(false)}
      selectedAssets={selectedAssets}
      onComplete={handleBulkComplete}
    />
    
    <AddToGroupDialog
      open={addToGroupOpen}
      onClose={() => setAddToGroupOpen(false)}
      selectedUsers={selectedAssets}
      onComplete={handleBulkComplete}
    />
    
    <BulkTagDialog
      open={bulkTagOpen}
      onClose={() => setBulkTagOpen(false)}
      selectedAssets={selectedAssets}
      onComplete={handleBulkComplete}
    />
    
    <BulkDeleteDialog
      open={bulkDeleteOpen}
      onClose={() => setBulkDeleteOpen(false)}
      assets={selectedAssets}
      onComplete={handleBulkComplete}
    />
  </>
));

// Sub-component for Organization Dialogs
const OrganizationDialogs = memo(({
  folderMembersDialog,
  setFolderMembersDialog,
  assetFoldersDialog,
  setAssetFoldersDialog,
  userGroupsDialog,
  setUserGroupsDialog,
  userAssetAccessDialog,
  setUserAssetAccessDialog,
  groupMembersDialog,
  setGroupMembersDialog,
  groupAssetsDialog,
  setGroupAssetsDialog,
  updateGroupDialog,
  setUpdateGroupDialog,
  assetType,
  refreshAssetType
}: any) => (
  <>
    {folderMembersDialog.folder && (
      <FolderMembersDialog
        open={folderMembersDialog.open}
        onClose={() => setFolderMembersDialog({ open: false, folder: null })}
        folder={folderMembersDialog.folder}
      />
    )}
    
    {assetFoldersDialog.asset && (
      <AssetFoldersDialog
        open={assetFoldersDialog.open}
        onClose={() => setAssetFoldersDialog({ open: false, asset: null })}
        assetName={assetFoldersDialog.asset.name}
        assetType={assetType}
        folders={assetFoldersDialog.asset.folders || []}
      />
    )}
    
    {userGroupsDialog.user && (
      <UserGroupsDialog
        open={userGroupsDialog.open}
        onClose={() => setUserGroupsDialog({ open: false, user: null })}
        user={userGroupsDialog.user}
        onGroupsChange={() => {
          refreshAssetType(assetType);
        }}
      />
    )}
    
    {userAssetAccessDialog.user && (
      <UserAssetAccessDialog
        open={userAssetAccessDialog.open}
        onClose={() => setUserAssetAccessDialog({ open: false, user: null })}
        user={userAssetAccessDialog.user}
      />
    )}

    {groupMembersDialog.group && (
      <GroupMembersDialog
        open={groupMembersDialog.open}
        onClose={() => setGroupMembersDialog({ open: false, group: null })}
        groupName={groupMembersDialog.group.name}
        members={groupMembersDialog.group.metadata?.members || groupMembersDialog.group.members || []}
      />
    )}
    
    {groupAssetsDialog.group && (
      <GroupAssetsDialog
        open={groupAssetsDialog.open}
        onClose={() => setGroupAssetsDialog({ open: false, group: null })}
        group={groupAssetsDialog.group}
      />
    )}
    
    {updateGroupDialog.group && (
      <UpdateGroupDialog
        open={updateGroupDialog.open}
        onClose={() => setUpdateGroupDialog({ open: false, group: null })}
        group={updateGroupDialog.group}
        onSuccess={() => {
          setUpdateGroupDialog({ open: false, group: null });
          refreshAssetType('group');
        }}
      />
    )}
  </>
));

interface DialogManagerProps {
  // Core dialog states
  permissionsDialog: any;
  setPermissionsDialog: (state: any) => void;
  relatedAssetsDialog: any;
  setRelatedAssetsDialog: (state: any) => void;
  tagsDialog: any;
  setTagsDialog: (state: any) => void;
  
  // Bulk action dialogs
  addToFolderOpen: boolean;
  setAddToFolderOpen: (open: boolean) => void;
  bulkTagOpen: boolean;
  setBulkTagOpen: (open: boolean) => void;
  bulkDeleteOpen: boolean;
  setBulkDeleteOpen: (open: boolean) => void;
  
  // Asset-specific dialogs
  jsonViewerDialog: any;
  setJsonViewerDialog: (state: any) => void;
  addToGroupOpen: boolean;
  setAddToGroupOpen: (open: boolean) => void;
  folderMembersDialog: any;
  setFolderMembersDialog: (state: any) => void;
  userGroupsDialog: any;
  setUserGroupsDialog: (state: any) => void;
  userAssetAccessDialog: any;
  setUserAssetAccessDialog: (state: any) => void;
  groupMembersDialog: any;
  setGroupMembersDialog: (state: any) => void;
  groupAssetsDialog: any;
  setGroupAssetsDialog: (state: any) => void;
  refreshScheduleDialog: any;
  setRefreshScheduleDialog: (state: any) => void;
  definitionErrorsDialog: any;
  setDefinitionErrorsDialog: (state: any) => void;
  assetFoldersDialog: any;
  setAssetFoldersDialog: (state: any) => void;
  updateGroupDialog: any;
  setUpdateGroupDialog: (state: any) => void;
  deleteGroupDialog: any;
  setDeleteGroupDialog: (state: any) => void;
  deleteUserDialog: any;
  setDeleteUserDialog: (state: any) => void;
  notifyInactiveDialog: any;
  setNotifyInactiveDialog: (state: any) => void;
  notifyInactiveAnalysesDialog: any;
  setNotifyInactiveAnalysesDialog: (state: any) => void;
  notifyUnusedDatasetsDialog: any;
  setNotifyUnusedDatasetsDialog: (state: any) => void;

  // Other props
  assetType: AssetType;
  selectedAssets: any[];
  handleBulkComplete: () => void;
  refreshAssetType: (type: AssetType) => Promise<void>;
  updateAssetTags: (assetType: string, assetId: string, tags: any[]) => void;
  handleGroupDelete: () => Promise<void>;
  isDeletingGroup: boolean;
  handleUserDelete: () => Promise<void>;
  isDeletingUser: boolean;
}

export function DialogManager({
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
  jsonViewerDialog,
  setJsonViewerDialog,
  addToGroupOpen,
  setAddToGroupOpen,
  folderMembersDialog,
  setFolderMembersDialog,
  userGroupsDialog,
  setUserGroupsDialog,
  userAssetAccessDialog,
  setUserAssetAccessDialog,
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
  deleteUserDialog,
  setDeleteUserDialog,
  notifyInactiveDialog,
  setNotifyInactiveDialog,
  notifyInactiveAnalysesDialog,
  setNotifyInactiveAnalysesDialog,
  notifyUnusedDatasetsDialog,
  setNotifyUnusedDatasetsDialog,
  assetType,
  selectedAssets,
  handleBulkComplete,
  refreshAssetType,
  updateAssetTags,
  handleGroupDelete,
  isDeletingGroup,
  handleUserDelete,
  isDeletingUser,
}: DialogManagerProps) {
  const typeCapitalized = assetType.charAt(0).toUpperCase() + assetType.slice(1);
  
  return (
    <>
      {/* Core asset dialogs */}
      <CoreAssetDialogs
        permissionsDialog={permissionsDialog}
        setPermissionsDialog={setPermissionsDialog}
        relatedAssetsDialog={relatedAssetsDialog}
        setRelatedAssetsDialog={setRelatedAssetsDialog}
        tagsDialog={tagsDialog}
        setTagsDialog={setTagsDialog}
        typeCapitalized={typeCapitalized}
        assetType={assetType}
        updateAssetTags={updateAssetTags}
        refreshAssetType={refreshAssetType}
      />
      
      {/* Bulk action dialogs */}
      <BulkActionDialogs
        addToFolderOpen={addToFolderOpen}
        setAddToFolderOpen={setAddToFolderOpen}
        addToGroupOpen={addToGroupOpen}
        setAddToGroupOpen={setAddToGroupOpen}
        bulkTagOpen={bulkTagOpen}
        setBulkTagOpen={setBulkTagOpen}
        bulkDeleteOpen={bulkDeleteOpen}
        setBulkDeleteOpen={setBulkDeleteOpen}
        selectedAssets={selectedAssets}
        handleBulkComplete={handleBulkComplete}
      />
      
      {/* Organization dialogs */}
      <OrganizationDialogs
        folderMembersDialog={folderMembersDialog}
        setFolderMembersDialog={setFolderMembersDialog}
        assetFoldersDialog={assetFoldersDialog}
        setAssetFoldersDialog={setAssetFoldersDialog}
        userGroupsDialog={userGroupsDialog}
        setUserGroupsDialog={setUserGroupsDialog}
        userAssetAccessDialog={userAssetAccessDialog}
        setUserAssetAccessDialog={setUserAssetAccessDialog}
        groupMembersDialog={groupMembersDialog}
        setGroupMembersDialog={setGroupMembersDialog}
        groupAssetsDialog={groupAssetsDialog}
        setGroupAssetsDialog={setGroupAssetsDialog}
        updateGroupDialog={updateGroupDialog}
        setUpdateGroupDialog={setUpdateGroupDialog}
        assetType={assetType}
        refreshAssetType={refreshAssetType}
      />
      
      {/* JSON viewer */}
      {jsonViewerDialog.open && (
        <JsonViewerModal
          open={jsonViewerDialog.open}
          onClose={() => setJsonViewerDialog({ open: false })}
          assetId={jsonViewerDialog[assetType]?.id}
          assetName={jsonViewerDialog[assetType]?.name}
          assetType={assetType}
        />
      )}
      
      {/* Dataset-specific dialogs */}
      {refreshScheduleDialog.dataset && (
        <RefreshScheduleDialog
          open={refreshScheduleDialog.open}
          onClose={() => setRefreshScheduleDialog({ open: false, dataset: null })}
          datasetName={refreshScheduleDialog.dataset.name}
          refreshSchedules={refreshScheduleDialog.dataset.refreshSchedules}
          dataSetRefreshProperties={refreshScheduleDialog.dataset.refreshProperties}
        />
      )}
      
      {definitionErrorsDialog.asset && (
        <DefinitionErrorsDialog
          open={definitionErrorsDialog.open}
          onClose={() => setDefinitionErrorsDialog({ open: false, asset: null })}
          assetName={definitionErrorsDialog.asset.name}
          assetType={assetType as 'dashboard' | 'analysis'}
          errors={definitionErrorsDialog.asset.definitionErrors || []}
        />
      )}
      
      {/* Inactivity mailto dialog */}
      {notifyInactiveDialog.asset && (
        <InactivityMailtoDialog
          open={notifyInactiveDialog.open}
          onClose={() => setNotifyInactiveDialog({ open: false, asset: null })}
          asset={{
            id: notifyInactiveDialog.asset.id,
            name: notifyInactiveDialog.asset.name,
            type: assetType as 'dashboard' | 'analysis',
            lastViewed: notifyInactiveDialog.asset.activity?.lastViewed ?? null,
            activityCount: notifyInactiveDialog.asset.activity?.totalViews ?? 0,
          }}
        />
      )}

      {/* User inactive analyses mailto dialog */}
      {notifyInactiveAnalysesDialog.user && (
        <UserInactiveMailtoDialog
          open={notifyInactiveAnalysesDialog.open}
          onClose={() => setNotifyInactiveAnalysesDialog({ open: false, user: null })}
          user={{
            name: notifyInactiveAnalysesDialog.user.name,
            email: notifyInactiveAnalysesDialog.user.email,
          }}
        />
      )}

      {/* User unused datasets mailto dialog */}
      {notifyUnusedDatasetsDialog.user && (
        <UserUnusedDatasetsDialog
          open={notifyUnusedDatasetsDialog.open}
          onClose={() => setNotifyUnusedDatasetsDialog({ open: false, user: null })}
          user={{
            name: notifyUnusedDatasetsDialog.user.name,
            email: notifyUnusedDatasetsDialog.user.email,
          }}
        />
      )}

      {/* Delete group confirmation */}
      <Dialog
        open={deleteGroupDialog.open}
        onClose={() => setDeleteGroupDialog({ open: false, group: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the group "{deleteGroupDialog.group?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteGroupDialog({ open: false, group: null })}>
            Cancel
          </Button>
          <Button 
            onClick={handleGroupDelete} 
            color="error" 
            variant="contained"
            disabled={isDeletingGroup}
          >
            {isDeletingGroup ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete user confirmation */}
      <Dialog
        open={deleteUserDialog.open}
        onClose={() => setDeleteUserDialog({ open: false, user: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the user "{deleteUserDialog.user?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteUserDialog({ open: false, user: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleUserDelete}
            color="error"
            variant="contained"
            disabled={isDeletingUser}
          >
            {isDeletingUser ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}