import { type RouteHandler } from './types';
import { activityRoutes } from '../features/activity';
import { assetManagementRoutes } from '../features/asset-management';
import { dataCatalogRoutes } from '../features/data-catalog';
import { dataExportRoutes } from '../features/data-export';
import { deploymentRoutes } from '../features/deployment';
import { organizationRoutes } from '../features/organization';
import { extractPathParams } from './utils/routeUtils';
import { scriptsRoutes } from '../features/scripts/routes';
import { jobRoutes } from '../shared/routes/jobRoutes';

export const featureRoutes: RouteHandler[] = [
  ...assetManagementRoutes,
  ...deploymentRoutes,
  ...dataExportRoutes,
  ...organizationRoutes,
  ...dataCatalogRoutes,
  ...activityRoutes,
  ...scriptsRoutes,
  ...jobRoutes, // Shared job management routes
];

/**
 * Finds a matching route and extracts path parameters
 */
export function findRoute(
  method: string,
  path: string
): { route: RouteHandler; params?: Record<string, string> } | undefined {
  for (const route of featureRoutes) {
    if (route.method !== method) {
      continue;
    }

    if (typeof route.path === 'string') {
      if (route.path === path) {
        return { route };
      }
    } else if (route.path instanceof RegExp) {
      // Check if path matches the regex
      if (route.path.test(path)) {
        // Extract parameters using our utility
        const params = extractPathParams(path, route.path);
        return { route, params };
      }
    }
  }

  return undefined;
}
