import { api } from '@/shared/api';

export interface BulkDeleteAsset {
  type: string;
  id: string;
}

export interface BulkDeleteRequest {
  assets: BulkDeleteAsset[];
  reason: string;
}

export interface BulkDeleteValidationResponse {
  canDelete: boolean;
  warnings: string[];
  errors: string[];
}

export interface BulkDeleteResponse {
  success: boolean;
  data: {
    deleted: {
      total: number;
      byType: Record<string, number>;
    };
    archived: {
      total: number;
      byType: Record<string, number>;
    };
    errors: Array<{
      assetType: string;
      assetId: string;
      error: string;
    }>;
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export const bulkDeleteApi = {
  validateBulkDelete: async (assets: BulkDeleteAsset[]): Promise<BulkDeleteValidationResponse> => {
    const response = await api.post('/assets/bulk-delete/validate', { assets });
    return response.data.data;
  },

  bulkDeleteAssets: async (request: BulkDeleteRequest): Promise<BulkDeleteResponse> => {
    const response = await api.post('/assets/bulk-delete', request);
    return response.data;
  },
};