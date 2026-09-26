import type { RouteHandler } from '../../api/types';
import {
  getActivityData,
  getActivitySummary,
  getAssetHealth,
  getAssetTimeline,
  getTimeline,
  getUserInactiveAnalyses,
  getUserUnusedDatasets,
  refreshActivity,
  resolveRecipients,
} from './handlers/ActivityHandler';

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
    path: /^\/activity\/(dashboard|analysis|dataset|user)\/(.+)$/,
    method: 'GET',
    handler: getActivityData,
  },
  {
    path: '/activity/health',
    method: 'GET',
    handler: getAssetHealth,
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
// Export service

// Export types
export type * from './types';
// Export handlers
