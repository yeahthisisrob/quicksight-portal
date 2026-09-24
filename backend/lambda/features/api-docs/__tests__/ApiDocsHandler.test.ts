import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'u' }),
}));
vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getGuide, getOpenApi, requestOrigin } from '../handlers/ApiDocsHandler';

const event = (headers: Record<string, string> = {}) =>
  ({ headers, path: '/api-docs/openapi', httpMethod: 'GET' }) as any;

describe('ApiDocsHandler', () => {
  it('serves the contract with servers pointing at the portal that served it', async () => {
    const response = await getOpenApi(
      event({ host: 'd123.cloudfront.net', 'x-forwarded-proto': 'https' })
    );
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.openapi).toMatch(/^3\./);
    expect(body.servers).toEqual([
      { url: 'https://d123.cloudfront.net', description: 'This portal' },
    ]);
    expect(Object.keys(body.paths)).toContain('/api/search');
  });

  it('keeps the contract as written when the request has no host', async () => {
    const body = JSON.parse((await getOpenApi(event())).body);
    expect(body.servers[0].url).not.toContain('This portal');
    expect(requestOrigin(event())).toBeNull();
    expect(requestOrigin(event({ Host: 'localhost:3000', 'X-Forwarded-Proto': 'http' }))).toBe(
      'http://localhost:3000'
    );
  });

  it('serves the guide as markdown', async () => {
    const response = await getGuide(event());
    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Content-Type']).toBe('text/markdown; charset=utf-8');
    expect(response.body).toMatch(/^# /);
  });
});
