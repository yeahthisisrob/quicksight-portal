import type { RouteHandler } from '../../../api/types';
import { diffVersion, getVersion, listRecent, listVersions } from '../handlers/HistoryHandler';

const ASSET = /^\/history\/(dashboard|analysis|dataset)\/([^/]+)$/;
const VERSION = /^\/history\/(dashboard|analysis|dataset)\/([^/]+)\/([^/]+)$/;
const DIFF = /^\/history\/(dashboard|analysis|dataset)\/([^/]+)\/([^/]+)\/diff$/;

/** The router's generic parameter names do not know these routes; name the ids from the path. */
function withIds<T extends { path: string; pathParameters: any }>(event: T): T {
  const match = event.path.match(/\/history\/(dashboard|analysis|dataset)\/([^/]+)(?:\/([^/]+))?/);
  return {
    ...event,
    pathParameters: {
      ...(event.pathParameters ?? {}),
      assetType: match?.[1] ?? '',
      assetId: match?.[2] ?? '',
      ...(match?.[3] && match[3] !== 'diff' ? { versionId: match[3] } : {}),
    },
  };
}

export const historyRoutes: RouteHandler[] = [
  { method: 'GET', path: '/history', handler: listRecent },
  { method: 'GET', path: ASSET, handler: (event) => listVersions(withIds(event)) },
  { method: 'GET', path: DIFF, handler: (event) => diffVersion(withIds(event)) },
  { method: 'GET', path: VERSION, handler: (event) => getVersion(withIds(event)) },
];
