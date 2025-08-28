import { type RouteHandler } from '../../../api/types';
import { AssetHandler } from '../handlers/AssetHandler';
import { IngestionHandler } from '../handlers/IngestionHandler';

const handler = new AssetHandler();
const ingestionHandler = new IngestionHandler();

export const assetManagementRoutes: RouteHandler[] = [
  {
    method: 'GET',
    path: /^\/assets\/(dashboards|analyses|datasets|datasources|folders|groups|users)\/paginated$/,
    handler: (event) => handler.list(event),
  },

  {
    method: 'GET',
    path: '/assets/archived',
    handler: (event) => handler.listArchived(event),
  },

  {
    method: 'GET',
    path: /^\/assets\/archive\/(dashboards|analyses|datasets|datasources|folders|groups|users)\/([^/]+)\/metadata$/,
    handler: (event) => handler.getArchivedAssetMetadata(event),
  },

  {
    method: 'POST',
    path: '/assets/rebuild-index',
    handler: (event) => handler.rebuildIndex(event),
  },

  {
    method: 'POST',
    path: '/assets/clear-memory-cache',
    handler: (event) => handler.clearMemoryCache(event),
  },

  {
    method: 'GET',
    path: /^\/assets\/(dashboard|analysis|dataset|datasource|folder|user|group)\/([^/]+)\/cached$/,
    handler: (event) => handler.getExportedAsset(event),
  },

  {
    method: 'GET',
    path: /^\/assets\/(dashboard|analysis|dataset)\/([^/]+)\/views$/,
    handler: (event) => handler.getViews(event),
  },

  {
    method: 'POST',
    path: '/assets/refresh-views',
    handler: (event) => handler.refreshViewStats(event),
  },

  {
    method: 'POST',
    path: '/assets/bulk-delete',
    handler: (event) => handler.bulkDelete(event),
  },

  {
    method: 'POST',
    path: '/assets/bulk-delete/validate',
    handler: (event) => handler.validateBulkDelete(event),
  },

  {
    method: 'GET',
    path: '/ingestions',
    handler: (event) => ingestionHandler.list(event),
  },

  {
    method: 'GET',
    path: /^\/ingestions\/([^/]+)\/([^/]+)$/,
    handler: (event) => ingestionHandler.getDetails(event),
  },

  {
    method: 'DELETE',
    path: /^\/ingestions\/([^/]+)\/([^/]+)$/,
    handler: (event) => ingestionHandler.cancel(event),
  },
];
