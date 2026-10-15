import type { components, paths } from '@shared/generated/types';

import { accepted, client, unwrap } from '../typed';

export type AssetRef = components['schemas']['AssetRef'];
export type FolderPermission = components['schemas']['FolderPermission'];
export type FolderRole = FolderPermission['role'];
export type PrincipalType = FolderPermission['type'];

type MemberType = NonNullable<
  paths['/api/folders/{folderId}/members/{memberId}']['delete']['parameters']['query']
>['type'];

/**
 * A folder's members (the people and groups it is shared with). For listing
 * folders, use assetsApi.getFoldersPaginated().
 */
export const foldersApi = {
  /** A new folder, at the top or under a parent. */
  async create(input: { name: string; parentFolderId?: string }) {
    return unwrap(
      await client.POST('/api/folders', { body: input }),
      'The folder could not be created'
    );
  },

  /** Delete a folder; with force, its assets are taken out first (never deleted). */
  async remove(folderId: string, force = false) {
    return unwrap(
      await client.DELETE('/api/folders/{folderId}', {
        params: { path: { folderId }, query: force ? { force: true } : {} },
      }),
      'The folder could not be deleted'
    );
  },

  /** Who can see or work in the folder, live, each with a role. */
  async getPermissions(folderId: string): Promise<FolderPermission[]> {
    return unwrap(
      await client.GET('/api/folders/{folderId}/permissions', { params: { path: { folderId } } }),
      'The folder permissions could not be read'
    ).permissions;
  },

  /** Share the folder with a user or group at a role. */
  async addPrincipal(
    folderId: string,
    memberId: string,
    memberType: PrincipalType,
    role: FolderRole
  ) {
    return unwrap(
      await client.POST('/api/folders/{folderId}/members', {
        params: { path: { folderId } },
        body: { memberId, memberType, role },
      }),
      'The folder could not be shared'
    );
  },

  /** Take a user or group off the folder. */
  async removePrincipal(folderId: string, memberId: string, memberType: PrincipalType) {
    return unwrap(
      await client.DELETE('/api/folders/{folderId}/members/{memberId}', {
        params: { path: { folderId, memberId }, query: { type: memberType } },
      }),
      'The access could not be removed'
    );
  },

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
