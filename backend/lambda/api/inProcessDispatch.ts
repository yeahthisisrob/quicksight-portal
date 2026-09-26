/**
 * The portal's own API, called in-process as someone: the same router,
 * contract check and handlers an HTTP request gets, with the caller's
 * identity attached instead of a token. The Assistant and playbooks both
 * act through this, so they can do exactly what that person could.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';

import { type AuthContext, withInProcessAuth } from '../shared/auth';
import { apiHandler } from './apiHandler';

export interface InProcessRequest {
  method: string;
  path: string;
  body?: unknown;
}

export function inProcessDispatch(auth: AuthContext) {
  return async (req: InProcessRequest): Promise<{ status: number; body: string }> => {
    const url = new URL(req.path, 'http://portal.internal');
    const query = Object.fromEntries(url.searchParams.entries());
    const event = withInProcessAuth(
      {
        httpMethod: req.method,
        path: url.pathname,
        resource: url.pathname,
        headers: { 'Content-Type': 'application/json' },
        multiValueHeaders: {},
        queryStringParameters: Object.keys(query).length ? query : null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as APIGatewayProxyEvent['requestContext'],
        body: req.body === undefined ? null : JSON.stringify(req.body),
        isBase64Encoded: false,
      },
      auth
    );
    const response = await apiHandler(event);
    return { status: response.statusCode, body: response.body };
  };
}
