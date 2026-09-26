/**
 * API handler with authentication middleware and modular routing
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { requestErrors } from '../shared/api/contract';
import { getAuthContext, UnauthorizedError } from '../shared/auth';
import { STATUS_CODES } from '../shared/constants/httpStatusCodes';
import { settingsStore } from '../shared/services/settings/SettingsStore';
import { createResponse, errorResponse, successResponse } from '../shared/utils/cors';
import { logger } from '../shared/utils/logger';
import { findRoute } from './router';
import { applyHttpCaching } from './utils/httpCaching';

export const apiHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // ETag/304 decoration for successful GETs; everything else passes through
  return applyHttpCaching(event, await handleRequest(event));
};

const handleRequest = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(event, STATUS_CODES.OK, '');
  }

  try {
    const authContext = await getAuthContext(event);
    if (!authContext) {
      return errorResponse(event, STATUS_CODES.UNAUTHORIZED, 'Authentication required');
    }

    // Stored settings win over env vars for the rest of this request.
    await settingsStore.load();

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
      // Every body is checked against the contract before a handler sees
      // it, so handlers take the whole body rather than re-picking fields
      // (which is how fields went missing).
      const problems = contractProblems(event);
      if (problems.length > 0) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          `The request does not fit the API contract:\n${problems.map((p) => `- ${p}`).join('\n')}`
        );
      }
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
    // Auth failures thrown by handlers should surface as 401, not 500.
    if (error instanceof UnauthorizedError) {
      return errorResponse(event, STATUS_CODES.UNAUTHORIZED, 'Authentication required');
    }
    logger.error('API handler unhandled error', {
      path: event.path,
      method: event.httpMethod,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
};

/** Contract problems with a JSON body; none when there is no body or it is not JSON (the handler says so). */
function contractProblems(event: APIGatewayProxyEvent): string[] {
  if (!event.body || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.httpMethod)) {
    return [];
  }
  let body: unknown;
  try {
    body = JSON.parse(
      event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body
    );
  } catch {
    return [];
  }
  return requestErrors(event.httpMethod, event.path, body);
}
