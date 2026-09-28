/**
 * The real catalog for a test file, on its own table in the run's DynamoDB
 * Local: call `useTestCatalog()` at the top of a file, then `seed` what the
 * test needs. Each test starts from an empty catalog. Tests read and write
 * through `catalog` exactly as the code does, so there is nothing to mock.
 */
import { afterAll, beforeAll, beforeEach } from 'vitest';

import type { AssetType, CatalogEntry } from '../../models/asset.model';
import { exportFilePath } from '../../services/catalog/catalogEntry';
import { catalog } from '../../services/catalog/catalogStore';
import { type PortalTestTable, startPortalTestTable } from './portalTestTable';

const T0 = new Date('2026-09-01T00:00:00.000Z');

/** A complete catalog entry; anything in `extra` replaces the default. */
export function catalogEntry(
  assetType: AssetType,
  assetId: string,
  extra: Partial<CatalogEntry> = {}
): CatalogEntry {
  const state = extra.status === 'archived' ? 'archived' : 'live';
  return {
    assetId,
    assetType,
    assetName: assetId,
    arn: `arn:aws:quicksight:us-east-1:123456789012:${assetType}/${assetId}`,
    status: 'active',
    enrichmentStatus: 'enriched',
    createdTime: T0,
    lastUpdatedTime: T0,
    exportedAt: T0,
    exportFilePath: exportFilePath(assetType, assetId, state),
    storageType: 'individual',
    tags: [],
    permissions: [],
    metadata: {},
    ...extra,
  };
}

export function useTestCatalog(): { seed: (entries: CatalogEntry[]) => Promise<void> } {
  let table: PortalTestTable;
  beforeAll(async () => {
    table = await startPortalTestTable();
  });
  afterAll(async () => {
    await table.stop();
  });
  beforeEach(async () => {
    await catalog.clear();
  });
  return {
    seed: (entries) => catalog.put(entries),
  };
}
