/**
 * The API describing itself, so a caller with only a key and the portal's
 * URL has everything: the contract every endpoint is validated against,
 * and the guide that says which calls to make in which order. Both are
 * bundled at build time from the same files the repo keeps them in.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import guide from '../../../../../docs/api-guide.md?raw';
import spec from '../../../../../shared/generated/openapi.json';
import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { errorResponse, successResponse, textResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

/** The portal's own origin, so the served spec's `servers` points at itself. */
export function requestOrigin(event: APIGatewayProxyEvent): string | null {
  const headers = event.headers ?? {};
  const host = headers.host ?? headers.Host;
  if (!host) {
    return null;
  }
  const proto = headers['x-forwarded-proto'] ?? headers['X-Forwarded-Proto'] ?? 'https';
  return `${proto}://${host}`;
}

/** GET /api-docs/openapi - the contract as JSON, servers set to this portal. */
export async function getOpenApi(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    const origin = requestOrigin(event);
    const served = origin
      ? { ...spec, servers: [{ url: origin, description: 'This portal' }] }
      : spec;
    return successResponse(event, served);
  } catch (error: any) {
    logger.error('OpenAPI could not be served', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
      error?.message || 'Could not serve the contract'
    );
  }
}

/** GET /api-docs/guide - the API guide as markdown. */
export async function getGuide(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);
    return textResponse(event, guide, 'text/markdown; charset=utf-8');
  } catch (error: any) {
    logger.error('Guide could not be served', { error });
    return errorResponse(
      event,
      error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
      error?.message || 'Could not serve the guide'
    );
  }
}
