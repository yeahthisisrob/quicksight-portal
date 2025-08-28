import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ASSET_TYPES } from '../../../../shared/types/assetTypes';
import { CatalogService } from '../CatalogService';

// Test constants
const EXPECTED_VISUAL_FIELDS = 6;
const EXPECTED_CALC_FIELDS = 2;
const EXPECTED_REGULAR_FIELDS = 4;
const EXPECTED_TAGS_COUNT = 3;
const DEFAULT_PAGE_SIZE = 10;
const OUT_OF_RANGE_PAGE = 10;

vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: {
    getAssets: vi.fn().mockResolvedValue({
      assets: [
        {
          assetId: 'dash-1',
          assetName: 'Dashboard 1',
          assetType: 'dashboard',
          status: 'PUBLISHED',
          tags: [],
          metadata: {
            sheets: [
              {
                sheetId: 'sheet-1',
                name: 'Sheet 1',
                visuals: [
                  { visualId: 'visual-1', title: 'Visual 1', type: 'LINE_CHART' },
                  { visualId: 'visual-2', title: 'Visual 2', type: 'BAR_CHART' },
                ],
              },
            ],
            fields: [
              { fieldName: 'field1', dataType: 'STRING', fieldId: 'f1' },
              { fieldName: 'field2', dataType: 'INTEGER', fieldId: 'f2' },
            ],
            calculatedFields: [
              { fieldName: 'calc1', dataType: 'DECIMAL', expression: 'sum(field1)' },
            ],
          },
        },
        {
          assetId: 'ds-1',
          assetName: 'Dataset 1',
          assetType: 'dataset',
          status: 'PUBLISHED',
          tags: [],
          metadata: {
            dataSourceArn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/ds-1',
            columns: [
              { name: 'col1', type: 'STRING' },
              { name: 'col2', type: 'INTEGER' },
              { name: 'col3', type: 'DECIMAL' },
            ],
          },
        },
      ],
      total: 2,
      lastUpdated: new Date().toISOString(),
    }),
    searchFields: vi.fn().mockResolvedValue([
      {
        fieldName: 'field1',
        sourceAssetId: 'ds-1',
        sourceAssetType: 'dataset',
        dataType: 'STRING',
        isCalculated: false,
      },
      {
        fieldName: 'field2',
        sourceAssetId: 'ds-1',
        sourceAssetType: 'dataset',
        dataType: 'INTEGER',
        isCalculated: false,
      },
    ]),
    clearMemoryCache: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../organization/services/FolderService', () => ({
  FolderService: vi.fn().mockImplementation(() => ({
    getFolderMemberships: vi.fn().mockResolvedValue({
      'dash-1': ['folder-1', 'folder-2'],
      'ds-1': ['folder-1'],
    }),
    getExcludedAssets: vi.fn().mockResolvedValue(new Set()),
  })),
}));

vi.mock('../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('CatalogService - Visual Field Catalog', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService();
  });

  describe('buildVisualFieldCatalog', () => {
    it('should build visual field catalog successfully', async () => {
      const result = await service.buildVisualFieldCatalog();

      expect(result.visualFields).toHaveLength(EXPECTED_VISUAL_FIELDS);
      expect(result.summary.totalVisuals).toBe(2);
      expect(result.summary.totalSheets).toBe(1);
      expect(result.summary.totalDashboards).toBe(1);
      expect(result.summary.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should correctly identify calculated fields', async () => {
      const result = await service.buildVisualFieldCatalog();

      const calculatedFields = result.visualFields.filter((f) => f.isCalculated);
      const regularFields = result.visualFields.filter((f) => !f.isCalculated);

      expect(calculatedFields).toHaveLength(EXPECTED_CALC_FIELDS);
      expect(regularFields).toHaveLength(EXPECTED_REGULAR_FIELDS);
      expect(calculatedFields[0]?.fieldName).toBe('calc1');
    });

    it('should handle assets without sheets gracefully', async () => {
      const { cacheService } = await import('../../../../shared/services/cache/CacheService');
      (cacheService.getAssets as any).mockResolvedValueOnce({
        assets: [
          {
            assetId: 'dash-2',
            assetName: 'Dashboard 2',
            assetType: 'dashboard',
            metadata: {},
          },
        ],
        total: 1,
        lastUpdated: new Date().toISOString(),
      });

      const result = await service.buildVisualFieldCatalog();

      expect(result.visualFields).toHaveLength(0);
      expect(result.summary.totalVisuals).toBe(0);
      expect(result.summary.totalSheets).toBe(0);
    });
  });
});

describe('CatalogService - Tags and Stats', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService();
  });

  describe('getAvailableTags', () => {
    it('should get available tags from assets', async () => {
      const { cacheService } = await import('../../../../shared/services/cache/CacheService');
      (cacheService.getAssets as any).mockResolvedValueOnce({
        assets: [
          {
            assetId: 'dash-1',
            assetType: 'dashboard',
            tags: [
              { key: 'finance', value: 'Finance' },
              { key: 'sales', value: 'Sales' },
            ],
          },
          {
            assetId: 'ds-1',
            assetType: 'dataset',
            tags: [
              { key: 'marketing', value: 'Marketing' },
              { key: 'sales', value: 'Sales' },
            ],
          },
        ],
        total: 2,
        lastUpdated: new Date().toISOString(),
      });

      const tags = await service.getAvailableTags();

      expect(tags.find((t) => t.key === 'finance')).toBeDefined();
      expect(tags.find((t) => t.key === 'sales')).toBeDefined();
      expect(tags.find((t) => t.key === 'marketing')).toBeDefined();
      expect(tags).toHaveLength(EXPECTED_TAGS_COUNT);
    });

    it('should filter out excluded tags', async () => {
      const { cacheService } = await import('../../../../shared/services/cache/CacheService');
      (cacheService.getAssets as any).mockResolvedValueOnce({
        assets: [
          {
            assetId: 'dash-1',
            assetType: 'dashboard',
            tags: [
              { key: 'finance', value: 'Finance' },
              { key: 'quicksight:source', value: 'Source' },
              { key: 'quicksight:internal', value: 'Internal' },
            ],
          },
        ],
        total: 1,
        lastUpdated: new Date().toISOString(),
      });

      const tags = await service.getAvailableTags();

      expect(tags.find((t) => t.key === 'finance')).toBeDefined();
      expect(tags.find((t) => t.key === 'quicksight:source')).toBeUndefined();
      expect(tags.find((t) => t.key === 'quicksight:internal')).toBeUndefined();
    });
  });

  describe('getCatalogStats', () => {
    it('should get catalog statistics successfully', async () => {
      const stats = await service.getCatalogStats();

      expect(stats.totalAssets).toBeGreaterThanOrEqual(0);
      expect(stats.assetsByType).toBeDefined();
      expect(stats.totalFields).toBeGreaterThanOrEqual(0);
      expect(stats.totalTags).toBeGreaterThanOrEqual(0);
      expect(stats.lastUpdated).toBeDefined();
    });

    it('should correctly count assets by type', async () => {
      const { cacheService } = await import('../../../../shared/services/cache/CacheService');
      (cacheService.getAssets as any).mockResolvedValueOnce({
        assets: [
          { assetType: ASSET_TYPES.dataset },
          { assetType: ASSET_TYPES.dataset },
          { assetType: ASSET_TYPES.datasource },
          { assetType: ASSET_TYPES.dashboard },
        ],
        total: 4,
        lastUpdated: new Date().toISOString(),
      });

      const stats = await service.getCatalogStats();

      expect(stats.assetsByType[ASSET_TYPES.dataset]).toBe(2);
      expect(stats.assetsByType[ASSET_TYPES.datasource]).toBe(1);
    });
  });

  describe('getCatalogSummary', () => {
    it('should get catalog summary successfully', async () => {
      const summary = await service.getCatalogSummary();

      expect(summary.totalAssets).toBeGreaterThanOrEqual(0);
      expect(summary.totalFields).toBeGreaterThanOrEqual(0);
      expect(summary.lastUpdated).toBeDefined();
    });
  });

  describe('getDataCatalog', () => {
    it('should get data catalog without tag filter', async () => {
      const catalog = await service.getDataCatalog();

      expect(catalog).toBeDefined();
      expect(catalog?.fields).toHaveLength(2);
      expect(catalog?.summary.totalFields).toBe(2);
      expect(catalog?.summary).toBeDefined();
    });

    it('should filter catalog by tags when provided', async () => {
      const catalog = await service.getDataCatalog({ key: 'finance', value: 'Finance' });

      expect(catalog).toBeDefined();
    });

    it('should return empty catalog when no fields available', async () => {
      const { cacheService } = await import('../../../../shared/services/cache/CacheService');
      (cacheService.searchFields as any).mockResolvedValueOnce([]);

      const catalog = await service.getDataCatalog();

      expect(catalog).toBeDefined();
      expect(catalog?.fields).toEqual([]);
      expect(catalog?.summary.totalFields).toBe(0);
    });
  });
});

describe('CatalogService - Pagination', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService();
  });

  describe('getFieldsPaginated', () => {
    it('should get paginated fields with default parameters', async () => {
      const result = await service.getFieldsPaginated(1, DEFAULT_PAGE_SIZE);

      expect(result.fields).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should filter fields by asset type', async () => {
      const filters = { assetType: 'dataset' };
      const result = await service.getFieldsPaginated(1, DEFAULT_PAGE_SIZE, filters);

      expect(result.fields).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should filter fields by data type', async () => {
      const filters = { dataType: 'STRING' };
      const result = await service.getFieldsPaginated(1, DEFAULT_PAGE_SIZE, filters);

      expect(result.fields).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should filter calculated fields', async () => {
      const filters = { isCalculated: true };
      const result = await service.getFieldsPaginated(1, DEFAULT_PAGE_SIZE, filters);

      expect(result.fields).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should search fields by query', async () => {
      const filters = { query: 'field1' };
      const result = await service.getFieldsPaginated(1, DEFAULT_PAGE_SIZE, filters);

      expect(result.fields).toBeDefined();
      expect(result.pagination.page).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const result = await service.getFieldsPaginated(2, 1);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(1);
      expect(result.fields).toHaveLength(1);
    });

    it('should return empty items for out of range page', async () => {
      const result = await service.getFieldsPaginated(OUT_OF_RANGE_PAGE, DEFAULT_PAGE_SIZE);

      expect(result.fields).toHaveLength(0);
      expect(result.pagination.page).toBe(OUT_OF_RANGE_PAGE);
      expect(result.pagination.totalItems).toBe(2);
    });
  });
});

describe('CatalogService - Private Methods', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService();
  });

  it('should get all assets from cache', async () => {
    const assets = await (service as any).getAllAssets();

    expect(assets).toHaveLength(2);
    expect(assets[0].assetId).toBe('dash-1');
    expect(assets[1].assetId).toBe('ds-1');
  });

  it('should handle cache errors gracefully', async () => {
    const { cacheService } = await import('../../../../shared/services/cache/CacheService');
    (cacheService.getAssets as any).mockRejectedValueOnce(new Error('Cache error'));

    await expect((service as any).getAllAssets()).rejects.toThrow('Cache error');
  });
});
