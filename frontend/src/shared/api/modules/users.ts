import type { components } from '@shared/generated';

import { accepted, client } from '../typed';

/**
 * Users and group membership. For listing users and groups, use
 * assetsApi.getUsersPaginated() and assetsApi.getGroupsPaginated().
 *
 * Membership changes are always queued bulk jobs: the endpoint answers 202
 * with { success, jobId, ... } at the top level (no data envelope), and the
 * caller polls the jobId.
 */
export type GroupMembershipJobResponse = components['schemas']['BulkJobAccepted'];

export interface DeleteUserResult {
  success: boolean;
  message?: string;
}

export const usersApi = {
  async addUsersToGroup(
    groupName: string,
    userNames: string[]
  ): Promise<GroupMembershipJobResponse> {
    return accepted(
      await client.POST('/api/groups/{groupName}/members', {
        params: { path: { groupName } },
        body: { userNames },
      }),
      'Failed to add users to group'
    );
  },

  async removeUsersFromGroup(
    groupName: string,
    userNames: string[]
  ): Promise<GroupMembershipJobResponse> {
    return accepted(
      await client.DELETE('/api/groups/{groupName}/members', {
        params: { path: { groupName } },
        body: { userNames },
      }),
      'Failed to remove users from group'
    );
  },

  /** READER and READER_PRO users only. */
  async deleteUser(userName: string): Promise<DeleteUserResult> {
    return accepted(
      await client.DELETE('/api/users/{userName}', { params: { path: { userName } } }),
      'Failed to delete user'
    );
  },
};
