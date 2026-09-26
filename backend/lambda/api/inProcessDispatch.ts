/**
 * The portal's own API, called in-process as someone: the same router,
 * contract check and handlers an HTTP request gets, with the caller's
 * identity attached instead of a token. The Assistant and playbooks both
 * act through this, so they can do exactly what that person could.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';

import { type AuthContext, withInProcessAuth } from '../shared/auth';
import { STATUS_CODES, TIME_UNITS } from '../shared/constants';
import { apiKeyStore } from '../shared/services/auth/ApiKeyStore';
import { apiHandler } from './apiHandler';

/** How long a key's standing is trusted before it is looked up again. */
const KEY_CHECK_TTL_MS = TIME_UNITS.MINUTE;
const keyChecks = new Map<string, { valid: boolean; at: number }>();

/**
 * A job acts as whoever started it for as long as it runs; an API key can
 * be revoked meanwhile. Look again every minute, and stop acting as it once
 * it is gone. A failed lookup keeps the last answer rather than halting work.
 */
async function keyStillValid(id: string): Promise<boolean> {
  const known = keyChecks.get(id);
  if (known && Date.now() - known.at < KEY_CHECK_TTL_MS) return known.valid;
  try {
    const valid = await apiKeyStore.exists(id);
    keyChecks.set(id, { valid, at: Date.now() });
    return valid;
  } catch {
    return known?.valid ?? true;
  }
}

export interface InProcessRequest {
  method: string;
  path: string;
  body?: unknown;
}

export function inProcessDispatch(auth: AuthContext) {
  return async (req: InProcessRequest): Promise<{ status: number; body: string }> => {
    if (auth.apiKey && !(await keyStillValid(auth.apiKey.id))) {
      return {
        status: STATUS_CODES.UNAUTHORIZED,
        body: JSON.stringify({
          success: false,
          error: `The API key "${auth.apiKey.label}" that started this was revoked`,
        }),
      };
    }
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
