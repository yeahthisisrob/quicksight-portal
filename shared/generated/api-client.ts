/**
 * Type-safe API client generated from OpenAPI schema
 * Provides consistent API interface for both backend and frontend
 */

import { components, paths } from './types';

// Export all the types for easy import
export type AssetListItem = components['schemas']['AssetListItem'];
export type FolderListItem = components['schemas']['FolderListItem'];
export type FolderDetails = components['schemas']['FolderDetails'];
export type FolderMember = components['schemas']['FolderMember'];
export type DashboardListItem = components['schemas']['DashboardListItem'];
export type DatasetListItem = components['schemas']['DatasetListItem'];
export type UserListItem = components['schemas']['UserListItem'];
export type AssetLineage = components['schemas']['AssetLineage'];
export type LineageRelationship = components['schemas']['LineageRelationship'];
export type FieldInfo = components['schemas']['FieldInfo'];
export type Tag = components['schemas']['Tag'];
export type AssetType = components['schemas']['AssetType'];
export type AssetStatus = components['schemas']['AssetStatus'];
export type EnrichmentStatus = components['schemas']['EnrichmentStatus'];

// API Response types
export type GetAssetsResponse = paths['/api/assets']['get']['responses']['200']['content']['application/json'];
export type GetFoldersResponse = paths['/api/folders']['get']['responses']['200']['content']['application/json'];
export type GetFolderResponse = paths['/api/folders/{folderId}']['get']['responses']['200']['content']['application/json'];
export type GetFolderMembersResponse = paths['/api/folders/{folderId}/members']['get']['responses']['200']['content']['application/json'];
export type GetDashboardsResponse = paths['/api/dashboards']['get']['responses']['200']['content']['application/json'];
export type GetDatasetsResponse = paths['/api/datasets']['get']['responses']['200']['content']['application/json'];
export type GetUsersResponse = paths['/api/users']['get']['responses']['200']['content']['application/json'];
export type GetLineageResponse = paths['/api/lineage/{assetType}/{assetId}']['get']['responses']['200']['content']['application/json'];
export type GetFieldsResponse = paths['/api/fields']['get']['responses']['200']['content']['application/json'];

// Request parameter types
export type GetAssetsParams = paths['/api/assets']['get']['parameters']['query'];
export type GetLineageParams = paths['/api/lineage/{assetType}/{assetId}']['get']['parameters']['path'];
export type GetFieldsParams = paths['/api/fields']['get']['parameters']['query'];

/**
 * Abstract base API client
 * Implement this for different environments (backend vs frontend)
 */
export abstract class BaseApiClient {
  protected abstract baseUrl: string;
  
  protected abstract request<T>(
    method: string,
    path: string,
    params?: Record<string, any>,
    body?: any
  ): Promise<T>;

  // Asset endpoints
  async getAssets(params?: GetAssetsParams): Promise<GetAssetsResponse> {
    return this.request('GET', '/api/assets', params);
  }

  // Folder endpoints
  async getFolders(): Promise<GetFoldersResponse> {
    return this.request('GET', '/api/folders');
  }

  async getFolder(folderId: string): Promise<GetFolderResponse> {
    return this.request('GET', `/api/folders/${folderId}`);
  }

  async getFolderMembers(folderId: string): Promise<GetFolderMembersResponse> {
    return this.request('GET', `/api/folders/${folderId}/members`);
  }

  // Dashboard endpoints
  async getDashboards(): Promise<GetDashboardsResponse> {
    return this.request('GET', '/api/dashboards');
  }

  // Dataset endpoints
  async getDatasets(): Promise<GetDatasetsResponse> {
    return this.request('GET', '/api/datasets');
  }

  // User endpoints
  async getUsers(): Promise<GetUsersResponse> {
    return this.request('GET', '/api/users');
  }

  // Lineage endpoints
  async getLineage(assetType: AssetType, assetId: string): Promise<GetLineageResponse> {
    return this.request('GET', `/api/lineage/${assetType}/${assetId}`);
  }

  // Field endpoints
  async getFields(params?: GetFieldsParams): Promise<GetFieldsResponse> {
    return this.request('GET', '/api/fields', params);
  }

  // Export endpoint (for JSON viewer)
  async getExportData(assetType: AssetType, assetId: string): Promise<any> {
    return this.request('GET', `/api/export/${assetType}/${assetId}`);
  }
}

/**
 * Frontend API client (browser environment)
 */
export class FrontendApiClient extends BaseApiClient {
  protected baseUrl: string;

  constructor(baseUrl: string = '') {
    super();
    this.baseUrl = baseUrl;
  }

  protected async request<T>(
    method: string,
    path: string,
    params?: Record<string, any>,
    body?: any
  ): Promise<T> {
    // Use baseUrl or fallback to window.location.origin in browser only
    const baseOrigin = this.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const url = new URL(path, baseOrigin);
    
    if (params && method === 'GET') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body && { 'Content-Type': 'application/json' }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as T;
  }
}

/**
 * Backend API client (Lambda environment)
 * For internal service-to-service communication
 */
export class BackendApiClient extends BaseApiClient {
  protected baseUrl: string;

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:3000') {
    super();
    this.baseUrl = baseUrl;
  }

  protected async request<T>(
    _method: string,
    _path: string,
    _params?: Record<string, any>,
    _body?: any
  ): Promise<T> {
    // In backend, we typically call services directly rather than HTTP
    // This is a placeholder for when backend needs to call other services
    throw new Error('Backend API client should use direct service calls, not HTTP');
  }
}

// Factory function for creating the appropriate client
export function createApiClient(environment: 'frontend' | 'backend' = 'frontend', baseUrl?: string): BaseApiClient {
  switch (environment) {
    case 'frontend':
      return new FrontendApiClient(baseUrl);
    case 'backend':
      return new BackendApiClient(baseUrl);
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}