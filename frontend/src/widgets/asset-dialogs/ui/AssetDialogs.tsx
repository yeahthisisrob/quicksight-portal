import { BulkDeleteDialog } from '@/entities/asset';
import { AddToFolderDialog } from '@/entities/folder';
import { BulkTagDialog } from '@/entities/tag';

import { JsonViewerModal } from '@/shared/ui';

import { 
  PermissionsDialog, 
  RelatedAssetsDialog, 
  TagsDialog 
} from './dialogs';

interface AssetDialogsProps {
  assetType: 'dashboard' | 'analysis' | 'dataset' | 'datasource';
  dialogStates: {
    permissionsDialog: { open: boolean; [key: string]: any };
    relatedAssetsDialog: { open: boolean; [key: string]: any };
    tagsDialog: { open: boolean; [key: string]: any };
    jsonViewerDialog: { open: boolean; [key: string]: any };
    addToFolderOpen: boolean;
    bulkTagOpen: boolean;
    bulkDeleteOpen: boolean;
  };
  selectedAssets: any[];
  onClosePermissions: () => void;
  onCloseRelatedAssets: () => void;
  onCloseTags: () => void;
  onCloseJsonViewer: () => void;
  onCloseAddToFolder: () => void;
  onCloseBulkTag: () => void;
  onCloseBulkDelete: () => void;
  onBulkDelete?: (reason: string) => void;
  onRefresh?: () => void;
  updateAssetTags?: (assetId: string, tags: any[]) => void;
  onBulkActionComplete?: () => void;
}

export const AssetDialogs = ({
  assetType,
  dialogStates,
  selectedAssets,
  onClosePermissions,
  onCloseRelatedAssets,
  onCloseTags,
  onCloseJsonViewer,
  onCloseAddToFolder,
  onCloseBulkTag,
  onCloseBulkDelete,
  onBulkDelete,
  onRefresh,
  updateAssetTags,
  onBulkActionComplete,
}: AssetDialogsProps) => {
  // Each dialog may have its own asset reference
  const permissionsAsset = dialogStates.permissionsDialog[assetType];
  const relatedAssetsAsset = dialogStates.relatedAssetsDialog[assetType];
  const tagsAsset = dialogStates.tagsDialog[assetType];
  const jsonViewerAsset = dialogStates.jsonViewerDialog[assetType];

  return (
    <>
      {dialogStates.permissionsDialog.open && permissionsAsset && (
        <PermissionsDialog
          open={dialogStates.permissionsDialog.open}
          onClose={onClosePermissions}
          assetName={permissionsAsset.name}
          assetType={assetType}
          permissions={permissionsAsset.permissions || []}
        />
      )}

      {dialogStates.relatedAssetsDialog.open && relatedAssetsAsset && (
        <RelatedAssetsDialog
          open={dialogStates.relatedAssetsDialog.open}
          onClose={onCloseRelatedAssets}
          assetName={relatedAssetsAsset.name}
          assetType={assetType}
          relatedAssets={relatedAssetsAsset.relatedAssets || []}
        />
      )}

      {dialogStates.tagsDialog.open && tagsAsset && (
        <TagsDialog
          open={dialogStates.tagsDialog.open}
          onClose={onCloseTags}
          assetId={tagsAsset.id}
          assetName={tagsAsset.name}
          assetType={assetType}
          resourceType={assetType}
          initialTags={tagsAsset.tags?.map((t: any) => ({ key: t.Key, value: t.Value })) || []}
          onTagsUpdate={(tags) => {
            if (updateAssetTags) {
              updateAssetTags(tagsAsset.id, tags);
            }
            if (onRefresh) {
              onRefresh();
            }
          }}
        />
      )}

      {dialogStates.jsonViewerDialog.open && jsonViewerAsset && (
        <JsonViewerModal
          open={dialogStates.jsonViewerDialog.open}
          onClose={onCloseJsonViewer}
          assetId={jsonViewerAsset.id}
          assetName={jsonViewerAsset.name}
          assetType={assetType}
        />
      )}

      {dialogStates.addToFolderOpen && selectedAssets.length > 0 && (
        <AddToFolderDialog
          open={dialogStates.addToFolderOpen}
          onClose={onCloseAddToFolder}
          selectedAssets={selectedAssets.map((asset: any) => ({
            id: asset.id,
            name: asset.name,
            type: assetType,
          }))}
          onComplete={onBulkActionComplete}
        />
      )}

      {dialogStates.bulkTagOpen && selectedAssets.length > 0 && (
        <BulkTagDialog
          open={dialogStates.bulkTagOpen}
          onClose={onCloseBulkTag}
          selectedAssets={selectedAssets.map((asset: any) => ({
            id: asset.id,
            name: asset.name,
            type: assetType,
          }))}
          onComplete={onBulkActionComplete}
        />
      )}

      {dialogStates.bulkDeleteOpen && selectedAssets.length > 0 && onBulkDelete && (
        <BulkDeleteDialog
          open={dialogStates.bulkDeleteOpen}
          onClose={onCloseBulkDelete}
          onComplete={() => {
            onCloseBulkDelete();
            onBulkDelete?.(''); // Call with empty reason for backwards compatibility
          }}
          assets={selectedAssets.map((asset: any) => {
            // Extract uses and usedBy from relatedAssets
            let uses: any[] = [];
            let usedBy: any[] = [];
            
            if (Array.isArray(asset.relatedAssets)) {
              // Flat array format - group by relationship type
              asset.relatedAssets.forEach((related: any) => {
                const relationshipType = related.relationshipType || 'uses';
                if (relationshipType === 'used_by') {
                  usedBy.push(related);
                } else {
                  uses.push(related);
                }
              });
            } else if (asset.relatedAssets && typeof asset.relatedAssets === 'object') {
              // Object format with usedBy and uses arrays
              uses = asset.relatedAssets.uses || [];
              usedBy = asset.relatedAssets.usedBy || [];
            }
            
            return {
              id: asset.id,
              name: asset.name,
              type: assetType,
              uses,
              usedBy,
            };
          })}
        />
      )}
    </>
  );
};