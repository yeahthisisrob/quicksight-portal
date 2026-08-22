import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

/**
 * Users API - handles group membership operations
 * Note: For listing users and groups, use assetsApi.getUsersPaginated() and assetsApi.getGroupsPaginated()
 *
 * TODO: the group-membership endpoints are not in api.openapi.yaml yet; the
 * result types below are hand-declared until the schema covers them.
 */

/** Result of a bulk group-membership mutation. Large batches return a jobId instead of immediate results. */
export interface GroupMembershipResult {
  jobId?: string;
  successful?: string[];
  failed?: Array<{ userName: string; error?: string }>;
}

export interface DeleteUserResult {
  success: boolean;
  message?: string;
}

export const usersApi = {

  // Add users to group
  async addUsersToGroup(groupName: string, userNames: string[]): Promise<GroupMembershipResult> {
    const response = await apiClient.post<ApiResponse<GroupMembershipResult>>(
      `/groups/${encodeURIComponent(groupName)}/members`,
      { userNames }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add users to group');
    }
    return response.data.data!;
  },

  // Remove users from group
  async removeUsersFromGroup(groupName: string, userNames: string[]): Promise<GroupMembershipResult> {
    const response = await apiClient.delete<ApiResponse<GroupMembershipResult>>(
      `/groups/${encodeURIComponent(groupName)}/members`,
      { data: { userNames } }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove users from group');
    }
    return response.data.data!;
  },

  // Delete a user (READER/READER_PRO only)
  async deleteUser(userName: string): Promise<DeleteUserResult> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      `/users/${encodeURIComponent(userName)}`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete user');
    }
    return { success: response.data.success, message: response.data.message };
  },

  // Refresh user activity data
  async refreshUserActivity(): Promise<unknown> {
    const response = await apiClient.post<ApiResponse<unknown>>(
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
