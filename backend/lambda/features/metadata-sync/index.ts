import type { RouteHandler } from '../../api/types';
import {
  getMetadataSyncStatus,
  resolveMetadataConflict,
  startMetadataSync,
} from './handlers/MetadataSyncHandler';

export const metadataSyncRoutes: RouteHandler[] = [
  {
    path: '/metadata-sync/status',
    method: 'GET',
    handler: getMetadataSyncStatus,
  },
  {
    path: '/metadata-sync/sync',
    method: 'POST',
    handler: startMetadataSync,
  },
  {
    path: '/metadata-sync/resolve',
    method: 'POST',
    handler: resolveMetadataConflict,
  },
];
