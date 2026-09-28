import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';
import { portal } from '../../store/portalTable';
import { API_KEY_PREFIX, ApiKeyStore, hashApiKey, isApiKey } from '../ApiKeyStore';

let table: PortalTestTable;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

describe('ApiKeyStore', () => {
  let clock = new Date('2026-09-19T10:00:00.000Z');
  const store = () => new ApiKeyStore(() => clock);

  beforeEach(async () => {
    clock = new Date('2026-09-19T10:00:00.000Z');
    const { data } = await portal().apiKey.query.byId({}).go({ pages: 'all' });
    if (data.length)
      await portal()
        .apiKey.delete(data.map(({ id }) => ({ id })))
        .go();
  });

  it('creates a prefixed secret, stores only its hash, and never returns the hash', async () => {
    const { key, secret } = await store().create(' ci ', 'rob');
    expect(secret.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(isApiKey(secret)).toBe(true);
    expect(key).toEqual({
      id: expect.any(String),
      label: 'ci',
      prefix: secret.slice(0, 12),
      createdAt: clock.toISOString(),
      createdBy: 'rob',
    });
    const stored = (await portal().apiKey.get({ id: key.id }).go()).data!;
    expect(stored.hash).toBe(hashApiKey(secret));
    expect(JSON.stringify(stored)).not.toContain(secret);
  });

  it('refuses an empty label', async () => {
    await expect(store().create('   ', 'rob')).rejects.toThrow('A label is required');
  });

  it('authenticates by hash and touches lastUsedAt at most hourly', async () => {
    const { key, secret } = await store().create('ci', 'rob');
    const lastUsed = async () => (await portal().apiKey.get({ id: key.id }).go()).data?.lastUsedAt;

    expect(await store().authenticate(secret)).toEqual(key);
    expect(await lastUsed()).toBe(clock.toISOString());

    const first = clock.toISOString();
    clock = new Date(clock.getTime() + 30 * 60 * 1000);
    expect(await store().authenticate(secret)).toMatchObject({ id: key.id });
    expect(await lastUsed()).toBe(first);

    clock = new Date(clock.getTime() + 61 * 60 * 1000);
    await store().authenticate(secret);
    expect(await lastUsed()).toBe(clock.toISOString());
  });

  it('rejects unknown secrets and tokens without the prefix', async () => {
    await store().create('ci', 'rob');
    expect(await store().authenticate('qsp_nope')).toBeNull();
    expect(await store().authenticate('eyJhbGciOi...')).toBeNull();
  });

  it('lists newest first without hashes, and revokes by id', async () => {
    const a = (await store().create('a', 'rob')).key;
    clock = new Date(clock.getTime() + 1000);
    const b = (await store().create('b', 'rob')).key;
    const keys = await store().list();
    expect(keys.map((k) => k.id)).toEqual([b.id, a.id]);
    expect(keys[0]).not.toHaveProperty('hash');
    await store().revoke(a.id);
    expect(await store().exists(a.id)).toBe(false);
    expect(await store().exists(b.id)).toBe(true);
  });
});
