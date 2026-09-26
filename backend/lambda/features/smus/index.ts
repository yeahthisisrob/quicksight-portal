import type { RouteHandler } from '../../api/types';
import {
  createSmusDataset,
  getSmusDataSource,
  getSmusDatasetLinks,
  getSmusStatus,
  listSmusAssets,
  startSmusExport,
} from './handlers/SmusHandler';

export const smusRoutes: RouteHandler[] = [
  {
    path: '/smus/data-source',
    method: 'GET',
    handler: getSmusDataSource,
  },
  {
    path: '/smus/status',
    method: 'GET',
    handler: getSmusStatus,
  },
  {
    path: '/smus/export',
    method: 'POST',
    handler: startSmusExport,
  },
  {
    path: '/smus/dataset-links',
    method: 'POST',
    handler: getSmusDatasetLinks,
  },
  {
    path: '/smus/assets',
    method: 'GET',
    handler: listSmusAssets,
  },
  {
    path: /^\/smus\/assets\/([^/]+)\/dataset$/,
    method: 'POST',
    handler: createSmusDataset,
  },
];

// Export service
export { SmusService } from '../../shared/services/smus/SmusService';
// Export types
export type * from './types';
// Export handlers
export { createSmusDataset, getSmusDatasetLinks, getSmusStatus, listSmusAssets, startSmusExport };
