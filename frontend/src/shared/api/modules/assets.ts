import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

import type { components } from '@shared/generated/types';

/**
 * Assets API - handles all QuickSight asset types (dashboards, analyses, datasets, datasources)
 */
export const assetsApi = {
  // Get export summary
  async getExportSummary(): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>('/export/summary');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch export summary');
    }
    return response.data.data;
  },

  // Export all assets
  async exportAll(forceRefresh = false, rebuildIndex = false): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/export', { forceRefresh, rebuildIndex });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to export assets');
    }
    return response.data.data;
  },

  // Rebuild index and catalog from existing exported data
  async rebuildIndex(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/assets/rebuild-index');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to rebuild index');
    }
    return response.data.data;
  },

  // Clear memory cache
  async clearMemoryCache(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/assets/clear-memory-cache');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to clear memory cache');
    }
    return response.data.data;
  },

  async updateAssetTags(assetType: string, assetId: string, tags: Array<{ Key: string; Value: string }>): Promise<any> {
    const response = await apiClient.put<ApiResponse<any>>(`/tags/${assetType.toLowerCase()}/${assetId}`, { tags });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update tags');
    }
    return response.data.data;
  },

  // Bulk update asset tags
  async bulkUpdateAssetTags(assetType: string, assetIds: string[], operation: 'add' | 'remove' | 'update', tags?: Array<{ key: string; value: string }>, tagKeys?: string[]): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/tags/bulk', { 
      assetType: assetType.toLowerCase(),
      assetIds,
      operation,
      tags,
      tagKeys
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to bulk update tags');
    }
    return response.data.data;
  },


  // Get paginated datasets with full info
  async getDatasetsPaginated(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  }): Promise<{ 
    datasets: components['schemas']['DatasetListItem'][];
    pagination: components['schemas']['PaginationInfo'];
    fromCache?: boolean;
  }> {
    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<{
      datasets: components['schemas']['DatasetListItem'][];
      pagination: components['schemas']['PaginationInfo'];
      fromCache?: boolean;
    }>>('/assets/datasets/paginated', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch datasets');
    }
    return response.data.data!;
  },

  // Get paginated dashboards with full info
  async getDashboardsPaginated(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  }): Promise<{ 
    dashboards: components['schemas']['DashboardListItem'][];
    pagination: components['schemas']['PaginationInfo'];
    fromCache?: boolean;
  }> {
    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<{
      dashboards: components['schemas']['DashboardListItem'][];
      pagination: components['schemas']['PaginationInfo'];
      fromCache?: boolean;
    }>>('/assets/dashboards/paginated', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch dashboards');
    }
    return response.data.data!;
  },

  // Get paginated analyses with full info
  async getAnalysesPaginated(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  }): Promise<{ 
    analyses: components['schemas']['AnalysisListItem'][];
    pagination: components['schemas']['PaginationInfo'];
    fromCache?: boolean;
  }> {
    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<{
      analyses: components['schemas']['AnalysisListItem'][];
      pagination: components['schemas']['PaginationInfo'];
      fromCache?: boolean;
    }>>('/assets/analyses/paginated', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch analyses');
    }
    return response.data.data!;
  },

  // Get paginated datasources with full info
  async getDatasourcesPaginated(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  }): Promise<{ 
    datasources: components['schemas']['DatasourceListItem'][];
    pagination: components['schemas']['PaginationInfo'];
    fromCache?: boolean;
  }> {
    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<{
      datasources: components['schemas']['DatasourceListItem'][];
      pagination: components['schemas']['PaginationInfo'];
      fromCache?: boolean;
    }>>('/assets/datasources/paginated', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch datasources');
    }
    return response.data.data!;
  },

  // Get paginated folders with full info
  async getFoldersPaginated(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  }): Promise<{ 
    folders: components['schemas']['FolderListItem'][];
    pagination: components['schemas']['PaginationInfo'];
    fromCache?: boolean;
  }> {
    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<{
      folders: components['schemas']['FolderListItem'][];
      pagination: components['schemas']['PaginationInfo'];
      fromCache?: boolean;
    }>>('/assets/folders/paginated', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch folders');
    }
    return response.data.data!;
  },

  // Get paginated groups with full info
  async getGroupsPaginated(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  }): Promise<{ 
    groups: components['schemas']['GroupListItem'][];
    pagination: components['schemas']['PaginationInfo'];
    fromCache?: boolean;
  }> {
    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<{
      groups: components['schemas']['GroupListItem'][];
      pagination: components['schemas']['PaginationInfo'];
      fromCache?: boolean;
    }>>('/assets/groups/paginated', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch groups');
    }
    return response.data.data!;
  },

  // Get paginated users with full info
  async getUsersPaginated(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  }): Promise<{ 
    users: components['schemas']['UserListItem'][];
    pagination: components['schemas']['PaginationInfo'];
    fromCache?: boolean;
  }> {
    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<{
      users: components['schemas']['UserListItem'][];
      pagination: components['schemas']['PaginationInfo'];
      fromCache?: boolean;
    }>>('/assets/users/paginated', { params: queryParams });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch users');
    }
    // The backend returns { users: [...], pagination: {...}, fromCache: true }
    return response.data.data!;
  },

  // Get specific asset
  async getAsset(assetType: string, assetId: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/assets/${assetType}/${assetId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch asset');
    }
    return response.data.data;
  },

  // Get cached/S3 asset data (for JSON viewer)
  async getCachedAsset(assetType: string, assetId: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/assets/${assetType}/${assetId}/cached`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch cached asset');
    }
    return response.data.data;
  },

  // Refresh tags for multiple assets
  async refreshAssetTags(assetType: string, assetIds: string[]): Promise<{
    successful: number;
    failed: number;
    total: number;
  }> {
    const response = await apiClient.post<ApiResponse<any>>('/tags/refresh', {
      assetType,
      assetIds,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to refresh tags');
    }
    return response.data.data;
  },

  // Parse asset to extract fields and calculated fields
  async parseAsset(assetType: string, assetId: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/assets/${assetType}/${assetId}/parse`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to parse asset');
    }
    return response.data.data;
  },

  // Get live tags for multiple assets
  async getBatchTags(assets: Array<{ type: string; id: string }>): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/tags/batch', { assets });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch batch tags');
    }
    return response.data.data;
  },

  // Refresh dashboard view statistics (legacy - redirects to activity API)
  async refreshViewStats(params?: {
    dashboardIds?: string[];
    days?: number;
  }): Promise<any> {
    // Import dynamically to avoid circular dependency
    const { activityApi } = await import('./activity');
    return activityApi.refreshActivity({ assetTypes: ['dashboard'], days: params?.days || 90 });
  },

  // Export assets to CSV
  async exportAssets(assetType: string, params?: {
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: string;
    filters?: Record<string, any>;
  }): Promise<any> {
    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<any>>(`/assets/${assetType}/export`, {
      params: queryParams,
      timeout: 300000 // 5 minutes timeout for export
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to export assets');
    }
    return response.data.data;
  },

  // Get archived assets with pagination
  async getArchivedAssetsPaginated(params?: {
    type?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    dateRange?: string;
  }): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>('/assets/archived', { params });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch archived assets');
    }
    return response.data.data;
  },

  // Bulk delete assets
  async bulkDelete(assets: Array<{ type: string; id: string }>, reason: string): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/assets/bulk-delete', { 
      assets, 
      reason 
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete assets');
    }
    return response.data.data;
  },

  // Validate bulk delete (check dependencies)
  async validateBulkDelete(assets: Array<{ type: string; id: string }>): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/assets/bulk-delete/validate', { 
      assets 
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to validate deletion');
    }
    return response.data.data;
  },

  // Get archived asset metadata
  async getArchivedAssetMetadata(assetType: string, assetId: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/assets/archive/${assetType}/${assetId}/metadata`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch archived asset metadata');
    }
    return response.data.data;
  },
};