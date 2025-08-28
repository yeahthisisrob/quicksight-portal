import { refreshActivity, getActivityData, getActivitySummary } from './handlers/ActivityHandler';
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
];

// Export handlers
export { refreshActivity, getActivityData, getActivitySummary };

// Export types
export type * from './types';

// Export service
export { ActivityService } from './services/ActivityService';
