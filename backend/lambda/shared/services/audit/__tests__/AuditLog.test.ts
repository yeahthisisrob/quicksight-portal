import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';
import { portal } from '../../store/portalTable';
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

let table: PortalTestTable;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

describe('AuditLog', () => {
  const clock = new Date('2026-09-19T10:00:00.000Z');
  const log = (now = clock) => new AuditLog(() => now);
  const actor = { kind: 'user' as const, id: 'u1', label: 'rob' };

  it('writes a record keyed by time with a retention expiry, and returns it', async () => {
    const record = await log().record({
      actor,
      channel: 'ui',
      action: 'authoring.update',
      assetType: 'dashboard',
      assetId: 'd-1',
    });
    expect(record).toMatchObject({ at: clock.toISOString(), action: 'authoring.update' });
    const stored = (await portal().auditRecord.get({ at: record!.at, id: record!.id }).go()).data!;
    expect(stored.expiresAt).toBeGreaterThan(clock.getTime() / 1000);
    expect(stored.assetId).toBe('d-1');
  });

  it('never throws when the table is unavailable', async () => {
    vi.spyOn(portal().auditRecord, 'put').mockImplementationOnce(() => {
      throw new Error('no table');
    });
    await expect(log().record({ actor, channel: 'ui', action: 'x' })).resolves.toBeNull();
  });

  it('lists the records in a window, newest first, without storage attributes', async () => {
    const at = (iso: string) => log(new Date(iso));
    await at('2026-01-01T00:00:00.000Z').record({ actor, channel: 'ui', action: 'before' });
    await at('2026-02-01T00:00:00.000Z').record({ actor, channel: 'ui', action: 'in-1' });
    await at('2026-02-02T00:00:00.000Z').record({ actor, channel: 'api', action: 'in-2' });
    await at('2026-03-01T00:00:00.000Z').record({ actor, channel: 'ui', action: 'after' });

    const records = await log().list({
      since: '2026-02-01T00:00:00.000Z',
      until: '2026-02-28T00:00:00.000Z',
    });
    expect(records.map((r) => r.action)).toEqual(['in-2', 'in-1']);
    expect(records[0]).not.toHaveProperty('expiresAt');
  });
});
