import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';
import { isConditionFailed, portal } from '../portalTable';

let table: PortalTestTable;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

describe('the portal table', () => {
  it('keeps the case of ids in keys, and reads an item back by them', async () => {
    await portal()
      .apiKey.put({
        id: 'AbC123',
        label: 'cli',
        prefix: 'qsp_x',
        createdAt: '2026-09-28T00:00:00.000Z',
        createdBy: 'rob',
        hash: 'h',
      })
      .go();
    expect((await portal().apiKey.get({ id: 'AbC123' }).go()).data?.label).toBe('cli');
    expect((await portal().apiKey.get({ id: 'abc123' }).go()).data).toBeNull();
  });

  it('refuses a conditional write whose condition does not hold', async () => {
    const lock = { lock: 'export', ownerJobId: 'j1', acquiredAt: 'now', lockExpiresAt: 1 };
    await portal().exportLock.create(lock).go();
    const second = portal()
      .exportLock.create({ ...lock, ownerJobId: 'j2' })
      .go();
    await expect(second).rejects.toSatisfy(isConditionFailed);
  });

  it('reads every page of a partition, in key order', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      jobId: 'job-1',
      itemKey: String(i).padStart(3, '0'),
      stage: 0,
      assetType: 'dashboard',
      assetId: `d${i}`,
      name: `d${i}`,
      status: 'pending',
      updatedAt: 'now',
      plan: { big: 'x'.repeat(20_000) },
    }));
    await portal().jobItem.put(rows).go();
    const { data } = await portal().jobItem.query.byJob({ jobId: 'job-1' }).go({ pages: 'all' });
    expect(data.map((r) => r.itemKey)).toEqual(rows.map((r) => r.itemKey));
  });
});
