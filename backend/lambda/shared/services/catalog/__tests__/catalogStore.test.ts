/**
 * The catalog on real DynamoDB semantics (an in-process table): writes to
 * one asset never undo each other, archiving moves an entry in one step,
 * and one Lambda's copy follows another Lambda's writes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { CatalogEntry } from '../../../models/asset.model';
import { AssetStatusFilter } from '../../../types/assetFilterTypes';
import {
  type PortalTestTable,
  startPortalTestTable,
} from '../../../utils/testUtils/portalTestTable';
import { exportFilePath } from '../catalogEntry';
import { CatalogStore, shardOf } from '../catalogStore';

let table: PortalTestTable;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

const T0 = new Date('2026-09-01T00:00:00.000Z');

function entry(
  assetType: CatalogEntry['assetType'],
  assetId: string,
  extra: Partial<CatalogEntry> = {}
): CatalogEntry {
  return {
    assetId,
    assetType,
    assetName: assetId,
    arn: `arn:${assetType}/${assetId}`,
    status: 'active',
    enrichmentStatus: 'enriched',
    createdTime: T0,
    lastUpdatedTime: T0,
    exportedAt: T0,
    exportFilePath: exportFilePath(assetType, assetId, 'live'),
    storageType: 'individual',
    tags: [],
    permissions: [],
    metadata: {},
    ...extra,
  };
}

let store: CatalogStore;
beforeEach(async () => {
  store = new CatalogStore();
  for (const type of ['dashboard', 'user', 'dataset'] as const) await store.replaceType(type, []);
});

describe('reading and writing entries', () => {
  it('keeps an entry whole: dates, tags, permissions and large metadata', async () => {
    const fields = Array.from({ length: 2000 }, (_, i) => ({
      fieldId: `f${i}`,
      fieldName: `field_${i}`,
      dataType: 'STRING',
    }));
    const dashboard = entry('dashboard', 'Sales-Dash', {
      tags: [{ key: 'env', value: 'prod' }],
      metadata: { fields, sheetCount: 3 },
    });
    await store.put([dashboard]);
    expect(await store.get('dashboard', 'Sales-Dash')).toEqual(dashboard);
    expect(await store.list('dashboard')).toEqual([dashboard]);
    expect(await store.get('dashboard', 'sales-dash')).toBeNull();
  });

  it('spreads a type over its shards and reads every one back', async () => {
    const many = Array.from({ length: 200 }, (_, i) => entry('dataset', `ds-${i}`));
    expect(new Set(many.map((e) => shardOf(e.assetId))).size).toBeGreaterThan(4);
    await store.put(many);
    expect((await store.list('dataset')).map((e) => e.assetId).sort()).toEqual(
      many.map((e) => e.assetId).sort()
    );
  });

  it('keeps both of two changes made to one asset at the same time', async () => {
    await store.put([entry('dashboard', 'd1', { metadata: { sheetCount: 1 } })]);
    await Promise.all([
      store.patch('dashboard', 'd1', { tags: [{ key: 'team', value: 'finance' }] }),
      store.patch('dashboard', 'd1', { metadata: { visualCount: 9 } }),
      store.patch('dashboard', 'd1', { metadata: { themeArn: 'arn:theme/brand' } }),
    ]);
    const d1 = await store.get('dashboard', 'd1');
    expect(d1?.tags).toEqual([{ key: 'team', value: 'finance' }]);
    expect(d1?.metadata).toEqual({ sheetCount: 1, visualCount: 9, themeArn: 'arn:theme/brand' });
  });

  it('makes a skeleton entry for an asset it has not seen', async () => {
    await store.patch('dashboard', 'new-one', { assetName: 'New one' });
    expect(await store.get('dashboard', 'new-one')).toMatchObject({
      assetName: 'New one',
      enrichmentStatus: 'skeleton',
      status: 'active',
    });
  });

  it('rebuilds a type to exactly what it is given', async () => {
    await store.put([entry('dataset', 'keep'), entry('dataset', 'gone')]);
    await store.replaceType('dataset', [entry('dataset', 'keep', { assetName: 'Kept' })]);
    expect((await store.list('dataset', AssetStatusFilter.ALL)).map((e) => e.assetName)).toEqual([
      'Kept',
    ]);
  });
});

describe('archiving', () => {
  it('moves an entry from live to archived in one step, with why and by whom', async () => {
    await store.put([entry('dashboard', 'd1', { metadata: { sheetCount: 2 } })]);
    await store.archive([
      { assetType: 'dashboard', assetId: 'd1', archiveReason: 'Retired', archivedBy: 'rob' },
    ]);
    expect(await store.list('dashboard')).toEqual([]);
    const [archived] = await store.list('dashboard', AssetStatusFilter.ARCHIVED);
    expect(archived).toMatchObject({
      status: 'archived',
      exportFilePath: 'archived/dashboards/d1.json',
      metadata: { sheetCount: 2, archived: { archiveReason: 'Retired', archivedBy: 'rob' } },
    });
  });

  it('archives six users at once and every one of them lands (the idle-reader run)', async () => {
    const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    await store.put(
      [...users, 'stays'].map((u) => entry('user', u, { storageType: 'collection' }))
    );
    await store.archive(users.map((assetId) => ({ assetType: 'user', assetId })));
    expect((await store.list('user')).map((e) => e.assetId)).toEqual(['stays']);
    expect(
      (await store.list('user', AssetStatusFilter.ARCHIVED)).map((e) => e.assetId).sort()
    ).toEqual(users);
  });

  it('records a restore on the archived entry and keeps the live copy separate', async () => {
    await store.put([entry('dashboard', 'd1')]);
    await store.archive([{ assetType: 'dashboard', assetId: 'd1' }]);
    await store.put([entry('dashboard', 'd1', { assetName: 'Back again' })]);
    const restoration = { restoredAt: 't', restoredBy: 'rob', restoredAs: 'd1' };
    await store.patchArchived('dashboard', 'd1', { restorations: [restoration] });
    expect((await store.get('dashboard', 'd1'))?.assetName).toBe('Back again');
    const [archived] = await store.list('dashboard', AssetStatusFilter.ARCHIVED);
    expect(archived?.metadata.archived?.restorations).toEqual([restoration]);
  });
});

describe('two Lambdas', () => {
  it("serves the other Lambda's write on the next read", async () => {
    const a = new CatalogStore();
    const b = new CatalogStore();
    await a.put([entry('dashboard', 'd1')]);
    expect((await b.list('dashboard')).map((e) => e.assetName)).toEqual(['d1']);
    await a.patch('dashboard', 'd1', { assetName: 'Renamed' });
    expect((await b.list('dashboard')).map((e) => e.assetName)).toEqual(['Renamed']);
    await a.remove('dashboard', 'd1');
    expect(await b.list('dashboard')).toEqual([]);
  });
});
