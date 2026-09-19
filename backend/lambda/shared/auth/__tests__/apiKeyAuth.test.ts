import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const authenticate = vi.fn();
vi.mock('../../services/auth/ApiKeyStore', () => ({
  apiKeyStore: { authenticate: (secret: string) => authenticate(secret) },
  isApiKey: (token: string) => token.startsWith('qsp_'),
}));

const jwt = vi.fn();
vi.mock('../../services/auth/JWTAuth', () => ({
  JWTAuth: { authenticate: (event: unknown) => jwt(event) },
}));

import { ForbiddenError, getAuthContext, requireUser } from '../index';

const request = (authorization?: string) =>
  ({
    headers: authorization ? { Authorization: authorization } : {},
    path: '/api/settings',
    httpMethod: 'GET',
    requestContext: {},
  }) as any;

describe('getAuthContext with API keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = '123';
  });

  it('admits a known key as an api-key principal without touching the JWT verifier', async () => {
    authenticate.mockResolvedValue({ id: 'k1', label: 'claude cli' });

    const context = await getAuthContext(request('Bearer qsp_abc'));

    expect(context).toEqual({
      userId: 'api-key:claude cli',
      accountId: '123',
      groups: ['api-key'],
      apiKey: { id: 'k1', label: 'claude cli' },
    });
    expect(jwt).not.toHaveBeenCalled();
  });

  it('rejects an unknown key outright rather than falling back to JWT', async () => {
    authenticate.mockResolvedValue(null);
    expect(await getAuthContext(request('Bearer qsp_unknown'))).toBeNull();
    expect(jwt).not.toHaveBeenCalled();
  });

  it('still verifies ordinary bearer tokens as JWTs', async () => {
    jwt.mockResolvedValue({
      authenticated: true,
      user: { id: 'u1', email: 'rob@example.com', groups: [] },
    });
    const context = await getAuthContext(request('Bearer eyJ.abc.def'));
    expect(context).toMatchObject({ userId: 'u1', email: 'rob@example.com' });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('requireUser refuses api-key callers with a 403', async () => {
    authenticate.mockResolvedValue({ id: 'k1', label: 'ci' });
    await expect(requireUser(request('Bearer qsp_abc'))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
