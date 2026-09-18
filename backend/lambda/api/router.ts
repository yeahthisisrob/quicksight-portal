import { activityRoutes } from '../features/activity';
import { assetManagementRoutes } from '../features/asset-management';
import { authoringRoutes } from '../features/authoring';
import { dataCatalogRoutes } from '../features/data-catalog';
import { dataExportRoutes } from '../features/data-export';
import { deploymentRoutes } from '../features/deployment';
import { organizationRoutes } from '../features/organization';
import { scriptsRoutes } from '../features/scripts/routes';
import { smusRoutes } from '../features/smus';
import { jobRoutes } from '../shared/routes/jobRoutes';
import type { RouteHandler } from './types';
import { extractPathParams } from './utils/routeUtils';

export const featureRoutes: RouteHandler[] = [
  ...assetManagementRoutes,
  ...authoringRoutes,
  ...deploymentRoutes,
  ...dataExportRoutes,
  ...organizationRoutes,
  ...dataCatalogRoutes,
  ...activityRoutes,
  ...scriptsRoutes,
  ...smusRoutes,
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
