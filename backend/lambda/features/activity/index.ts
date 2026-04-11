import {
  refreshActivity,
  getActivityData,
  getActivitySummary,
  resolveRecipients,
  getUserInactiveAnalyses,
  getUserUnusedDatasets,
  getTimeline,
  getAssetTimeline,
} from './handlers/ActivityHandler';
import { type RouteHandler } from '../../api/types';

export const activityRoutes: RouteHandler[] = [
  // Timeline routes — registered BEFORE the /activity/{assetType}/{assetId}
  // catch-all regex so they take precedence during route matching.
  {
    path: '/activity/timeline',
    method: 'GET',
    handler: getTimeline,
  },
  {
    path: /^\/activity\/timeline\/(dashboard|analysis|dataset|datasource|folder|group|user)\/(.+)$/,
    method: 'GET',
    handler: getAssetTimeline,
  },
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
  getTimeline,
  getAssetTimeline,
};

// Export types
export type * from './types';

// Export service
export { ActivityService } from './services/ActivityService';
