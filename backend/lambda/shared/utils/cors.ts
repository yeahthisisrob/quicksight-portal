/**
 * CORS and response utilities
 */
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { STATUS_CODES } from '../constants';

const corsHeaders = (event: APIGatewayProxyEvent): Record<string, string> => {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const frontendUrl = process.env.FRONTEND_URL || '';

  // Allow frontend domain or CloudFront
  if (
    origin === frontendUrl ||
    origin.includes('.cloudfront.net') ||
    origin.includes('localhost')
  ) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Amz-Date,X-Amz-Security-Token,X-Amz-Content-Sha256',
    };
  }

  // Fallback: Allow CloudFront even if FRONTEND_URL is not set correctly
  if (frontendUrl === '' && origin.includes('.cloudfront.net')) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Amz-Date,X-Amz-Security-Token,X-Amz-Content-Sha256',
    };
  }

  // Default CORS headers with AWS SigV4 headers for production
  return {
    'Access-Control-Allow-Origin': frontendUrl || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type,Authorization,X-Amz-Date,X-Amz-Security-Token,X-Amz-Content-Sha256',
  };
};

/**
 * Creates a response with CORS headers and Content-Type
 */
export function createResponse(
  event: APIGatewayProxyEvent,
  statusCode: number,
  body: any
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...corsHeaders(event),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/**
 * Creates a success response (200)
 */
export function successResponse(event: APIGatewayProxyEvent, data: any): APIGatewayProxyResult {
  return createResponse(event, STATUS_CODES.OK, data);
}

/**
 * Creates an error response
 */
export function errorResponse(
  event: APIGatewayProxyEvent,
  statusCode: number,
  message: string
): APIGatewayProxyResult {
  return createResponse(event, statusCode, { success: false, error: message });
}
