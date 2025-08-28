import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

/**
 * Scripts API - handles automation scripts like demo cleanup
 */
export const scriptsApi = {
  // Preview demo assets that would be deleted
  async previewDemoCleanup(): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>('/scripts/demo-cleanup/preview');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to preview demo cleanup');
    }
    return response.data.data;
  },

  // Execute demo cleanup
  async executeDemoCleanup(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/scripts/demo-cleanup/execute');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to execute demo cleanup');
    }
    return response.data.data;
  },
};