import { client, unwrap } from '../typed';

/**
 * Groups API - handles group management operations
 * Note: For listing groups, use assetsApi.getGroupsPaginated()
 */
export const groupsApi = {
  async createGroup(groupName: string, description?: string) {
    return unwrap(
      await client.POST('/api/groups', { body: { groupName, description } }),
      'Failed to create group'
    );
  },

  async updateGroup(groupName: string, description: string) {
    return unwrap(
      await client.PUT('/api/groups/{groupName}', {
        params: { path: { groupName } },
        body: { description },
      }),
      'Failed to update group'
    );
  },

  async deleteGroup(groupName: string, reason?: string) {
    return unwrap(
      await client.DELETE('/api/groups/{groupName}', {
        params: { path: { groupName } },
        body: { reason },
      }),
      'Failed to delete group'
    );
  },

  /** Every asset a group can open: directly, or through a folder shared with it. */
  async getAssets(groupName: string) {
    return unwrap(
      await client.GET('/api/groups/{groupName}/assets', { params: { path: { groupName } } }),
      'Failed to fetch group assets'
    );
  },
};

export type GroupAsset = Awaited<ReturnType<typeof groupsApi.getAssets>>['assets'][number];
