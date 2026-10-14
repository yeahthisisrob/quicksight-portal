import type { RouteHandler } from '../../api/types';
import {
  getSmusDatasetLinks,
  getSmusStatus,
  listSmusAssets,
  startSmusExport,
} from './handlers/SmusHandler';

export const smusRoutes: RouteHandler[] = [
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
];
// Export service

// Export types
// Export handlers
