import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startPortalTestTable } from '../../../utils/testUtils/portalTestTable';
import { AssetHistory, type ObjectStore, SEEN_BY_EXPORT } from '../AssetHistory';
import { snapshotOf } from '../definitionSnapshot';

class MemoryObjects implements ObjectStore {
  public readonly objects = new Map<string, unknown>();
  public async putObject(_bucket: string, key: string, body: unknown): Promise<void> {
    this.objects.set(key, JSON.parse(JSON.stringify(body)));
  }
  public async getObject<T>(_bucket: string, key: string): Promise<T> {
    if (!this.objects.has(key)) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    return this.objects.get(key) as T;
  }
  public async deleteObject(_bucket: string, key: string): Promise<void> {
    this.objects.delete(key);
  }
}

const doc = (name: string, sheets: Array<{ id: string; title: string }>) => ({
  apiResponses: {
    list: { timestamp: 't', data: { Name: name } },
    definition: {
      timestamp: 't',
      data: {
        Name: name,
        Definition: {
          Sheets: [
            {
              SheetId: 's1',
              Name: 'Main',
              Visuals: sheets.map((v) => ({
                TableVisual: { VisualId: v.id, Title: { FormatText: { PlainText: v.title } } },
              })),
            },
          ],
        },
        ResourceStatus: 'CREATION_SUCCESSFUL',
      },
    },
  },
});

let table: Awaited<ReturnType<typeof startPortalTestTable>>;
beforeAll(async () => {
  table = await startPortalTestTable();
});
afterAll(async () => {
  await table.stop();
});

describe('AssetHistory', () => {
  it('keeps a version only when the definition changed, and says what changed', async () => {
    const objects = new MemoryObjects();
    const history = new AssetHistory(objects, 'bucket');
    const first = await history.keep({
      assetType: 'analysis',
      assetId: 'a1',
      snapshot: snapshotOf('analysis', doc('Sales', [{ id: 'v1', title: 'Revenue' }]))!,
    });
    expect(first?.summary).toBe('First version seen');
    expect(first?.by).toBe(SEEN_BY_EXPORT);
    expect(first?.source).toBe('export');

    const same = await history.keep({
      assetType: 'analysis',
      assetId: 'a1',
      snapshot: snapshotOf('analysis', doc('Sales', [{ id: 'v1', title: 'Revenue' }]))!,
    });
    expect(same).toBeNull();

    const second = await history.keep({
      assetType: 'analysis',
      assetId: 'a1',
      snapshot: snapshotOf(
        'analysis',
        doc('Sales', [
          { id: 'v1', title: 'Revenue' },
          { id: 'v2', title: 'Cost' },
        ])
      )!,
      provenance: { source: 'portal', by: 'pat@example.com', action: 'authoring.update' },
    });
    expect(second?.previousVersionId).toBe(first?.versionId);
    expect(second?.summary).toBe('1 visual added');
    expect(second?.changes).toEqual(['Visual "Cost" (table) added on "Main"']);
    expect(second?.by).toBe('pat@example.com');

    const listed = await history.list('analysis', 'a1');
    expect(listed.map((v) => v.versionId)).toEqual([second?.versionId, first?.versionId]);
    expect((await history.snapshot('analysis', 'a1', first!.versionId)).name).toBe('Sales');
    expect(objects.objects.size).toBe(2);
  });

  it("prefers the portal's own change lines over the computed ones", async () => {
    const history = new AssetHistory(new MemoryObjects(), 'bucket');
    await history.keep({
      assetType: 'dashboard',
      assetId: 'd1',
      snapshot: snapshotOf('dashboard', doc('Exec', [{ id: 'v1', title: 'Revenue' }]))!,
    });
    const next = await history.keep({
      assetType: 'dashboard',
      assetId: 'd1',
      snapshot: snapshotOf('dashboard', doc('Exec', [{ id: 'v1', title: 'Net revenue' }]))!,
      provenance: {
        source: 'portal',
        by: 'pat@example.com',
        action: 'authoring.update',
        changes: ['Retitled the revenue visual to say net'],
      },
    });
    expect(next?.changes).toEqual(['Retitled the revenue visual to say net']);
    expect(next?.summary).toBe('1 visual retitled');
  });

  it('prunes the oldest versions past the count kept, objects included', async () => {
    const objects = new MemoryObjects();
    const history = new AssetHistory(objects, 'bucket');
    for (let i = 0; i < 4; i++) {
      await history.keep({
        assetType: 'dataset',
        assetId: 'ds1',
        snapshot: {
          definition: {
            Name: 'Orders',
            OutputColumns: Array.from({ length: i + 1 }, (_, n) => ({ Name: `c${n}` })),
          },
          hash: `h${i}`,
          name: 'Orders',
        },
        at: `2026-10-0${i + 1}T00:00:00.000Z`,
      });
    }
    expect(await history.prune('dataset', 'ds1', 2)).toBe(2);
    const left = await history.list('dataset', 'ds1');
    expect(left.map((v) => v.hash)).toEqual(['h3', 'h2']);
    expect(objects.objects.size).toBe(2);
    const recent = await history.recent(10);
    expect(recent.filter((v) => v.assetId === 'ds1')).toHaveLength(2);
  });
});
