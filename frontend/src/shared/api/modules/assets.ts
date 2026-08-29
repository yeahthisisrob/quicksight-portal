import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

import type { components } from '@shared/generated/types';

type Schemas = components['schemas'];

/** Params shared by every paginated list endpoint; extra filter params pass through */
export type PaginatedListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  dateRange?: string;
  sortBy?: string;
  sortOrder?: string;
  filters?: Record<string, any>;
  [key: string]: any;
};

type FilterCount = { value: string; count: number };

/** Response shape of a paginated list keyed by its collection name */
type PaginatedList<K extends string, TItem> = { [P in K]: TItem[] } & {
  pagination: Schemas['PaginationInfo'];
  fromCache?: boolean;
};

/**
 * One fetcher for all seven paginated asset lists - identical wire contract,
 * differing only in URL segment, collection key, and item type
 */
async function getPaginatedList<TResult>(
  segment: string,
  label: string,
  params?: PaginatedListParams
): Promise<TResult> {
  const queryParams: any = { ...params };
  if (params?.filters) {
    queryParams.filters = JSON.stringify(params.filters);
  }
  const response = await apiClient.get<ApiResponse<TResult>>(`/assets/${segment}/paginated`, {
    params: queryParams,
  });
  if (!response.data.success) {
    throw new Error(response.data.error || `Failed to fetch ${label}`);
  }
  return response.data.data!;
}

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

  // Rename an asset live in QuickSight (dashboard/analysis/dataset/folder)
  async renameAsset(assetType: string, assetId: string, name: string): Promise<{ name: string }> {
    const response = await apiClient.post<ApiResponse<{ name: string }>>(
      `/assets/${assetType}/${assetId}/rename`,
      { name }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to rename asset');
    }
    return response.data.data!;
  },

  // Rebuild index and catalog from existing exported data
  async rebuildIndex(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/assets/rebuild-index');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to rebuild index');
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
  getDatasetsPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'datasets', Schemas['DatasetListItem']> & {
      availableSourceTypes?: FilterCount[];
    }
    >('datasets', 'datasets', params);
  },

  // Get paginated dashboards with full info
  getDashboardsPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'dashboards', Schemas['DashboardListItem']>
    >('dashboards', 'dashboards', params);
  },

  // Get paginated analyses with full info
  getAnalysesPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'analyses', Schemas['AnalysisListItem']>
    >('analyses', 'analyses', params);
  },

  // Get paginated datasources with full info
  getDatasourcesPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'datasources', Schemas['DatasourceListItem']> & {
      availableSourceTypes?: FilterCount[];
    }
    >('datasources', 'datasources', params);
  },

  // Get paginated folders with full info
  getFoldersPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'folders', Schemas['FolderListItem']>
    >('folders', 'folders', params);
  },

  // Get paginated groups with full info
  getGroupsPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'groups', Schemas['GroupListItem']>
    >('groups', 'groups', params);
  },

  // Get paginated users with full info
  getUsersPaginated(params?: PaginatedListParams) {
    return getPaginatedList<
      PaginatedList<'users', Schemas['UserListItem']> & {
      availableRoles?: FilterCount[];
      availableGroups?: FilterCount[];
    }
    >('users', 'users', params);
  },

  // Get permission sources for an asset (how each user has access)
  async getPermissionSources(assetType: string, assetId: string): Promise<{
    permissions: components['schemas']['Permission'][];
    userAccessSources: components['schemas']['UserAccessInfo'][];
    groupAccessSources: components['schemas']['GroupAccessInfo'][];
  }> {
    const response = await apiClient.get<ApiResponse<{
      permissions: components['schemas']['Permission'][];
      userAccessSources: components['schemas']['UserAccessInfo'][];
      groupAccessSources: components['schemas']['GroupAccessInfo'][];
    }>>(`/assets/${assetType}/${assetId}/permission-sources`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch permission sources');
    }
    return response.data.data!;
  },

  // Bulk revoke direct permissions from an asset (queues a job)
  async bulkRevokePermissions(assetType: string, assetId: string, revocations: Array<{ principal: string; actions: string[] }>): Promise<{
    jobId: string;
    status: string;
    message: string;
    estimatedOperations: number;
  }> {
    const response = await apiClient.post<ApiResponse<any>>(
      `/assets/${assetType}/${assetId}/revoke-permissions`,
      { revocations }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to revoke permissions');
    }
    // jobId/status/message are at top level of response (not under data)
    return response.data as any;
  },

  // Get all assets a user has access to
  async getUserAssetAccess(userName: string, assetType?: string): Promise<components['schemas']['UserAssetAccessResponse']> {
    const params = assetType ? { assetType } : {};
    const response = await apiClient.get<ApiResponse<components['schemas']['UserAssetAccessResponse']>>(
      `/users/${encodeURIComponent(userName)}/asset-access`,
      { params }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch user asset access');
    }
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
    // Convert singular asset type to plural for API endpoint
    const pluralMap: Record<string, string> = {
      'dashboard': 'dashboards',
      'analysis': 'analyses',
      'dataset': 'datasets',
      'datasource': 'datasources',
      'folder': 'folders',
      'user': 'users',
      'group': 'groups',
    };
    const pluralType = pluralMap[assetType] || assetType;

    const queryParams: any = { ...params };
    if (params?.filters) {
      queryParams.filters = JSON.stringify(params.filters);
    }
    const response = await apiClient.get<ApiResponse<any>>(`/assets/${pluralType}/export`, {
      params: queryParams,
      timeout: 300000 // 5 minutes timeout for export
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to export assets');
    }
    // Return the whole data object which contains jobId, status, message
    return response.data;
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