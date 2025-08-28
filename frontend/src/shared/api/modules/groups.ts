import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

/**
 * Groups API - handles group management operations
 * Note: For listing groups, use assetsApi.getGroupsPaginated()
 */
export const groupsApi = {
  // Create a new group
  async createGroup(groupName: string, description?: string): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>(
      '/groups',
      { groupName, description }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create group');
    }
    return response.data.data;
  },

  // Update group description
  async updateGroup(groupName: string, description: string): Promise<any> {
    const response = await apiClient.put<ApiResponse<any>>(
      `/groups/${encodeURIComponent(groupName)}`,
      { description }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update group');
    }
    return response.data.data;
  },

  // Delete a group
  async deleteGroup(groupName: string, reason?: string): Promise<any> {
    const response = await apiClient.delete<ApiResponse<any>>(
      `/groups/${encodeURIComponent(groupName)}`,
      { data: { reason } }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete group');
    }
    return response.data.data;
  },
};