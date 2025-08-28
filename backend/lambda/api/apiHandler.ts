/**
 * API handler with authentication middleware and modular routing
 */
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { findRoute } from './router';
import { getAuthContext } from '../shared/auth';
import { STATUS_CODES } from '../shared/constants/httpStatusCodes';
import { createResponse, successResponse, errorResponse } from '../shared/utils/cors';
import { logger } from '../shared/utils/logger';

export const apiHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(event, STATUS_CODES.OK, '');
  }

  try {
    const authContext = getAuthContext(event);
    if (!authContext) {
      return errorResponse(event, STATUS_CODES.UNAUTHORIZED, 'Authentication required');
    }

    // Route to appropriate handler
    const path = event.path.replace('/api', '');
    const method = event.httpMethod;

    logger.debug('API request', {
      method,
      path,
      requestId: event.requestContext?.requestId,
    });

    // Check feature-based routes
    const routeMatch = findRoute(method, path);
    if (routeMatch) {
      // Add extracted path parameters to event
      const eventWithParams = {
        ...event,
        pathParameters: {
          ...(event.pathParameters || {}),
          ...(routeMatch.params || {}),
        },
      };
      return await routeMatch.route.handler(eventWithParams);
    }

    // Root API endpoint
    if (path === '' || path === '/') {
      return successResponse(event, {
        message: 'QuickSight Assets Portal API',
        version: '2.0',
        architecture: 'VSA (View-Service-Adapter)',
        features: {
          'asset-management': {
            description: 'Asset CRUD, tags, permissions, lineage',
            routes: ['/api/assets/*', '/api/tags/*'],
          },
          deployment: {
            description: 'Asset deployment, restoration, and migration',
            routes: ['/api/deployments/*'],
          },
          'data-catalog': {
            description: 'Field catalog, metadata, semantic mappings',
            routes: ['/api/data-catalog/*', '/api/semantic/*'],
          },
          'data-export': {
            description: 'Asset export and synchronization',
            routes: ['/api/assets/export/*'],
          },
          'workspace-organization': {
            description: 'Folders and bulk operations',
            routes: ['/api/assets/folders/*'],
          },
          'identity-management': {
            description: 'Users and groups',
            routes: ['/api/users/*', '/api/groups/*', '/api/identity'],
          },
          settings: {
            description: 'Application settings',
            routes: ['/api/settings/*'],
          },
        },
        note: 'All routes are handled by their respective features using VSA pattern',
      });
    }

    // Not found
    return errorResponse(event, STATUS_CODES.NOT_FOUND, `Route not found: ${method} ${path}`);
  } catch (error) {
    logger.error('API handler error:', error);
    return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
};
