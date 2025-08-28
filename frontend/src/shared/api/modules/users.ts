import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

/**
 * Users API - handles group membership operations
 * Note: For listing users and groups, use assetsApi.getUsersPaginated() and assetsApi.getGroupsPaginated()
 */
export const usersApi = {

  // Add users to group
  async addUsersToGroup(groupName: string, userNames: string[]): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>(
      `/groups/${encodeURIComponent(groupName)}/members`,
      { userNames }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add users to group');
    }
    return response.data.data;
  },

  // Remove users from group
  async removeUsersFromGroup(groupName: string, userNames: string[]): Promise<any> {
    const response = await apiClient.delete<ApiResponse<any>>(
      `/groups/${encodeURIComponent(groupName)}/members`,
      { data: { userNames } }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove users from group');
    }
    return response.data.data;
  },

  // Refresh user activity data
  async refreshUserActivity(): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>(
      '/users/refresh-activity',
      {},
      { timeout: 120000 } // 2 minutes for activity refresh
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to refresh user activity');
    }
    return response.data.data;
  },
};