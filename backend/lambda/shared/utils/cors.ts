import { appendFileSync } from 'node:fs';

/**
 * CORS and response utilities
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { responseErrors } from '../api/contract';
import { STATUS_CODES } from '../constants';
import { logger } from './logger';
import { currentErrorDetail } from './requestContext';

// Shared across all CORS branches. If-None-Match and Expose-Headers: ETag
// support conditional GETs from cross-origin local dev (deployed topology is
// same-origin behind CloudFront, where CORS does not apply).
const SHARED_CORS_HEADERS = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,If-None-Match,X-Amz-Date,X-Amz-Security-Token,X-Amz-Content-Sha256',
  'Access-Control-Expose-Headers': 'ETag',
} as const;

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
      ...SHARED_CORS_HEADERS,
    };
  }

  // Fallback: Allow CloudFront even if FRONTEND_URL is not set correctly
  if (frontendUrl === '' && origin.includes('.cloudfront.net')) {
    return {
      'Access-Control-Allow-Origin': origin,
      ...SHARED_CORS_HEADERS,
    };
  }

  // Default CORS headers with AWS SigV4 headers for production
  return {
    'Access-Control-Allow-Origin': frontendUrl || '*',
    ...SHARED_CORS_HEADERS,
  };
};

/**
 * Creates a response with CORS headers and Content-Type
 */
/** Drift found in `strict` mode, for the test setup to fail on (a throw would be caught by the handler). */
const drift: string[] = [];

/** Take (and clear) the drift strict mode recorded. */
export function takeContractDrift(): string[] {
  return drift.splice(0, drift.length);
}

/**
 * Every response is held to the served contract. `strict` (the tests)
 * records drift and the test setup fails on it; `warn` (the default) logs
 * it, so real traffic finds what tests miss; `report` appends it to a file;
 * `off` skips it. A string body (a spec, a guide) is not checked.
 */
function checkAgainstContract(event: APIGatewayProxyEvent, statusCode: number, body: unknown) {
  const mode = process.env.CONTRACT_RESPONSES ?? 'warn';
  if (mode === 'off' || typeof body === 'string' || !event?.path || !event.httpMethod) return;
  const problems = responseErrors(event.httpMethod, event.path, statusCode, body);
  if (problems.length === 0) return;
  const where = `${event.httpMethod} ${event.path} ${statusCode}`;
  if (mode === 'strict') {
    drift.push(`${where}:\n  - ${problems.join('\n  - ')}`);
    return;
  }
  if (mode === 'report' && process.env.CONTRACT_REPORT_FILE) {
    appendFileSync(process.env.CONTRACT_REPORT_FILE, `${JSON.stringify({ where, problems })}\n`);
    return;
  }
  logger.warn('Contract drift: a response does not fit the served contract', {
    where,
    problems,
  });
}

export function createResponse(
  event: APIGatewayProxyEvent,
  statusCode: number,
  body: any
): APIGatewayProxyResult {
  checkAgainstContract(event, statusCode, body);
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
  // A short message for people; the detail (what failed underneath, and the
  // ids to find it by) for whoever has to debug it.
  const detail = currentErrorDetail();
  return createResponse(event, statusCode, {
    success: false,
    error: message,
    ...(detail ? { detail } : {}),
  });
}

/**
 * A non-JSON body (a markdown guide, a spec) with the same CORS and cache
 * headers as every other response.
 */
export function textResponse(
  event: APIGatewayProxyEvent,
  body: string,
  contentType: string
): APIGatewayProxyResult {
  return {
    statusCode: STATUS_CODES.OK,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...corsHeaders(event),
    },
    body,
  };
}
