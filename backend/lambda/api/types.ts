import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * Interface for feature-based route handlers
 */
export interface RouteHandler {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string | RegExp;
  handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
}
