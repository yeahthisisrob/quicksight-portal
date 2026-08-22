import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

import type { components } from '@shared/generated';

/**
 * Users API - handles group membership operations
 * Note: For listing users and groups, use assetsApi.getUsersPaginated() and assetsApi.getGroupsPaginated()
 */

/**
 * Membership mutations are ALWAYS queued bulk jobs: the endpoint responds
 * 202 with { success, jobId, ... } at the TOP LEVEL (no data envelope).
 * Callers must poll the jobId for completion.
 */
export type GroupMembershipJobResponse = components['schemas']['BulkJobAccepted'];

export interface DeleteUserResult {
  success: boolean;
  message?: string;
}

export const usersApi = {

  // Add users to group (queued job - poll the returned jobId)
  async addUsersToGroup(
    groupName: string,
    userNames: string[]
  ): Promise<GroupMembershipJobResponse> {
    const response = await apiClient.post<GroupMembershipJobResponse & { error?: string }>(
      `/groups/${encodeURIComponent(groupName)}/members`,
      { userNames }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add users to group');
    }
    return response.data;
  },

  // Remove users from group (queued job - poll the returned jobId)
  async removeUsersFromGroup(
    groupName: string,
    userNames: string[]
  ): Promise<GroupMembershipJobResponse> {
    const response = await apiClient.delete<GroupMembershipJobResponse & { error?: string }>(
      `/groups/${encodeURIComponent(groupName)}/members`,
      { data: { userNames } }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to remove users from group');
    }
    return response.data;
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
