/**
 * Container for all data catalog dialogs
 */
import {
  AssetListDialog,
  MappedFieldsDialog,
  SemanticMappingDialog,
  SemanticTermDialog,
  UnifiedFieldDetailsDialog,
  UnmappedFieldsDialog,
} from '@/features/data-catalog';

import { ConfirmationDialog } from '@/shared/ui';

interface DialogsContainerProps {
  dialogState: any;
  closeDialog: (name: string) => void;
  closeConfirmDialog: () => void;
  catalogData: any;
  terms: any[];
  mappings: any[];
  unmappedFields: any[];
  visualFieldCatalog: any;
  viewMode: string;
  invalidateCatalogQueries: () => void;
  invalidateSemanticQueries: () => void;
}

export function DialogsContainer({
  dialogState,
  closeDialog,
  closeConfirmDialog,
  catalogData,
  terms,
  mappings,
  unmappedFields,
  visualFieldCatalog,
  viewMode,
  invalidateCatalogQueries,
  invalidateSemanticQueries,
}: DialogsContainerProps) {
  const calculatedFields = catalogData?.items?.filter((f: any) => f.isCalculated) || [];
  
  return (
    <>
      <UnifiedFieldDetailsDialog
        open={dialogState.detailsDialogOpen}
        onClose={() => closeDialog('detailsDialogOpen')}
        field={dialogState.selectedField}
        allCalculatedFields={calculatedFields}
        viewMode={viewMode as 'physical' | 'visual-fields' | 'calculated'}
      />
      
      <SemanticTermDialog
        open={dialogState.termDialogOpen}
        onClose={() => closeDialog('termDialogOpen')}
        term={dialogState.selectedTerm}
        onSave={() => invalidateSemanticQueries()}
      />
      
      <SemanticMappingDialog
        open={dialogState.mappingDialogOpen}
        onClose={() => closeDialog('mappingDialogOpen')}
        field={dialogState.selectedField}
        terms={terms || []}
        onSave={() => {
          invalidateCatalogQueries();
          invalidateSemanticQueries();
        }}
      />
      
      <UnmappedFieldsDialog
        open={dialogState.unmappedDialogOpen}
        onClose={() => closeDialog('unmappedDialogOpen')}
        unmappedFields={unmappedFields || []}
        onMapField={() => {
          // Handle field mapping
          invalidateCatalogQueries();
          invalidateSemanticQueries();
        }}
      />
      
      <AssetListDialog
        open={dialogState.assetListDialogOpen}
        onClose={() => closeDialog('assetListDialogOpen')}
        field={dialogState.selectedField}
        assetType={dialogState.selectedAssetType}
        assets={dialogState.selectedAssets || []}
      />
      
      <MappedFieldsDialog
        open={dialogState.mappedFieldsDialogOpen}
        onClose={() => closeDialog('mappedFieldsDialogOpen')}
        term={dialogState.mappedFieldsDialogData?.term}
        mappings={mappings || []}
        fields={catalogData?.items || []}
        visualFields={visualFieldCatalog?.fields || []}
      />
      
      <ConfirmationDialog
        open={dialogState.confirmDialog?.open || false}
        onClose={closeConfirmDialog}
        onConfirm={dialogState.confirmDialog?.onConfirm}
        title={dialogState.confirmDialog?.title}
        message={dialogState.confirmDialog?.message}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </>
  );
}