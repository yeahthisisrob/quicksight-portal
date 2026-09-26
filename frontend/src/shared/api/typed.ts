/**
 * The portal's API as a typed client, generated from the contract: every
 * path, parameter and body is checked against `shared/generated/types.ts`
 * (openapi-fetch).
 *
 * Auth rides a middleware: the session's token on every request, and a 401
 * clears the session and sends the person to sign in.
 */
import type { paths } from '@shared/generated/types';
import createFetchClient, { type Middleware } from 'openapi-fetch';

import { config } from '@/shared/config';

/** The contract's paths already carry /api; the client's base is the origin part. */
const BASE_URL = config.API_URL.replace(/\/api\/?$/, '');

const auth: Middleware = {
  onRequest({ request }) {
    const token = localStorage.getItem('idToken');
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
  onResponse({ response, request }) {
    if (response.status === 401 && !/\/(auth|identity)\b/.test(new URL(request.url).pathname)) {
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login?error=session_expired';
      }
    }
    return response;
  },
};

export const client = createFetchClient<paths>({ baseUrl: BASE_URL });
client.use(auth);

/** An API failure, with the server's message when it sent one. */
export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The portal's envelope unwrapped: `{ success, data }` gives `data`; a
 * failure (HTTP error, or `success: false`) throws with the server's error
 * message, falling back to `fallback`.
 */
export function unwrap<T>(
  result: {
    data?: { success?: boolean; data?: T; error?: string };
    error?: unknown;
    response: Response;
  },
  fallback: string
): T {
  const body = result.data;
  if (result.error !== undefined || !body || body.success === false) {
    const message =
      (result.error as { error?: string; message?: string } | undefined)?.error ??
      (result.error as { message?: string } | undefined)?.message ??
      body?.error ??
      fallback;
    throw new ApiError(message, result.response.status);
  }
  return body.data as T;
}

/**
 * A queued bulk job's 202: `{ success, jobId, status, message }` at the top
 * level, no data envelope. Gives the body; a failure throws as `unwrap` does.
 */
export function accepted<T extends { success?: boolean }>(
  result: { data?: T; error?: unknown; response: Response },
  fallback: string
): T {
  if (result.error !== undefined || !result.data?.success) {
    const message = (result.error as { error?: string } | undefined)?.error ?? fallback;
    throw new ApiError(message, result.response.status);
  }
  return result.data;
}
