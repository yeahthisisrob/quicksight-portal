import type { Table } from '@aws-sdk/client-glue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CatalogAsset, CatalogListing } from '../../../../adapters/aws/DataZoneAdapter';
import { COLUMN_FORM } from '../../lib/smusText';
import { GLUE_SIDE, smusSide, type TableRecord } from '../../types';
import { MetadataSyncService, tablesInScope } from '../MetadataSyncService';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const listing = (assetId: string, table = 'orders'): CatalogListing => ({
  listingId: `listing-${assetId}`,
  assetId,
  name: `${table} (${assetId})`,
  assetType: 'amazon.datazone.GlueTableAssetType',
  table: { database: 'sales', name: table },
  glossaryTerms: [],
  forms: [],
});

const glueTable = (comment?: string): Table => ({
  Name: 'orders',
  VersionId: '1',
  StorageDescriptor: {
    Columns: [{ Name: 'order_id', Type: 'bigint', ...(comment ? { Comment: comment } : {}) }],
  },
});

const asset = (assetId: string, description?: string): CatalogAsset => ({
  assetId,
  name: 'orders',
  glossaryTerms: [],
  listingId: `listing-${assetId}`,
  forms: description
    ? [
        {
          formName: COLUMN_FORM,
          content: JSON.stringify({
            columnsBusinessMetadata: [{ columnIdentifier: 'order_id', description }],
          }),
        },
      ]
    : [],
});

function harness() {
  const saved = new Map<string, TableRecord>();
  const glue = { getTable: vi.fn(), updateTable: vi.fn().mockResolvedValue(undefined) };
  const dataZone = { getAsset: vi.fn(), reviseAsset: vi.fn().mockResolvedValue(undefined) };
  const records = {
    getRecord: vi.fn(
      async (database: string, table: string) => saved.get(`${database}.${table}`) ?? null
    ),
    putRecord: vi.fn(async (record: TableRecord) => {
      saved.set(`${record.database}.${record.table}`, record);
    }),
  };
  const service = new MetadataSyncService(
    glue,
    dataZone,
    records,
    'dzd_1',
    () => new Date('2026-01-02T00:00:00.000Z')
  );
  return { glue, dataZone, records, saved, service };
}

const pass = (mode: 'preview' | 'run', listings: CatalogListing[]) => ({
  mode,
  listings,
  snapshotAt: '2026-01-01T00:00:00.000Z',
});

describe('tablesInScope', () => {
  it('groups the listings of one table and leaves out a listing that names no table', () => {
    const scopes = tablesInScope([
      listing('a'),
      listing('b'),
      listing('c', 'customers'),
      { ...listing('d'), table: undefined },
    ]);
    expect(scopes.map((s) => [s.table, s.listings.length])).toEqual([
      ['customers', 1],
      ['orders', 2],
    ]);
  });
});

describe('MetadataSyncService', () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
  });

  it('previews what a run would write and writes nothing anywhere', async () => {
    h.glue.getTable.mockResolvedValue(glueTable('The order.'));
    h.dataZone.getAsset.mockResolvedValue(asset('a'));

    const report = await h.service.run(pass('preview', [listing('a')]));

    expect(report.totals).toEqual({ tables: 1, adoptions: 1, conflicts: 0, writes: 1, failed: 0 });
    expect(report.tables[0]?.sides.map((s) => [s.kind, s.outcome])).toEqual([
      ['glue', 'unchanged'],
      ['smus', 'would-write'],
    ]);
    expect(h.glue.updateTable).not.toHaveBeenCalled();
    expect(h.dataZone.reviseAsset).not.toHaveBeenCalled();
    expect(h.records.putRecord).not.toHaveBeenCalled();
  });

  it('copies a Glue comment to the asset, keeps it, and finds nothing to do on the next pass', async () => {
    h.glue.getTable.mockResolvedValue(glueTable('The order.'));
    h.dataZone.getAsset.mockResolvedValue(asset('a'));

    const report = await h.service.run(pass('run', [listing('a')]));

    expect(report.tables[0]?.sides[1]?.outcome).toBe('written');
    const [, revised, revision] = h.dataZone.reviseAsset.mock.calls[0] ?? [];
    expect(revised).toMatchObject({ assetId: 'a', listingId: 'listing-a' });
    expect(JSON.parse(revision.forms[0].content).columnsBusinessMetadata).toEqual([
      { columnIdentifier: 'order_id', description: 'The order.' },
    ]);
    const record = h.saved.get('sales.orders');
    expect(record?.text.order_id?.description?.value).toBe('The order.');
    expect(record?.left[smusSide('a')]?.order_id).toEqual({ description: 'The order.' });

    h.dataZone.getAsset.mockResolvedValue(asset('a', 'The order.'));
    const again = await h.service.run(pass('run', [listing('a')]));
    expect(again.tables).toEqual([]);
    expect(h.dataZone.reviseAsset).toHaveBeenCalledTimes(1);
  });

  it('puts the comment back on a table that was dropped and created again', async () => {
    h.glue.getTable.mockResolvedValue(glueTable('The order.'));
    h.dataZone.getAsset.mockResolvedValue(asset('a', 'The order.'));
    await h.service.run(pass('run', [listing('a')]));

    h.glue.getTable.mockResolvedValue(glueTable());
    const report = await h.service.run(pass('run', [listing('a')]));

    expect(report.tables[0]?.sides[0]).toMatchObject({ kind: 'glue', outcome: 'written' });
    const [database, input, versionId] = h.glue.updateTable.mock.calls[0] ?? [];
    expect(database).toBe('sales');
    expect(versionId).toBe('1');
    expect(input.StorageDescriptor.Columns[0].Comment).toBe('The order.');
  });

  it('writes nothing for a field two places disagree on, and still sees it next time', async () => {
    h.glue.getTable.mockResolvedValue(glueTable('Glue says.'));
    h.dataZone.getAsset.mockResolvedValue(asset('a', 'SMUS says.'));

    const first = await h.service.run(pass('run', [listing('a')]));
    const second = await h.service.run(pass('run', [listing('a')]));

    for (const report of [first, second]) {
      expect(report.totals.conflicts).toBe(1);
      expect(report.tables[0]?.conflicts[0]?.sides).toEqual({
        [GLUE_SIDE]: 'Glue says.',
        [smusSide('a')]: 'SMUS says.',
      });
    }
    expect(h.glue.updateTable).not.toHaveBeenCalled();
    expect(h.dataZone.reviseAsset).not.toHaveBeenCalled();
  });

  it('reads the table again when a load commits between the read and the write', async () => {
    h.glue.getTable.mockResolvedValue(glueTable());
    h.dataZone.getAsset.mockResolvedValue(asset('a', 'The order.'));
    const beaten = Object.assign(new Error('changed'), { name: 'ConcurrentModificationException' });
    h.glue.updateTable.mockRejectedValueOnce(beaten).mockResolvedValue(undefined);

    const report = await h.service.run(pass('run', [listing('a')]));

    expect(report.tables[0]?.sides[0]?.outcome).toBe('written');
    expect(h.glue.updateTable).toHaveBeenCalledTimes(2);
  });

  it('says a failed write and leaves that place to be tried again', async () => {
    h.glue.getTable.mockResolvedValue(glueTable('The order.'));
    h.dataZone.getAsset.mockResolvedValue(asset('a'));
    h.dataZone.reviseAsset.mockRejectedValue(new Error('AccessDeniedException: not a contributor'));

    const report = await h.service.run(pass('run', [listing('a')]));

    expect(report.totals.failed).toBe(1);
    expect(report.tables[0]?.sides[1]).toMatchObject({
      outcome: 'failed',
      error: 'AccessDeniedException: not a contributor',
    });
    expect(h.saved.get('sales.orders')?.left[smusSide('a')]).toBeUndefined();

    h.dataZone.reviseAsset.mockResolvedValue(undefined);
    const again = await h.service.run(pass('run', [listing('a')]));
    expect(again.tables[0]?.sides[1]?.outcome).toBe('written');
  });

  it('skips a view and a missing table without failing the pass', async () => {
    h.glue.getTable.mockImplementation(async (_db: string, name: string) =>
      name === 'orders' ? { ...glueTable(), ViewDefinition: {} } : null
    );
    h.dataZone.getAsset.mockResolvedValue(asset('a', 'The order.'));

    const report = await h.service.run(pass('run', [listing('a'), listing('b', 'customers')]));

    expect(report.totals).toMatchObject({ tables: 2, failed: 0 });
    expect(h.glue.updateTable).not.toHaveBeenCalled();
  });
});
