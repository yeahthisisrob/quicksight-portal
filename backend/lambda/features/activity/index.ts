import {
  refreshActivity,
  getActivityData,
  getActivitySummary,
  resolveRecipients,
  getUserInactiveAnalyses,
  getUserUnusedDatasets,
} from './handlers/ActivityHandler';
import { type RouteHandler } from '../../api/types';

export const activityRoutes: RouteHandler[] = [
  {
    path: '/activity/refresh',
    method: 'POST',
    handler: refreshActivity,
  },
  {
    path: /^\/activity\/(dashboard|analysis|user)\/(.+)$/,
    method: 'GET',
    handler: getActivityData,
  },
  {
    path: '/activity/summary',
    method: 'GET',
    handler: getActivitySummary,
  },
  {
    path: '/activity/recipients',
    method: 'POST',
    handler: resolveRecipients,
  },
  {
    path: '/activity/user-inactive-analyses',
    method: 'POST',
    handler: getUserInactiveAnalyses,
  },
  {
    path: '/activity/user-unused-datasets',
    method: 'POST',
    handler: getUserUnusedDatasets,
  },
];

// Export handlers
export {
  refreshActivity,
  getActivityData,
  getActivitySummary,
  resolveRecipients,
  getUserInactiveAnalyses,
  getUserUnusedDatasets,
};

// Export types
export type * from './types';

// Export service
export { ActivityService } from './services/ActivityService';
