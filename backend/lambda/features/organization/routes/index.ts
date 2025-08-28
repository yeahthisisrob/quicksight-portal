import { type RouteHandler } from '../../../api/types';
import { FolderHandler } from '../handlers/FolderHandler';
import { GroupHandler } from '../handlers/GroupHandler';
import { IdentityHandler } from '../handlers/IdentityHandler';
import { TagHandler } from '../handlers/TagHandler';

const folderHandler = new FolderHandler();
const identityHandler = new IdentityHandler();
const tagHandler = new TagHandler();
const groupHandler = new GroupHandler();

export const organizationRoutes: RouteHandler[] = [
  {
    method: 'GET',
    path: /^\/folders\/([^/]+)$/,
    handler: (event) => folderHandler.get(event),
  },
  {
    method: 'GET',
    path: /^\/folders\/([^/]+)\/members$/,
    handler: (event) => folderHandler.getMembers(event),
  },
  {
    method: 'POST',
    path: /^\/folders\/([^/]+)\/members$/,
    handler: (event) => folderHandler.addMember(event),
  },
  {
    method: 'DELETE',
    path: /^\/folders\/([^/]+)\/members\/([^/]+)$/,
    handler: (event) => folderHandler.removeMember(event),
  },
  {
    method: 'POST',
    path: /^\/folders\/([^/]+)\/assets\/bulk$/,
    handler: (event) => folderHandler.bulkAddAssetsToFolder(event),
  },
  {
    method: 'DELETE',
    path: /^\/folders\/([^/]+)\/assets\/bulk$/,
    handler: (event) => folderHandler.bulkRemoveAssetsFromFolder(event),
  },

  {
    method: 'POST',
    path: '/groups',
    handler: (event) => groupHandler.createGroup(event),
  },
  {
    method: 'PUT',
    path: /^\/groups\/([^/]+)$/,
    handler: (event) => groupHandler.updateGroup(event),
  },
  {
    method: 'DELETE',
    path: /^\/groups\/([^/]+)$/,
    handler: (event) => groupHandler.deleteGroup(event),
  },
  {
    method: 'GET',
    path: /^\/groups\/([^/]+)\/assets$/,
    handler: (event) => groupHandler.getGroupAssets(event),
  },

  {
    method: 'POST',
    path: /^\/groups\/([^/]+)\/members$/,
    handler: (event) => identityHandler.addUsersToGroup(event),
  },
  {
    method: 'DELETE',
    path: /^\/groups\/([^/]+)\/members$/,
    handler: (event) => identityHandler.removeUsersFromGroup(event),
  },

  {
    method: 'GET',
    path: /^\/tags\/(dashboard|analysis|dataset|datasource|folder|user|group)\/([^/]+)$/,
    handler: (event) => tagHandler.getTags(event),
  },
  {
    method: 'PUT',
    path: /^\/tags\/(dashboard|analysis|dataset|datasource|folder|user|group)\/([^/]+)$/,
    handler: (event) => tagHandler.updateTags(event),
  },
  {
    method: 'POST',
    path: /^\/tags\/(dashboard|analysis|dataset|datasource|folder|user|group)\/([^/]+)$/,
    handler: (event) => tagHandler.addTags(event),
  },
  {
    method: 'DELETE',
    path: /^\/tags\/(dashboard|analysis|dataset|datasource|folder|user|group)\/([^/]+)$/,
    handler: (event) => tagHandler.removeTags(event),
  },

  {
    method: 'POST',
    path: '/tags/batch',
    handler: (event) => tagHandler.getBatchTags(event),
  },
  {
    method: 'POST',
    path: '/tags/bulk',
    handler: (event) => tagHandler.bulkUpdateTags(event),
  },

  {
    method: 'POST',
    path: '/tags/refresh',
    handler: (event) => tagHandler.refreshTags(event),
  },
];
