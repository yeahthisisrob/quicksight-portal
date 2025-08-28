import { type APIGatewayProxyEvent, type APIGatewayProxyResult, type Context } from 'aws-lambda';

import { apiHandler } from './api/apiHandler';
import { STATUS_CODES } from './shared/constants';
import { successResponse, errorResponse } from './shared/utils/cors';
import { logger } from './shared/utils/logger';

// Warm start optimization - keep track of initialization
let isWarm = false;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Allow Lambda to continue running after response is sent
  // This is crucial for fire-and-forget export operations
  context.callbackWaitsForEmptyEventLoop = false;

  // Strip stage name from path in production
  let path = event.path;
  if (event.requestContext?.stage && path.startsWith(`/${event.requestContext.stage}`)) {
    path = path.substring(event.requestContext.stage.length + 1) || '/';
  }

  const modifiedEvent = {
    ...event,
    path,
    lambdaContext: context, // Pass context for export handler
  };

  // Mark as warm after first execution
  if (!isWarm) {
    isWarm = true;
  }

  try {
    // Route to appropriate handler
    if (path.startsWith('/api')) {
      return await apiHandler(modifiedEvent);
    }

    // Health check endpoint
    if (path === '/health') {
      return successResponse(event, {
        status: 'healthy',
        isWarm,
        timestamp: new Date().toISOString(),
      });
    }

    // Keep-warm endpoint for scheduled pings
    if (path === '/keep-warm') {
      return successResponse(event, {
        status: 'warm',
        isWarm,
        timestamp: new Date().toISOString(),
      });
    }

    // 404 for unmatched routes
    return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Not found');
  } catch (error) {
    logger.error('Handler error', { error });
    return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Internal server error');
  }
};
