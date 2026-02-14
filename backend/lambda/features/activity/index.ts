import {
  refreshActivity,
  getActivityData,
  getActivitySummary,
  resolveRecipients,
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
];

// Export handlers
export { refreshActivity, getActivityData, getActivitySummary, resolveRecipients };

// Export types
export type * from './types';

// Export service
export { ActivityService } from './services/ActivityService';
