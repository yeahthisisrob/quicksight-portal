import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_KEY_PREFIX, ApiKeyStore, hashApiKey, isApiKey } from '../ApiKeyStore';

describe('ApiKeyStore', () => {
  const dynamo = {
    queryPartition: vi.fn(),
    putItem: vi.fn(),
    deleteItem: vi.fn(),
    updateItem: vi.fn(),
  };
  let clock = new Date('2026-09-19T10:00:00.000Z');
  const store = () => new ApiKeyStore(dynamo as any, 'jobs', () => clock);

  beforeEach(() => {
    vi.clearAllMocks();
    clock = new Date('2026-09-19T10:00:00.000Z');
    dynamo.putItem.mockResolvedValue(undefined);
    dynamo.deleteItem.mockResolvedValue(undefined);
    dynamo.updateItem.mockResolvedValue(undefined);
  });

  it('creates a prefixed secret, stores only its hash, and never returns the hash', async () => {
    const { key, secret } = await store().create('  claude cli ', 'rob');

    expect(secret.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(isApiKey(secret)).toBe(true);
    expect(key).toEqual({
      id: expect.any(String),
      label: 'claude cli',
      prefix: secret.slice(0, 12),
      createdAt: '2026-09-19T10:00:00.000Z',
      createdBy: 'rob',
    });
    const stored = dynamo.putItem.mock.calls[0]![1];
    expect(stored.hash).toBe(hashApiKey(secret));
    expect(JSON.stringify(stored)).not.toContain(secret);
  });

  it('refuses an empty label', async () => {
    await expect(store().create('   ', 'rob')).rejects.toThrow('A label is required');
  });

  it('authenticates by hash and touches lastUsedAt at most hourly', async () => {
    const { key, secret } = await store().create('ci', 'rob');
    const stored = dynamo.putItem.mock.calls[0]![1];
    dynamo.queryPartition.mockResolvedValue([stored]);

    expect(await store().authenticate(secret)).toEqual(key);
    expect(dynamo.updateItem).toHaveBeenCalledTimes(1);

    stored.lastUsedAt = clock.toISOString();
    clock = new Date(clock.getTime() + 10 * 60 * 1000);
    expect(await store().authenticate(secret)).toMatchObject({ id: key.id });
    expect(dynamo.updateItem).toHaveBeenCalledTimes(1);

    clock = new Date(clock.getTime() + 2 * 60 * 60 * 1000);
    await store().authenticate(secret);
    expect(dynamo.updateItem).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown secrets and tokens without the prefix without a lookup', async () => {
    dynamo.queryPartition.mockResolvedValue([]);
    expect(await store().authenticate('qsp_nope')).toBeNull();
    expect(await store().authenticate('eyJhbGciOi...')).toBeNull();
    expect(dynamo.queryPartition).toHaveBeenCalledTimes(1);
  });

  it('lists newest first without hashes, and revokes by id', async () => {
    dynamo.queryPartition.mockResolvedValue([
      {
        pk: 'API_KEY',
        sk: 'a',
        id: 'a',
        label: 'old',
        prefix: 'qsp_a',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'rob',
        hash: 'x',
      },
      {
        pk: 'API_KEY',
        sk: 'b',
        id: 'b',
        label: 'new',
        prefix: 'qsp_b',
        createdAt: '2026-02-01T00:00:00Z',
        createdBy: 'rob',
        hash: 'y',
      },
    ]);
    const keys = await store().list();
    expect(keys.map((k) => k.id)).toEqual(['b', 'a']);
    expect(keys[0]).not.toHaveProperty('hash');

    await store().revoke('a');
    expect(dynamo.deleteItem).toHaveBeenCalledWith('jobs', { pk: 'API_KEY', sk: 'a' });
  });
});
