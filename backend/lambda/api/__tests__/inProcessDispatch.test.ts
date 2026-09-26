import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ exists: vi.fn(), handler: vi.fn() }));

vi.mock('../../shared/services/auth/ApiKeyStore', () => ({
  apiKeyStore: { exists: mocks.exists },
}));
vi.mock('../apiHandler', () => ({ apiHandler: mocks.handler }));

import { inProcessDispatch } from '../inProcessDispatch';

describe('inProcessDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handler.mockResolvedValue({ statusCode: 200, body: '{"success":true}' });
  });

  it('acts as a person without looking anything up', async () => {
    const call = inProcessDispatch({ userId: 'u', accountId: '1', email: 'rob@example.com' });
    await expect(call({ method: 'GET', path: '/api/search?q=x' })).resolves.toEqual({
      status: 200,
      body: '{"success":true}',
    });
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.handler.mock.calls[0]![0]).toMatchObject({
      httpMethod: 'GET',
      path: '/api/search',
      queryStringParameters: { q: 'x' },
    });
  });

  it('stops acting as an API key once it is revoked', async () => {
    mocks.exists.mockResolvedValue(false);
    const call = inProcessDispatch({
      userId: 'api-key:ci',
      accountId: '1',
      apiKey: { id: 'revoked-1', label: 'ci' },
    });
    const response = await call({ method: 'POST', path: '/api/tags/dashboard/d1', body: {} });
    expect(response.status).toBe(401);
    expect(JSON.parse(response.body).error).toContain('"ci"');
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it('keeps working as a live key, looking it up at most once a minute', async () => {
    mocks.exists.mockResolvedValue(true);
    const call = inProcessDispatch({
      userId: 'api-key:ci',
      accountId: '1',
      apiKey: { id: 'live-1', label: 'ci' },
    });
    await call({ method: 'GET', path: '/api/search?q=a' });
    await call({ method: 'GET', path: '/api/search?q=b' });
    expect(mocks.exists).toHaveBeenCalledTimes(1);
    expect(mocks.handler).toHaveBeenCalledTimes(2);
  });
});
