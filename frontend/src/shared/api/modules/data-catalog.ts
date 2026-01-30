import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

/**
 * Data Catalog API - handles field catalog and visual field mapping operations
 */
export const dataCatalogApi = {
  // Get full catalog (no pagination)
  async getCatalog(): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>('/data-catalog/full');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch data catalog');
    }
    return response.data.data;
  },

  // Get data catalog with pagination
  async getDataCatalog(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    viewMode?: 'all' | 'fields' | 'calculated';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    tagKey?: string;
    tagValue?: string;
    includeTags?: string; // JSON stringified array of {key, value}
    excludeTags?: string; // JSON stringified array of {key, value}
    assetIds?: string; // JSON stringified array of asset IDs
  }): Promise<any> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/data-catalog', { 
        params,
        timeout: 120000 // 2 minutes timeout for data catalog operations
      });
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch data catalog');
      }
      return response.data.data;
    } catch (error: any) {
      // Handle timeout and gateway errors
      if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
        throw new Error('The data catalog request timed out. Try reducing the page size or simplifying the sort operation.');
      }
      throw error;
    }
  },

  // Get available tags for filtering
  async getAvailableTags(): Promise<{ key: string; value: string; count: number }[]> {
    const response = await apiClient.get<ApiResponse<{ key: string; value: string; count: number }[]>>('/data-catalog/tags');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch available tags');
    }
    return response.data.data || [];
  },

  // Get available assets for filtering
  async getAvailableAssets(): Promise<{ id: string; name: string; type: string; fieldCount: number }[]> {
    const response = await apiClient.get<ApiResponse<{ id: string; name: string; type: string; fieldCount: number }[]>>('/data-catalog/assets');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch available assets');
    }
    return response.data.data || [];
  },

  // Force rebuild catalog
  async rebuildCatalog(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/data-catalog/rebuild');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to rebuild data catalog');
    }
    return response.data.data;
  },

  // Get visual field catalog
  async getVisualFieldCatalog(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/data-catalog/visual-fields', { 
        params,
        timeout: 120000 // 2 minutes timeout for data catalog operations
      });
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch visual field catalog');
      }
      return response.data.data;
    } catch (error: any) {
      // Handle timeout and gateway errors
      if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
        throw new Error('The visual field catalog request timed out. Try reducing the page size or simplifying the sort operation.');
      }
      throw error;
    }
  },

  // Force rebuild visual field catalog
  async rebuildVisualFieldCatalog(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/data-catalog/visual-fields/rebuild');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to rebuild visual field catalog');
    }
    return response.data.data;
  },

  // Get visual field metadata
  async getVisualFieldMetadata(visualFieldId: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/data-catalog/visual-field/${encodeURIComponent(visualFieldId)}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch visual field metadata');
    }
    return response.data.data;
  },

  // Update visual field metadata
  async updateVisualFieldMetadata(visualFieldId: string, metadata: any): Promise<any> {
    const response = await apiClient.put<ApiResponse<any>>(`/data-catalog/visual-field/${encodeURIComponent(visualFieldId)}`, metadata);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update visual field metadata');
    }
    return response.data.data;
  },
};