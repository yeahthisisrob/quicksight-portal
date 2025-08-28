import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

/**
 * Folders API - handles folder-specific operations and membership management
 * Note: For listing folders, use assetsApi.getFoldersPaginated()
 */
export const foldersApi = {

  // Get single folder
  async get(folderId: string): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(`/folders/${folderId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch folder');
    }
    return response.data.data!;
  },

  // Get folder metadata (temporarily return empty object - endpoint needs implementation)
  async getMetadata(_folderId: string): Promise<any> {
    // TODO: Implement metadata endpoint in assetsHandler
    return {};
  },

  // Update folder metadata (temporarily no-op - endpoint needs implementation)
  async updateMetadata(_folderId: string, metadata: any): Promise<any> {
    // TODO: Implement metadata endpoint in assetsHandler
    return metadata;
  },

  // Get folder tags
  async getTags(folderId: string): Promise<Array<{ key: string; value: string }>> {
    const response = await apiClient.get<ApiResponse<Array<{ key: string; value: string }>>>(
      `/folders/${folderId}/tags`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch tags');
    }
    return response.data.data || [];
  },

  // Update folder tags
  async updateTags(folderId: string, tags: Array<{ key: string; value: string }>): Promise<void> {
    const response = await apiClient.put<ApiResponse<any>>(
      `/folders/${folderId}/tags`,
      { tags }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update tags');
    }
  },

  // Remove folder tags
  async removeTags(folderId: string, tagKeys: string[]): Promise<void> {
    const response = await apiClient.delete<ApiResponse<any>>(
      `/folders/${folderId}/tags`,
      { data: { tagKeys } }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove tags');
    }
  },

  // Add member to folder (use direct endpoint)
  async addMember(folderId: string, member: { memberType: string; memberId: string; role?: string }): Promise<void> {
    const response = await apiClient.post<ApiResponse<any>>(
      `/folders/${folderId}/members`,
      member
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add member');
    }
  },

  // Get folder members
  async getMembers(folderId: string): Promise<any[]> {
    const response = await apiClient.get<ApiResponse<any[]>>(
      `/folders/${folderId}/members`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get folder members');
    }
    return response.data.data || [];
  },

  // Remove member from folder
  async removeMember(folderId: string, memberId: string, memberType: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<any>>(
      `/folders/${folderId}/members/${memberId}?type=${encodeURIComponent(memberType)}`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove member');
    }
  },
};