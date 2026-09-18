import type { RouteHandler } from '../../api/types';
import { getSmusDatasetLinks, getSmusStatus } from './handlers/SmusHandler';

export const smusRoutes: RouteHandler[] = [
  {
    path: '/smus/status',
    method: 'GET',
    handler: getSmusStatus,
  },
  {
    path: '/smus/dataset-links',
    method: 'POST',
    handler: getSmusDatasetLinks,
  },
];

// Export service
export { SmusService } from './services/SmusService';
// Export types
export type * from './types';
// Export handlers
export { getSmusDatasetLinks, getSmusStatus };
