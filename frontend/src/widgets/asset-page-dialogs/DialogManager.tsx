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

import { InactivityMailtoDialog } from '@/features/activity';
import { 
  AddToGroupDialog, 
  FolderMembersDialog, 
  GroupAssetsDialog, 
  GroupMembersDialog, 
  UpdateGroupDialog, 
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
  handleRefreshTags
}: any) => (
  <>
    {permissionsDialog.asset && (
      <PermissionsDialog
        open={permissionsDialog.open}
        onClose={() => setPermissionsDialog({ open: false })}
        assetName={permissionsDialog.asset.name}
        assetType={typeCapitalized}
        permissions={normalizePermissions(permissionsDialog.asset?.permissions || [])}
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
        onTagsUpdate={handleRefreshTags}
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
  notifyInactiveDialog: any;
  setNotifyInactiveDialog: (state: any) => void;

  // Other props
  assetType: AssetType;
  selectedAssets: any[];
  handleRefreshTags: () => void;
  handleBulkComplete: () => void;
  refreshAssetType: (type: AssetType) => Promise<void>;
  handleGroupDelete: () => Promise<void>;
  isDeletingGroup: boolean;
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
  assetType,
  selectedAssets,
  handleRefreshTags,
  handleBulkComplete,
  refreshAssetType,
  handleGroupDelete,
  isDeletingGroup,
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
        handleRefreshTags={handleRefreshTags}
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
    </>
  );
}