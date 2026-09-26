import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheWriter } from '../CacheWriter';

// Test constants to avoid magic numbers
const EXPECTED_PERMISSION_COUNT_THREE = 3;
const EXPECTED_PERMISSION_COUNT_TWO = 2;
const EXPECTED_USER_COUNT = 1;
const EXPECTED_GROUP_COUNT = 1;
const EXPECTED_NAMESPACE_COUNT = 1;

// Mock services
const mockS3Adapter = {
  saveCache: vi.fn(),
  saveFieldCache: vi.fn(),
  clearAllCaches: vi.fn(),
  getCacheMetadata: vi.fn(),
};

const mockMemoryAdapter = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
};

const mockS3Service = {
  getObject: vi.fn(),
  putObject: vi.fn(),
  listObjects: vi.fn(),
};

describe('CacheWriter - transformPermissions camelCase', () => {
  let cacheWriter: CacheWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheWriter = new CacheWriter(
      mockS3Adapter as any,
      mockMemoryAdapter as any,
      mockS3Service,
      'test-bucket'
    );
  });

  it('should handle regular permissions', () => {
    const permissions = {
      permissions: [
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
          actions: ['VIEW', 'EDIT'],
        },
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group1',
          actions: ['VIEW'],
        },
      ],
    };

    const result = (cacheWriter as any).transformPermissions(permissions);

    expect(result).toHaveLength(EXPECTED_PERMISSION_COUNT_TWO);
    expect(result[0]).toEqual({
      principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
      principalType: 'USER',
      actions: ['VIEW', 'EDIT'],
    });
    expect(result[1]).toEqual({
      principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group1',
      principalType: 'GROUP',
      actions: ['VIEW'],
    });
  });

  it('should handle linkSharingConfiguration', () => {
    const permissions = {
      permissions: [
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
          actions: ['VIEW'],
        },
      ],
      linkSharingConfiguration: {
        permissions: [
          {
            principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
            actions: ['VIEW'],
          },
          {
            principal: '*',
            actions: ['VIEW'],
          },
        ],
      },
    };

    const result = (cacheWriter as any).transformPermissions(permissions);

    expect(result).toHaveLength(EXPECTED_PERMISSION_COUNT_THREE);
    expect(result[0]).toEqual({
      principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
      principalType: 'USER',
      actions: ['VIEW'],
    });
    expect(result[1]).toEqual({
      principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
      principalType: 'NAMESPACE',
      actions: ['VIEW'],
    });
    expect(result[2]).toEqual({
      principal: '*',
      principalType: 'PUBLIC',
      actions: ['VIEW'],
    });
  });

  it('should handle combined permissions', () => {
    const permissions = {
      permissions: [
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
          actions: ['VIEW', 'EDIT'],
        },
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/admins',
          actions: ['VIEW', 'EDIT', 'DELETE'],
        },
      ],
      linkSharingConfiguration: {
        permissions: [
          {
            principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
            actions: ['VIEW'],
          },
        ],
      },
    };

    const result = (cacheWriter as any).transformPermissions(permissions);

    expect(result).toHaveLength(EXPECTED_PERMISSION_COUNT_THREE);
    expect(result.filter((p: any) => p.principalType === 'USER')).toHaveLength(EXPECTED_USER_COUNT);
    expect(result.filter((p: any) => p.principalType === 'GROUP')).toHaveLength(
      EXPECTED_GROUP_COUNT
    );
    expect(result.filter((p: any) => p.principalType === 'NAMESPACE')).toHaveLength(
      EXPECTED_NAMESPACE_COUNT
    );
  });
});

describe('CacheWriter - transformPermissions legacy', () => {
  let cacheWriter: CacheWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheWriter = new CacheWriter(
      mockS3Adapter as any,
      mockMemoryAdapter as any,
      mockS3Service,
      'test-bucket'
    );
  });

  it('should handle legacy array format', () => {
    const permissions = [
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
        actions: ['VIEW'],
      },
      {
        principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group1',
        actions: ['EDIT'],
      },
    ];

    const result = (cacheWriter as any).transformPermissions(permissions);

    expect(result).toHaveLength(EXPECTED_PERMISSION_COUNT_TWO);
    expect(result[0].principalType).toBe('USER');
    expect(result[1].principalType).toBe('GROUP');
  });

  it('should handle null permissions', () => {
    const result = (cacheWriter as any).transformPermissions(null);
    expect(result).toEqual([]);
  });

  it('should handle undefined permissions', () => {
    const result = (cacheWriter as any).transformPermissions(undefined);
    expect(result).toEqual([]);
  });

  it('should handle empty object', () => {
    const result = (cacheWriter as any).transformPermissions({});
    expect(result).toEqual([]);
  });

  it('should handle object with empty arrays', () => {
    const permissions = {
      permissions: [],
      linkSharingConfiguration: {
        permissions: [],
      },
    };

    const result = (cacheWriter as any).transformPermissions(permissions);
    expect(result).toEqual([]);
  });
});

describe('CacheWriter - transformPermissions edge cases', () => {
  let cacheWriter: CacheWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheWriter = new CacheWriter(
      mockS3Adapter as any,
      mockMemoryAdapter as any,
      mockS3Service,
      'test-bucket'
    );
  });

  it('should handle missing principal gracefully', () => {
    const permissions = {
      permissions: [
        {
          actions: ['VIEW'],
        },
      ],
    };

    const result = (cacheWriter as any).transformPermissions(permissions);

    expect(result).toHaveLength(EXPECTED_USER_COUNT);
    expect(result[0].principal).toBe('');
    expect(result[0].principalType).toBeDefined();
  });

  it('should handle missing actions gracefully', () => {
    const permissions = {
      permissions: [
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
        },
      ],
    };

    const result = (cacheWriter as any).transformPermissions(permissions);

    expect(result).toHaveLength(EXPECTED_USER_COUNT);
    expect(result[0].actions).toEqual([]);
  });

  it('should not deduplicate permissions with different actions', () => {
    const permissions = {
      permissions: [
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
          actions: ['VIEW'],
        },
      ],
      linkSharingConfiguration: {
        permissions: [
          {
            principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
            actions: ['EDIT'],
          },
        ],
      },
    };

    const result = (cacheWriter as any).transformPermissions(permissions);

    expect(result).toHaveLength(EXPECTED_PERMISSION_COUNT_TWO);
    expect(result[0].principal).toBe('arn:aws:quicksight:us-east-1:123456789012:namespace/default');
    expect(result[0].actions).toEqual(['VIEW']);
    expect(result[1].principal).toBe('arn:aws:quicksight:us-east-1:123456789012:namespace/default');
    expect(result[1].actions).toEqual(['EDIT']);
  });
});

describe('CacheWriter - processActiveAssetsWithMerge', () => {
  let cacheWriter: CacheWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheWriter = new CacheWriter(
      mockS3Adapter as any,
      mockMemoryAdapter as any,
      mockS3Service,
      'test-bucket'
    );
  });

  it('should merge metadata updates with existing cache data', async () => {
    const existingAsset = {
      assetId: 'test-id',
      assetName: 'Test Dashboard',
      assetType: 'dashboard',
      status: 'active',
      createdTime: new Date('2024-01-01'),
      lastUpdatedTime: new Date('2024-01-15'),
      enrichmentStatus: 'enriched',
      enrichmentTimestamps: {
        describe: new Date('2024-01-15'),
        definition: new Date('2024-01-15'),
      },
      metadata: {
        sheets: ['Sheet1', 'Sheet2'],
        datasets: ['dataset1'],
      },
      permissions: [],
      tags: [],
    };

    const existingEntriesMap = new Map();
    existingEntriesMap.set('test-id', existingAsset);

    // Mock createCacheEntryFromAsset to return a metadata-update asset

    // Mock the private method that creates cache entries
    (cacheWriter as any).createCacheEntryFromAsset = vi.fn().mockResolvedValue({
      assetId: 'test-id',
      assetName: 'Test Dashboard',
      assetType: 'dashboard',
      status: 'active',
      createdTime: new Date('2024-01-01'),
      lastUpdatedTime: new Date('2024-01-15'),
      enrichmentStatus: 'metadata-update',
      enrichmentTimestamps: {
        permissions: new Date('2024-02-01'),
      },
      metadata: {},
      permissions: [
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
          principalType: 'USER',
          actions: ['VIEW'],
        },
        {
          principal: 'arn:aws:quicksight:us-east-1:123456789012:namespace/default',
          principalType: 'NAMESPACE',
          actions: ['VIEW'],
        },
      ],
      tags: [],
      exportedAt: new Date('2024-02-01'),
    });

    const result = await (cacheWriter as any).processActiveAssetsWithMerge(
      'dashboard',
      ['test-id'],
      existingEntriesMap
    );

    // Verify the merge preserved existing data
    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
    expect(result[0].metadata.sheets).toEqual(['Sheet1', 'Sheet2']);
    expect(result[0].metadata.datasets).toEqual(['dataset1']);
    expect(result[0].enrichmentStatus).toBe('enriched'); // Should preserve existing enrichment status
    expect(result[0].permissions).toHaveLength(EXPECTED_PERMISSION_COUNT_TWO);
  });
});

/**
 * A dataset's calculated fields reach the field cache through
 * metadata.calculatedFields, which the dataset parser used to write as
 * { name, expression } while the dashboard parser wrote the full field shape.
 * The field cache keys on fieldId and the catalog groups on fieldName, so the
 * short shape cost a dataset every calculated field it had.
 */
describe('CacheWriter - calculated fields reaching the field cache', () => {
  let cacheWriter: CacheWriter;

  const datasetEntry = (calculatedFields: unknown[]) => ({
    assetId: 'ds-1',
    assetName: 'Sales (gold)',
    lastUpdatedTime: new Date('2026-09-19T00:00:00Z'),
    tags: [],
    metadata: {
      fields: [
        { fieldId: 'revenue', fieldName: 'revenue', dataType: 'DECIMAL' },
        { fieldId: 'margin', fieldName: 'margin', dataType: 'DECIMAL' },
      ],
      calculatedFields,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cacheWriter = new CacheWriter(
      mockS3Adapter as any,
      mockMemoryAdapter as any,
      mockS3Service,
      'test-bucket'
    );
  });

  const rebuild = async (calculatedFields: unknown[]) => {
    vi.spyOn((cacheWriter as any).cacheReader, 'getCacheEntries').mockImplementation(
      async (...args: unknown[]) =>
        (args[0] as { assetType: string }).assetType === 'dataset'
          ? [datasetEntry(calculatedFields)]
          : []
    );
    await cacheWriter.updateFieldCache(null);
    return (mockS3Adapter.saveFieldCache.mock.calls[0]?.[0] ?? []) as any[];
  };

  it('keeps every calculated field a dataset declares, named and keyed', async () => {
    const fields = await rebuild([
      { name: 'margin', expression: '{revenue} - {cost}' },
      { name: 'margin_pct', expression: '{margin} / {revenue}' },
      { name: 'runway', expression: '{cash} / {burn}' },
    ]);

    const calculated = fields.filter((f) => f.isCalculated);
    expect(calculated.map((f) => f.fieldName).sort()).toEqual(['margin', 'margin_pct', 'runway']);
    // Every one needs an expression and a name to be grouped by the catalog.
    expect(calculated.every((f) => f.expression && f.fieldName)).toBe(true);
    // ... and its own cache key, or they overwrite each other.
    expect(new Set(calculated.map((f) => f.fieldId)).size).toBe(calculated.length);
  });

  it('reads the full field shape a dashboard writes just the same', async () => {
    const fields = await rebuild([
      {
        fieldId: 'cf-1',
        fieldName: 'margin',
        displayName: 'Margin',
        dataType: 'DECIMAL',
        expression: '{revenue} - {cost}',
      },
    ]);

    expect(fields.filter((f) => f.isCalculated)).toEqual([
      expect.objectContaining({ fieldId: 'cf-1', fieldName: 'margin', dataType: 'DECIMAL' }),
    ]);
  });

  it('drops a field with no name at all rather than letting it collide', async () => {
    const fields = await rebuild([
      { expression: '{a} + 1' },
      { name: 'real', expression: '{b} + 1' },
    ]);
    expect(fields.filter((f) => f.isCalculated).map((f) => f.fieldName)).toEqual(['real']);
  });
});

describe('CacheWriter - live and archived entries of one id', () => {
  let cacheWriter: CacheWriter;
  let saved: any[] | null;
  const t = (iso: string) => new Date(iso);
  const live = {
    assetId: 'g1',
    assetType: 'group',
    assetName: 'analysts',
    status: 'active',
    lastUpdatedTime: t('2026-09-01'),
    metadata: { description: 'old', members: ['ann', 'rob'] },
  };
  const archived = {
    assetId: 'g1',
    assetType: 'group',
    assetName: 'analysts',
    status: 'archived',
    lastUpdatedTime: t('2026-08-01'),
    metadata: { archived: { archivedAt: '2026-08-01' } },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    saved = null;
    cacheWriter = new CacheWriter(
      mockS3Adapter as any,
      mockMemoryAdapter as any,
      mockS3Service,
      'test-bucket'
    );
    vi.spyOn(cacheWriter as any, 'loadTypeCache').mockResolvedValue([live, archived]);
    vi.spyOn(cacheWriter as any, 'saveTypeCache').mockImplementation(async (_type, entries) => {
      saved = entries as any[];
    });
    vi.spyOn(cacheWriter as any, 'updateCacheMetadata').mockResolvedValue(undefined);
  });

  it('updateAsset patches the live entry only, merges its metadata, and touches one type', async () => {
    const getMaster = vi.spyOn(cacheWriter as any, 'getMasterCache');

    await cacheWriter.updateAsset('group', 'g1', { metadata: { description: 'new' } } as any);

    expect(getMaster).not.toHaveBeenCalled();
    const byStatus = Object.fromEntries((saved ?? []).map((e) => [e.status, e]));
    expect(byStatus.active.metadata).toEqual({ description: 'new', members: ['ann', 'rob'] });
    expect(byStatus.archived).toEqual(archived);
  });
});
