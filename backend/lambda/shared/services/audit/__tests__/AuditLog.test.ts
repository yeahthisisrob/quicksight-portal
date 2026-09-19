import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AuditLog, actorFromAuth } from '../AuditLog';

describe('actorFromAuth', () => {
  it('maps an API key to an api actor and a person to a ui actor', () => {
    expect(
      actorFromAuth({ userId: 'api-key:ci', accountId: '1', apiKey: { id: 'k1', label: 'ci' } })
    ).toEqual({ actor: { kind: 'api-key', id: 'k1', label: 'ci' }, channel: 'api' });
    expect(actorFromAuth({ userId: 'u1', accountId: '1', email: 'rob@example.com' })).toEqual({
      actor: { kind: 'user', id: 'u1', label: 'rob@example.com' },
      channel: 'ui',
    });
  });
});

describe('AuditLog', () => {
  const dynamo = { putItem: vi.fn(), queryPartition: vi.fn() };
  const clock = new Date('2026-09-19T10:00:00.000Z');
  const log = () => new AuditLog(dynamo as any, 'jobs', () => clock);

  beforeEach(() => {
    vi.clearAllMocks();
    dynamo.putItem.mockResolvedValue(undefined);
  });

  it('writes a record with a sortable key and a retention ttl, and returns it', async () => {
    const record = await log().record({
      actor: { kind: 'user', id: 'u1', label: 'rob' },
      channel: 'ui',
      action: 'authoring.update',
      assetType: 'dashboard',
      assetId: 'd-1',
    });
    expect(record).toMatchObject({ at: clock.toISOString(), action: 'authoring.update' });
    const item = dynamo.putItem.mock.calls[0]![1];
    expect(item.pk).toBe('AUDIT');
    expect(item.sk.startsWith(`${clock.toISOString()}#`)).toBe(true);
    expect(item.ttl).toBeGreaterThan(clock.getTime() / 1000);
  });

  it('never throws when the table is unavailable', async () => {
    dynamo.putItem.mockRejectedValue(new Error('no table'));
    await expect(
      log().record({ actor: { kind: 'user', id: 'u', label: 'u' }, channel: 'ui', action: 'x' })
    ).resolves.toBeNull();
  });

  it('lists records in a window, newest first, without storage keys', async () => {
    dynamo.queryPartition.mockResolvedValue([
      {
        pk: 'AUDIT',
        sk: 'b',
        ttl: 1,
        id: 'b',
        at: '2026-09-18T00:00:00.000Z',
        actor: {},
        channel: 'ui',
        action: 'x',
      },
      {
        pk: 'AUDIT',
        sk: 'a',
        ttl: 1,
        id: 'a',
        at: '2026-09-19T09:00:00.000Z',
        actor: {},
        channel: 'ui',
        action: 'y',
      },
      {
        pk: 'AUDIT',
        sk: 'c',
        ttl: 1,
        id: 'c',
        at: '2026-01-01T00:00:00.000Z',
        actor: {},
        channel: 'ui',
        action: 'z',
      },
    ]);
    const records = await log().list({ since: '2026-09-01T00:00:00.000Z' });
    expect(records.map((r) => r.id)).toEqual(['a', 'b']);
    expect(records[0]).not.toHaveProperty('pk');
  });
});
