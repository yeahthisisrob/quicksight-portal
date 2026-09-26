import type { components, paths } from '@shared/generated/types';

import { accepted, client, unwrap } from '../typed';

export type AssetRef = components['schemas']['AssetRef'];

type MemberType = NonNullable<
  paths['/api/folders/{folderId}/members/{memberId}']['delete']['parameters']['query']
>['type'];

/**
 * A folder's members (the people and groups it is shared with). For listing
 * folders, use assetsApi.getFoldersPaginated().
 */
export const foldersApi = {
  async getMembers(folderId: string) {
    return unwrap(
      await client.GET('/api/folders/{folderId}/members', { params: { path: { folderId } } }),
      'Failed to get folder members'
    );
  },

  async removeMember(folderId: string, memberId: string, memberType: MemberType) {
    return unwrap(
      await client.DELETE('/api/folders/{folderId}/members/{memberId}', {
        params: { path: { folderId, memberId }, query: { type: memberType } },
      }),
      'Failed to remove member'
    );
  },

  /** Add assets to a folder: queues a job and returns it. */
  async bulkAddAssets(folderId: string, assets: AssetRef[]) {
    return accepted(
      await client.POST('/api/folders/{folderId}/assets/bulk', {
        params: { path: { folderId } },
        body: { assets },
      }),
      'Failed to add assets to the folder'
    );
  },
};
