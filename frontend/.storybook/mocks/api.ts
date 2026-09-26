import type { Middleware } from 'openapi-fetch';

import { client } from '../../src/shared/api/typed';

/** A request as a mock route sees it. */
export interface MockRequest {
  method: string;
  /** The path relative to /api, without the query string. */
  url: string;
  /** The query string, parsed. */
  params: Record<string, string>;
  /** The body as sent (JSON text); see requestBody. */
  data?: string;
}

export interface MockRoute {
  method?: 'get' | 'post' | 'put' | 'delete';
  /** Matched against the request url (path relative to the API base). */
  url: string | RegExp;
  /** Return the JSON body. Throw or return `{ status }` to fail. */
  respond: (
    config: MockRequest
  ) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
}

/**
 * Stub the HTTP layer the app actually uses.
 *
 * The API client (openapi-fetch) speaks fetch through middleware, so a
 * middleware answers its requests from these routes: unmatched routes fail
 * loudly with 404, and the middleware is removed when the story unmounts.
 */
export function mockApi(routes: MockRoute[]): () => void {
  const fetchMock: Middleware = {
    async onRequest({ request }) {
      const parsed = new URL(request.url);
      const config: MockRequest = {
        method: request.method.toLowerCase(),
        url: parsed.pathname.replace(/^\/api(?=\/)/, ''),
        params: Object.fromEntries(parsed.searchParams.entries()),
        data: request.body ? await request.clone().text() : undefined,
      };
      const route = routes.find(
        (r) =>
          (!r.method || r.method === config.method) &&
          (typeof r.url === 'string' ? config.url.includes(r.url) : r.url.test(config.url))
      );
      const result = route
        ? await route.respond(config)
        : {
            status: 404,
            body: {
              success: false,
              error: `No mock for ${config.method.toUpperCase()} ${config.url}`,
            },
          };
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };

  client.use(fetchMock);
  return () => {
    client.eject(fetchMock);
  };
}

/** Parse a request body the way the server would. */
export function requestBody<T = any>(config: MockRequest): T {
  return (config.data ? JSON.parse(config.data) : undefined) as T;
}
