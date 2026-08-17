import { getSmusStatus, getSmusDatasetLinks } from './handlers/SmusHandler';
import { type RouteHandler } from '../../api/types';

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

// Export handlers
export { getSmusStatus, getSmusDatasetLinks };

// Export types
export type * from './types';

// Export service
export { SmusService } from './services/SmusService';
