/**
 * HTTP caching decorator for GET responses: strong ETags + conditional 304s.
 *
 * Applied once at the apiHandler choke point so individual handlers stay
 * caching-unaware. Only successful GET responses are touched — everything
 * else keeps the default no-store headers from createResponse.
 */
import { createHash } from 'crypto';

import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { STATUS_CODES } from '../../shared/constants/httpStatusCodes';

/**
 * Strong ETag from the exact response body bytes, in quoted form.
 */
export function computeStrongEtag(body: string): string {
  const hash = createHash('sha256').update(body).digest('base64');
  return `"${hash}"`;
}

/**
 * RFC 9110 If-None-Match evaluation (weak comparison): the header is a
 * comma-separated list of entity tags, possibly W/-prefixed, or "*".
 */
export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) {
    return false;
  }
  if (ifNoneMatch.trim() === '*') {
    return true;
  }
  const normalizedEtag = stripWeakPrefix(etag);
  return ifNoneMatch
    .split(',')
    .map((candidate) => stripWeakPrefix(candidate.trim()))
    .some((candidate) => candidate === normalizedEtag);
}

/**
 * Decorate a routed response with caching headers.
 *
 * GET 200 responses gain an ETag and `Cache-Control: private, no-cache`
 * (browser stores a copy but revalidates on every request — freshness is
 * identical to today, only bytes-on-wire change). A matching If-None-Match
 * turns the response into an empty-body 304. The body is always recomputed
 * under the requester's own authorization before the hash compare, so a 304
 * can never leak another user's payload.
 */
export function applyHttpCaching(
  event: APIGatewayProxyEvent,
  response: APIGatewayProxyResult
): APIGatewayProxyResult {
  if (event.httpMethod !== 'GET' || response.statusCode !== STATUS_CODES.OK) {
    return response;
  }

  const etag = computeStrongEtag(response.body);
  // Drop the no-store trio createResponse sets; replace with revalidation policy
  const cachingHeaders: Record<string, string | number | boolean> = {
    ...(response.headers || {}),
    'Cache-Control': 'private, no-cache',
    ETag: etag,
  };
  delete cachingHeaders.Pragma;
  delete cachingHeaders.Expires;

  // HTTP API v2 lowercases header names, but local dev (SAM REST API) may not
  const requestHeaders = event.headers || {};
  const ifNoneMatch = requestHeaders['if-none-match'] ?? requestHeaders['If-None-Match'];

  if (etagMatches(ifNoneMatch, etag)) {
    return {
      statusCode: STATUS_CODES.NOT_MODIFIED,
      headers: cachingHeaders,
      body: '',
    };
  }

  return { ...response, headers: cachingHeaders };
}

function stripWeakPrefix(tag: string): string {
  return tag.startsWith('W/') ? tag.slice(2) : tag;
}
