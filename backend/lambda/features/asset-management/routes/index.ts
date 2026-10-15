import type { RouteHandler } from '../../../api/types';
import { AssetHandler } from '../handlers/AssetHandler';
import { DatasetRefreshHandler } from '../handlers/DatasetRefreshHandler';
import { IngestionHandler } from '../handlers/IngestionHandler';

const handler = new AssetHandler();
const ingestionHandler = new IngestionHandler();
const refreshHandler = new DatasetRefreshHandler();

/** The router's generic names do not know these routes; name the ids from the path. */
function withScheduleIds<T extends { path: string; pathParameters: any }>(event: T): T {
  const match = event.path.match(/\/assets\/dataset\/([^/]+)\/refresh-schedules(?:\/([^/]+))?/);
  return {
    ...event,
    pathParameters: {
      ...(event.pathParameters ?? {}),
      assetId: match?.[1] ?? '',
      ...(match?.[2] ? { scheduleId: match[2] } : {}),
    },
  };
}

export const assetManagementRoutes: RouteHandler[] = [
  {
    method: 'GET',
    path: /^\/assets\/(dashboards|analyses|datasets|datasources|folders|groups|users|themes)\/paginated$/,
    handler: (event) => handler.list(event),
  },

  {
    method: 'GET',
    path: /^\/assets\/(dashboards|analyses|datasets|datasources|folders|groups|users|themes)\/export$/,
    handler: (event) => handler.exportAssets(event),
  },

  {
    method: 'GET',
    path: '/assets/archived',
    handler: (event) => handler.listArchived(event),
  },

  {
    method: 'GET',
    // The contract names the singular type (dashboard); the plural is still accepted.
    path: /^\/assets\/archive\/(dashboard|analysis|dataset|datasource|folder|user|group|dashboards|analyses|datasets|datasources|folders|groups|users)\/([^/]+)\/metadata$/,
    handler: (event) => handler.getArchivedAssetMetadata(event),
  },

  {
    method: 'POST',
    path: /^\/assets\/(dataset|datasource)\/([^/]+)\/restore\/preview$/,
    handler: (event) => handler.previewRestore(event),
  },

  {
    method: 'POST',
    path: /^\/assets\/(dataset|datasource)\/([^/]+)\/restore$/,
    handler: (event) => handler.restoreSource(event),
  },

  {
    method: 'DELETE',
    path: /^\/assets\/(dashboard|analysis|dataset|datasource|theme)\/([^/]+)$/,
    handler: (event) => handler.deleteAsset(event),
  },

  {
    method: 'GET',
    path: /^\/assets\/(dashboard|analysis|dataset|datasource|folder|user|group|theme)\/([^/]+)\/cached$/,
    handler: (event) => handler.getExportedAsset(event),
  },

  {
    method: 'GET',
    path: /^\/assets\/(dashboard|analysis|dataset|datasource|folder)\/([^/]+)\/permission-sources$/,
    handler: (event) => handler.getPermissionSources(event),
  },

  {
    method: 'POST',
    path: /^\/assets\/(dashboard|analysis|dataset|datasource|folder)\/([^/]+)\/revoke-permissions$/,
    handler: (event) => handler.bulkRevokePermissions(event),
  },

  {
    method: 'POST',
    path: /^\/assets\/(dashboard|analysis|dataset|datasource|folder)\/([^/]+)\/grant-permissions$/,
    handler: (event) => handler.bulkGrantPermissions(event),
  },

  {
    method: 'POST',
    path: /^\/assets\/(dashboard|analysis|dataset|folder)\/([^/]+)\/rename$/,
    handler: (event) => handler.renameAsset(event),
  },
  {
    method: 'GET',
    path: /^\/assets\/(dataset)\/([^/]+)\/source$/,
    handler: (event) => handler.getDatasetSource(event),
  },
  {
    method: 'PUT',
    path: /^\/assets\/(dataset)\/([^/]+)\/source$/,
    handler: (event) => handler.updateDatasetSource(event),
  },
  {
    method: 'GET',
    path: /^\/assets\/(dataset)\/([^/]+)\/duplicates$/,
    handler: (event) => handler.getDatasetDuplicates(event),
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
    method: 'POST',
    path: /^\/ingestions\/([^/]+)$/,
    handler: (event) =>
      refreshHandler.refreshNow({
        ...event,
        pathParameters: {
          ...(event.pathParameters ?? {}),
          datasetId: event.path.match(/\/ingestions\/([^/]+)$/)?.[1] ?? '',
        },
      }),
  },
  {
    method: 'GET',
    path: /^\/assets\/dataset\/([^/]+)\/refresh-schedules$/,
    handler: (event) => refreshHandler.listSchedules(withScheduleIds(event)),
  },
  {
    method: 'POST',
    path: /^\/assets\/dataset\/([^/]+)\/refresh-schedules$/,
    handler: (event) => refreshHandler.createSchedule(withScheduleIds(event)),
  },
  {
    method: 'PUT',
    path: /^\/assets\/dataset\/([^/]+)\/refresh-schedules\/([^/]+)$/,
    handler: (event) => refreshHandler.updateSchedule(withScheduleIds(event)),
  },
  {
    method: 'DELETE',
    path: /^\/assets\/dataset\/([^/]+)\/refresh-schedules\/([^/]+)$/,
    handler: (event) => refreshHandler.deleteSchedule(withScheduleIds(event)),
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
