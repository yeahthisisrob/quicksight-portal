// AssetType includes: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'user' | 'group'
type AssetType = string;

export interface BulkAssetReference {
  type: AssetType;
  id: string;
  name?: string;
}

export interface BulkOperationJobResponse {
  jobId: string;
  status: string;
  message: string;
  estimatedOperations: number;
}

export interface BulkFolderOperationResult {
  success: boolean;
  jobId?: string;
  status?: string;
  message?: string;
  estimatedOperations?: number;
  data?: Array<{
    assetId: string;
    success: boolean;
    error?: string;
  }>;
}