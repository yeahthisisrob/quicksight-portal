import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCacheEntries: vi.fn(),
  findBySub: vi.fn(),
}));

vi.mock('../../cache/CacheService', () => ({
  cacheService: { getCacheEntries: mocks.getCacheEntries },
}));
vi.mock('../../../../adapters/aws/CognitoAdapter', () => ({
  CognitoAdapter: vi.fn(function () {
    return { findBySub: mocks.findBySub };
  }),
}));
vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { resetIdentityCache, resolvePeople } from '../IdentityResolver';

const SUB = '4f1c8a2e-9b3d-4e5f-8a6b-7c8d9e0f1a2b';
const ROB = {
  assetId: 'rob',
  assetName: 'rob',
  arn: 'arn:aws:quicksight:us-east-1:1:user/default/rob',
  metadata: { email: 'Rob@Example.com' },
};

describe('resolvePeople', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdentityCache();
    process.env.COGNITO_USER_POOL_ID = 'pool-1';
    mocks.getCacheEntries.mockResolvedValue([ROB]);
    mocks.findBySub.mockResolvedValue({ username: 'google_123', email: 'rob@example.com' });
  });

  it('names a sign-in id by its email and links the QuickSight user', async () => {
    const people = await resolvePeople([SUB]);
    expect(people.get(SUB)).toEqual({
      label: 'rob@example.com',
      email: 'rob@example.com',
      kind: 'person',
      quickSightUserName: 'rob',
      quickSightUserArn: ROB.arn,
    });
  });

  it('looks each sign-in id up once per container', async () => {
    await resolvePeople([SUB, SUB]);
    await resolvePeople([SUB]);
    expect(mocks.findBySub).toHaveBeenCalledTimes(1);
  });

  it('falls back to the pool username, then the id, when there is no email', async () => {
    mocks.findBySub.mockResolvedValueOnce({ username: 'google_123' });
    expect((await resolvePeople([SUB])).get(SUB)?.label).toBe('google_123');
    resetIdentityCache();
    mocks.findBySub.mockRejectedValueOnce(new Error('AccessDenied'));
    expect((await resolvePeople([SUB])).get(SUB)?.label).toBe(SUB);
  });

  it('names API keys, the portal, and emails and user names it is given directly', async () => {
    const people = await resolvePeople([
      'api-key:claude-cli',
      'claude-cli (API key)',
      'system',
      'ROB@example.com',
      'rob',
    ]);
    expect(people.get('api-key:claude-cli')).toEqual({
      label: 'claude-cli (API key)',
      kind: 'api-key',
    });
    expect(people.get('claude-cli (API key)')?.label).toBe('claude-cli (API key)');
    expect(people.get('system')).toEqual({ label: 'The portal', kind: 'portal' });
    expect(people.get('ROB@example.com')?.quickSightUserName).toBe('rob');
    expect(people.get('rob')?.quickSightUserArn).toBe(ROB.arn);
    expect(mocks.findBySub).not.toHaveBeenCalled();
  });
});
