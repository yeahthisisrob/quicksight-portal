import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';

import { api } from '../../src/shared/api/client';

export interface MockRoute {
  method?: 'get' | 'post' | 'put' | 'delete';
  /** Matched against the request url (path relative to the API base). */
  url: string | RegExp;
  /** Return the JSON body. Throw or return `{ status }` to fail. */
  respond: (
    config: AxiosRequestConfig
  ) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
}

/**
 * Stub the HTTP layer the app actually uses.
 *
 * The API client is axios, which talks XMLHttpRequest in a browser, so a
 * `window.fetch` stub never sees its requests. Replacing the adapter does:
 * every call goes through here, unmatched routes fail loudly with 404, and
 * the previous adapter is restored when the story unmounts.
 */
export function mockApi(routes: MockRoute[]): () => void {
  const previous = api.defaults.adapter;

  const adapter: AxiosAdapter = async (config) => {
    const method = (config.method ?? 'get').toLowerCase();
    const url = config.url ?? '';
    const route = routes.find(
      (r) =>
        (!r.method || r.method === method) &&
        (typeof r.url === 'string' ? url.includes(r.url) : r.url.test(url))
    );

    const result = route
      ? await route.respond(config)
      : {
          status: 404,
          body: { success: false, error: `No mock for ${method.toUpperCase()} ${url}` },
        };
    const status = result.status ?? 200;
    const response: AxiosResponse = {
      data: result.body,
      status,
      statusText: status < 400 ? 'OK' : 'Error',
      headers: {},
      config: config as AxiosResponse['config'],
    };
    if (status >= 400) {
      const error = Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        response,
        config,
        toJSON: () => ({}),
      });
      throw error;
    }
    return response;
  };

  api.defaults.adapter = adapter;
  return () => {
    api.defaults.adapter = previous;
  };
}

/** Parse a request body the way the server would. */
export function requestBody<T = any>(config: AxiosRequestConfig): T {
  return typeof config.data === 'string' ? (JSON.parse(config.data) as T) : (config.data as T);
}
