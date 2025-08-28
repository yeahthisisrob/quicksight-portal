// Bulk operation flow state management
export type BulkOperationType = 'add_to_folder' | 'bulk_tag' | 'bulk_permissions' | 'bulk_delete';

export type BulkOperationState = 
  | 'selecting_assets'
  | 'configuring_operation'
  | 'confirming'
  | 'processing'
  | 'complete'
  | 'error';

export interface BulkOperationContext {
  type?: BulkOperationType;
  state: BulkOperationState;
  selectedAssets: Array<{ id: string; name: string; type: string }>;
  configuration?: any;
  progress?: {
    total: number;
    completed: number;
    failed: number;
    errors: Array<{ assetId: string; message: string }>;
  };
}

export const initialBulkOperationContext: BulkOperationContext = {
  state: 'selecting_assets',
  selectedAssets: []
};