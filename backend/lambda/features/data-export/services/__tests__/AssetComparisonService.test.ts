import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CatalogEntry } from '../../../../shared/models/asset.model';
import { rebuildCatalogType } from '../../../../shared/services/catalog/catalogBuilder';
import { catalog } from '../../../../shared/services/catalog/catalogStore';
import { PARSER_METADATA_VERSION } from '../../../../shared/services/parsing/parserVersion';
import { logger } from '../../../../shared/utils/logger';
import { catalogEntry, useTestCatalog } from '../../../../shared/utils/testUtils/testCatalog';
import { AssetComparisonService } from '../AssetComparisonService';

vi.mock('../../../../shared/utils/logger');
// Hydration re-parses exported files from S3; the tests decide what it finds
vi.mock('../../../../shared/services/catalog/catalogBuilder', () => ({
  rebuildCatalogType: vi.fn(),
}));

const { seed } = useTestCatalog();

const at = (iso: string) => new Date(iso);
const current = { metadata: { parserVersion: PARSER_METADATA_VERSION } };

describe('AssetComparisonService', () => {
  let service: AssetComparisonService;
  const MOCK_ASSETS_COUNT = 3;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.mocked(rebuildCatalogType).mockResolvedValue(undefined);
    service = new AssetComparisonService();
  });

  const mockAssets: any[] = [
    { id: 'asset1', name: 'Asset 1', lastModified: '2025-01-15T10:00:00Z' },
    { id: 'asset2', name: 'Asset 2', lastModified: '2025-01-15T11:00:00Z' },
    { id: 'asset3', name: 'Asset 3', lastModified: undefined },
  ];

  const cachedAsset1And2 = (type: CatalogEntry['assetType']) => [
    catalogEntry(type, 'asset1', { lastUpdatedTime: at('2025-01-15T09:00:00Z'), ...current }),
    catalogEntry(type, 'asset2', { lastUpdatedTime: at('2025-01-15T11:00:00Z'), ...current }),
  ];

  describe('compareAndDetectChanges', () => {
    describe('with forceRefresh', () => {
      it('marks all assets as needing update without hydrating', async () => {
        await seed(cachedAsset1And2('dashboard'));

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], true);

        expect(result.needsUpdate).toEqual(new Set(['asset1', 'asset2', 'asset3']));
        expect(result.unchanged.size).toBe(0);
        expect(rebuildCatalogType).not.toHaveBeenCalled();
      });
    });

    describe('organizational assets', () => {
      it.each(['user', 'group', 'folder'] as const)(
        'always marks %s as needing update',
        async (type) => {
          await seed(cachedAsset1And2(type));

          const result = await service.compareAndDetectChanges(type, mockAssets, [], false);

          expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
          expect(result.unchanged.size).toBe(0);
          expect(logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('always refresh (organizational asset)')
          );
        }
      );
    });

    describe('regular assets with timestamps', () => {
      it('detects updated assets based on timestamps', async () => {
        await seed(cachedAsset1And2('dashboard'));

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        // asset1: modified (10:00) after cached (09:00)
        expect(result.needsUpdate.has('asset1')).toBe(true);
        // asset2: same time
        expect(result.unchanged.has('asset2')).toBe(true);
        // asset3: not in the catalog
        expect(result.needsUpdate.has('asset3')).toBe(true);
      });

      it('re-exports unchanged, unenriched assets whose metadata predates the parser version', async () => {
        await seed([
          catalogEntry('dashboard', 'asset1', {
            lastUpdatedTime: at('2025-01-15T10:00:00Z'),
            enrichmentStatus: 'skeleton',
          }),
        ]);

        const result = await service.compareAndDetectChanges(
          'dashboard',
          [{ id: 'asset1', name: 'Asset 1', lastModified: '2025-01-15T10:00:00Z' }] as any,
          [],
          false
        );

        expect(result.needsUpdate.has('asset1')).toBe(true);
        expect(result.needsReparse.has('asset1')).toBe(false);
      });

      it('re-parses (no API calls) enriched unchanged assets with stale parser metadata', async () => {
        await seed([
          catalogEntry('dashboard', 'asset1', {
            lastUpdatedTime: at('2025-01-15T10:00:00Z'),
            enrichmentStatus: 'enriched',
            metadata: { parserVersion: PARSER_METADATA_VERSION - 1 },
          }),
        ]);

        const result = await service.compareAndDetectChanges(
          'dashboard',
          [{ id: 'asset1', name: 'Asset 1', lastModified: '2025-01-15T10:00:00Z' }] as any,
          [],
          false
        );

        expect(result.needsReparse.has('asset1')).toBe(true);
        expect(result.needsUpdate.has('asset1')).toBe(false);
      });

      it('re-exports an asset QuickSight lists without a timestamp', async () => {
        await seed([catalogEntry('dashboard', 'asset1', current)]);

        const result = await service.compareAndDetectChanges(
          'dashboard',
          [{ id: 'asset1', name: 'Asset 1' }] as any,
          [],
          false
        );

        expect(result.needsUpdate.has('asset1')).toBe(true);
      });
    });

    describe('deleted assets', () => {
      it('returns assets in the catalog but not in QuickSight, without changing the catalog', async () => {
        await seed([catalogEntry('dashboard', 'deleted1'), ...cachedAsset1And2('dashboard')]);

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        expect(result.deletedAssetIds).toEqual(new Set(['deleted1']));
        // Archiving is the orchestrator's job
        expect((await catalog.get('dashboard', 'deleted1'))?.status).toBe('active');
      });

      it('does not mark already archived assets as deleted', async () => {
        await seed([
          catalogEntry('dashboard', 'already-archived', { status: 'archived' }),
          ...cachedAsset1And2('dashboard'),
        ]);

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        expect(result.deletedAssetIds.size).toBe(0);
      });

      it('treats an archived entry whose file never moved to archived/ as deleted', async () => {
        await seed([
          catalogEntry('dashboard', 'stuck', {
            status: 'archived',
            exportFilePath: 'assets/dashboards/stuck.json',
          }),
          ...cachedAsset1And2('dashboard'),
        ]);

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        expect(result.deletedAssetIds).toEqual(new Set(['stuck']));
      });

      it('handles soft-deleted analyses', async () => {
        await seed([catalogEntry('analysis', 'soft-deleted1'), ...cachedAsset1And2('analysis')]);

        const result = await service.compareAndDetectChanges(
          'analysis',
          [...mockAssets, { id: 'soft-deleted1', name: 'Soft Deleted Analysis' }],
          [{ AnalysisId: 'soft-deleted1', Name: 'Soft Deleted Analysis', Status: 'DELETED' }],
          false
        );

        expect(result.deletedAssetIds).toEqual(new Set(['soft-deleted1']));
      });

      it('detects only active assets as deleted when nothing is left in QuickSight', async () => {
        await seed([
          catalogEntry('dashboard', 'active1'),
          catalogEntry('dashboard', 'archived1', { status: 'archived' }),
          catalogEntry('dashboard', 'active2'),
        ]);

        const result = await service.compareAndDetectChanges('dashboard', [], [], false);

        expect(result.deletedAssetIds).toEqual(new Set(['active1', 'active2']));
      });
    });

    describe('empty catalog', () => {
      it('hydrates from the S3 exports, and exports everything when there are none', async () => {
        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        expect(rebuildCatalogType).toHaveBeenCalledWith('dashboard', undefined);
        expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
        expect(result.unchanged.size).toBe(0);
        expect(service.getHydratedTypes()).toEqual([]);
      });

      it('compares incrementally against what hydration restored', async () => {
        vi.mocked(rebuildCatalogType).mockImplementation(async (type) => {
          await catalog.put(cachedAsset1And2(type));
        });

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        expect(service.getHydratedTypes()).toEqual(['dashboard']);
        expect(result.unchanged).toEqual(new Set(['asset2']));
        expect(result.needsUpdate).toEqual(new Set(['asset1', 'asset3']));
      });

      it('falls back to a full export when hydration fails', async () => {
        vi.mocked(rebuildCatalogType).mockRejectedValue(new Error('S3 down'));

        const result = await service.compareAndDetectChanges('dashboard', mockAssets, [], false);

        expect(result.needsUpdate.size).toBe(MOCK_ASSETS_COUNT);
        expect(service.getHydratedTypes()).toEqual([]);
      });

      it('handles an empty assets list', async () => {
        await seed(cachedAsset1And2('dashboard'));

        const result = await service.compareAndDetectChanges('dashboard', [], [], false);

        expect(result.needsUpdate.size).toBe(0);
        expect(result.unchanged.size).toBe(0);
        expect(result.deletedAssetIds).toEqual(new Set(['asset1', 'asset2']));
      });
    });
  });

  describe('detectDeletedAssets', () => {
    it('returns asset IDs in the catalog but not in the current list', async () => {
      await seed(
        ['asset1', 'asset2', 'deleted1', 'deleted2'].map((id) => catalogEntry('dashboard', id))
      );

      const deletedIds = await service.detectDeletedAssets(
        'dashboard',
        [
          { id: 'asset1', name: 'Asset 1' },
          { id: 'asset2', name: 'Asset 2' },
        ],
        []
      );

      expect(deletedIds).toEqual(new Set(['deleted1', 'deleted2']));
    });

    it('includes soft-deleted analyses', async () => {
      await seed([catalogEntry('analysis', 'asset1'), catalogEntry('analysis', 'soft1')]);

      const deletedIds = await service.detectDeletedAssets(
        'analysis',
        [
          { id: 'asset1', name: 'Asset 1' },
          { id: 'soft1', name: 'Soft 1' },
        ],
        [
          {
            analysisId: 'soft1',
            name: 'Soft 1',
            arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/soft1',
            createdTime: new Date(),
            lastUpdatedTime: new Date(),
            status: 'DELETED',
          },
        ] as any
      );

      expect(deletedIds).toEqual(new Set(['soft1']));
    });

    it('does not include already archived assets', async () => {
      await seed([
        catalogEntry('dashboard', 'active1'),
        catalogEntry('dashboard', 'archived1', { status: 'archived' }),
        catalogEntry('dashboard', 'deleted1'),
      ]);

      const deletedIds = await service.detectDeletedAssets(
        'dashboard',
        [{ id: 'active1', name: 'Active 1' }],
        []
      );

      expect(deletedIds).toEqual(new Set(['deleted1']));
    });

    it('handles catalog errors gracefully', async () => {
      vi.spyOn(catalog, 'snapshot').mockRejectedValueOnce(new Error('Catalog error'));

      const deletedIds = await service.detectDeletedAssets('dashboard', [], []);

      expect(deletedIds).toEqual(new Set());
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to detect deleted dashboard assets:',
        expect.any(Error)
      );
    });

    it('returns nothing when the catalog has no entries of the type', async () => {
      await seed([catalogEntry('dataset', 'ds1')]);

      expect(await service.detectDeletedAssets('dashboard', [], [])).toEqual(new Set());
    });
  });

  describe('integration scenarios', () => {
    it('handles a complete export cycle with additions, updates and deletions', async () => {
      const t = at('2025-01-01T10:00:00Z');
      await seed(
        ['unchanged1', 'updated1', 'deleted1', 'deleted2'].map((id) =>
          catalogEntry('dashboard', id, { lastUpdatedTime: t, ...current })
        )
      );

      const result = await service.compareAndDetectChanges(
        'dashboard',
        [
          { id: 'unchanged1', name: 'Unchanged 1', lastModified: '2025-01-01T10:00:00Z' },
          { id: 'updated1', name: 'Updated 1', lastModified: '2025-01-02T10:00:00Z' },
          { id: 'new1', name: 'New 1', lastModified: '2025-01-02T10:00:00Z' },
        ] as any,
        [],
        false
      );

      expect(result.unchanged).toEqual(new Set(['unchanged1']));
      expect(result.needsUpdate).toEqual(new Set(['updated1', 'new1']));
      expect(result.deletedAssetIds).toEqual(new Set(['deleted1', 'deleted2']));
    });

    it('detects deletions of organizational assets while refreshing the rest', async () => {
      await seed(['folder1', 'folder2', 'deleted-folder'].map((id) => catalogEntry('folder', id)));

      const result = await service.compareAndDetectChanges(
        'folder',
        [
          { id: 'folder1', name: 'Folder 1' },
          { id: 'folder2', name: 'Folder 2' },
        ] as any,
        [],
        false
      );

      expect(result.needsUpdate).toEqual(new Set(['folder1', 'folder2']));
      expect(result.deletedAssetIds).toEqual(new Set(['deleted-folder']));
    });
  });
});
