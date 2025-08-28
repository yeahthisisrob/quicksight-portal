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
