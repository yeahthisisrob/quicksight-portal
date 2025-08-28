import { vi, type Mock, type Mocked } from 'vitest';

import { ASSET_TYPES } from '../../../types/assetTypes';
import {
  type BulkAssetReference,
  type BulkDeleteConfig,
  type BulkFolderAddConfig,
  type BulkFolderRemoveConfig,
  type BulkGroupAddConfig,
  type BulkGroupRemoveConfig,
  type BulkTagUpdateConfig,
} from '../../../types/bulkOperationTypes';
import { logger } from '../../../utils/logger';
import { CacheService } from '../../cache/CacheService';
import { jobFactory } from '../../jobs/JobFactory';
import { BulkOperationsService } from '../BulkOperationsService';

// Mock dependencies
vi.mock('../../../utils/logger');
vi.mock('../../cache/CacheService');
vi.mock('../../jobs/JobFactory');

// Test constants
const TEST_ACCOUNT_ID = '123456789012';
const TEST_BUCKET_NAME = `quicksight-metadata-bucket-${TEST_ACCOUNT_ID}`;
const TEST_USER = 'test-user@example.com';
const TEST_JOB_ID = 'job-12345';
const MAX_ITEMS_PER_REQUEST = 1000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_CONCURRENCY = 5;
const SINGLE_ITEM = 1;
const TWO_ITEMS = 2;
const THREE_ITEMS = 3;
const SIX_OPERATIONS = 6;
const EIGHT_OPERATIONS = 8;

// Mock data factories
const createMockAsset = (type: string, id: string, name?: string): BulkAssetReference => ({
  type: type as any,
  id,
  name,
});

const createMockJobResponse = () => ({
  jobId: TEST_JOB_ID,
  status: 'QUEUED',
});

describe('BulkOperationsService - Initialization', () => {
  let service: BulkOperationsService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = TEST_ACCOUNT_ID;
    process.env.BUCKET_NAME = TEST_BUCKET_NAME;

    mockCacheService = {
      getCacheEntries: vi.fn(),
    } as any;

    (CacheService.getInstance as Mock).mockReturnValue(mockCacheService);
    (jobFactory.createJob as Mock).mockResolvedValue(createMockJobResponse());
  });

  afterEach(() => {
    delete process.env.AWS_ACCOUNT_ID;
    delete process.env.BUCKET_NAME;
  });

  it('should initialize with environment variables', () => {
    service = new BulkOperationsService();
    expect(service).toBeDefined();
  });

  it('should initialize with provided account ID', () => {
    service = new BulkOperationsService('custom-account-id');
    expect(service).toBeDefined();
  });

  it('should initialize without environment variables', () => {
    delete process.env.AWS_ACCOUNT_ID;
    delete process.env.BUCKET_NAME;
    service = new BulkOperationsService();
    expect(service).toBeDefined();
  });
});

describe('BulkOperationsService - Folder Operations', () => {
  let service: BulkOperationsService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = TEST_ACCOUNT_ID;

    mockCacheService = {
      getCacheEntries: vi.fn(),
    } as any;

    (CacheService.getInstance as Mock).mockReturnValue(mockCacheService);
    (jobFactory.createJob as Mock).mockResolvedValue(createMockJobResponse());

    service = new BulkOperationsService();
  });

  describe('bulkAddToFolders', () => {
    it('should successfully add assets to folders', async () => {
      const assets = [
        createMockAsset(ASSET_TYPES.dashboard, 'dash-1'),
        createMockAsset(ASSET_TYPES.analysis, 'anal-1'),
      ];
      const folderIds = ['folder-1', 'folder-2'];

      const result = await service.bulkAddToFolders(assets, folderIds, TEST_USER);

      expect(result).toEqual({
        jobId: TEST_JOB_ID,
        status: 'QUEUED',
        message: 'Bulk folder-add operation queued',
        estimatedOperations: 4, // 2 assets × 2 folders
      });

      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'bulk-operation',
          operationConfig: expect.objectContaining({
            operationType: 'folder-add',
            assets,
            folderIds,
            requestedBy: TEST_USER,
          } as BulkFolderAddConfig),
          estimatedOperations: 4,
          batchSize: DEFAULT_BATCH_SIZE,
          maxConcurrency: DEFAULT_MAX_CONCURRENCY,
        })
      );
    });

    it('should validate assets array', async () => {
      await expect(service.bulkAddToFolders([], ['folder-1'], TEST_USER)).rejects.toThrow(
        'Assets array is required and must not be empty'
      );

      await expect(service.bulkAddToFolders(null as any, ['folder-1'], TEST_USER)).rejects.toThrow(
        'Assets array is required and must not be empty'
      );
    });

    it('should validate folder IDs', async () => {
      const assets = [createMockAsset(ASSET_TYPES.dashboard, 'dash-1')];

      await expect(service.bulkAddToFolders(assets, [], TEST_USER)).rejects.toThrow(
        'Folder IDs array is required and must not be empty'
      );

      await expect(service.bulkAddToFolders(assets, [''], TEST_USER)).rejects.toThrow(
        'Each folder ID must be a non-empty string'
      );
    });

    it('should validate asset structure', async () => {
      const invalidAssets = [{ type: ASSET_TYPES.dashboard } as any];

      await expect(
        service.bulkAddToFolders(invalidAssets, ['folder-1'], TEST_USER)
      ).rejects.toThrow('Each asset must have type and id');
    });

    it('should enforce maximum items limit', async () => {
      const tooManyAssets = Array(MAX_ITEMS_PER_REQUEST + 1)
        .fill(null)
        .map((_, i) => createMockAsset(ASSET_TYPES.dashboard, `dash-${i}`));

      await expect(
        service.bulkAddToFolders(tooManyAssets, ['folder-1'], TEST_USER)
      ).rejects.toThrow(`Maximum ${MAX_ITEMS_PER_REQUEST} assets allowed per request`);
    });
  });

  describe('bulkRemoveFromFolders', () => {
    it('should successfully remove assets from folders', async () => {
      const assets = [createMockAsset(ASSET_TYPES.dashboard, 'dash-1')];
      const folderIds = ['folder-1'];

      const result = await service.bulkRemoveFromFolders(assets, folderIds, TEST_USER);

      expect(result).toEqual({
        jobId: TEST_JOB_ID,
        status: 'QUEUED',
        message: 'Bulk folder-remove operation queued',
        estimatedOperations: SINGLE_ITEM,
      });

      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          operationConfig: expect.objectContaining({
            operationType: 'folder-remove',
            assets,
            folderIds,
            requestedBy: TEST_USER,
          } as BulkFolderRemoveConfig),
        })
      );
    });

    it('should calculate correct operation count for multiple items', async () => {
      const assets = [
        createMockAsset(ASSET_TYPES.dashboard, 'dash-1'),
        createMockAsset(ASSET_TYPES.dashboard, 'dash-2'),
        createMockAsset(ASSET_TYPES.dashboard, 'dash-3'),
      ];
      const folderIds = ['folder-1', 'folder-2'];

      const result = await service.bulkRemoveFromFolders(assets, folderIds, TEST_USER);

      expect(result.estimatedOperations).toBe(SIX_OPERATIONS); // 3 assets × 2 folders
    });
  });
});

describe('BulkOperationsService - Group Operations', () => {
  let service: BulkOperationsService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = TEST_ACCOUNT_ID;

    mockCacheService = {
      getCacheEntries: vi.fn(),
    } as any;

    (CacheService.getInstance as Mock).mockReturnValue(mockCacheService);
    (jobFactory.createJob as Mock).mockResolvedValue(createMockJobResponse());

    service = new BulkOperationsService();
  });

  describe('bulkAddUsersToGroups', () => {
    it('should successfully add users to groups', async () => {
      const userNames = ['user1', 'user2'];
      const groupNames = ['group1', 'group2', 'group3'];

      const result = await service.bulkAddUsersToGroups(userNames, groupNames, TEST_USER);

      expect(result).toEqual({
        jobId: TEST_JOB_ID,
        status: 'QUEUED',
        message: 'Bulk group-add operation queued',
        estimatedOperations: 6, // 2 users × 3 groups
      });

      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          operationConfig: expect.objectContaining({
            operationType: 'group-add',
            userNames,
            groupNames,
            requestedBy: TEST_USER,
          } as BulkGroupAddConfig),
        })
      );
    });

    it('should validate user names', async () => {
      await expect(service.bulkAddUsersToGroups([], ['group1'], TEST_USER)).rejects.toThrow(
        'User names array is required and must not be empty'
      );

      await expect(
        service.bulkAddUsersToGroups(null as any, ['group1'], TEST_USER)
      ).rejects.toThrow('User names array is required and must not be empty');
    });

    it('should validate group names', async () => {
      await expect(service.bulkAddUsersToGroups(['user1'], [], TEST_USER)).rejects.toThrow(
        'Group names array is required and must not be empty'
      );

      await expect(service.bulkAddUsersToGroups(['user1'], null as any, TEST_USER)).rejects.toThrow(
        'Group names array is required and must not be empty'
      );
    });

    it('should enforce maximum users limit', async () => {
      const tooManyUsers = Array(MAX_ITEMS_PER_REQUEST + 1)
        .fill(null)
        .map((_, i) => `user-${i}`);

      await expect(
        service.bulkAddUsersToGroups(tooManyUsers, ['group1'], TEST_USER)
      ).rejects.toThrow(`Maximum ${MAX_ITEMS_PER_REQUEST} users allowed per request`);
    });
  });

  describe('bulkRemoveUsersFromGroups', () => {
    it('should successfully remove users from groups', async () => {
      const userNames = ['user1'];
      const groupNames = ['group1'];

      const result = await service.bulkRemoveUsersFromGroups(userNames, groupNames, TEST_USER);

      expect(result).toEqual({
        jobId: TEST_JOB_ID,
        status: 'QUEUED',
        message: 'Bulk group-remove operation queued',
        estimatedOperations: SINGLE_ITEM,
      });

      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          operationConfig: expect.objectContaining({
            operationType: 'group-remove',
            userNames,
            groupNames,
            requestedBy: TEST_USER,
          } as BulkGroupRemoveConfig),
        })
      );
    });

    it('should calculate correct operation count', async () => {
      const userNames = ['user1', 'user2', 'user3', 'user4'];
      const groupNames = ['group1', 'group2'];

      const result = await service.bulkRemoveUsersFromGroups(userNames, groupNames, TEST_USER);

      expect(result.estimatedOperations).toBe(EIGHT_OPERATIONS); // 4 users × 2 groups
    });
  });
});

describe('BulkOperationsService - Tag Operations', () => {
  let service: BulkOperationsService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = TEST_ACCOUNT_ID;

    mockCacheService = {
      getCacheEntries: vi.fn(),
    } as any;

    (CacheService.getInstance as Mock).mockReturnValue(mockCacheService);
    (jobFactory.createJob as Mock).mockResolvedValue(createMockJobResponse());

    service = new BulkOperationsService();
  });

  describe('bulkUpdateTags', () => {
    const assets = [
      createMockAsset(ASSET_TYPES.dashboard, 'dash-1'),
      createMockAsset(ASSET_TYPES.analysis, 'anal-1'),
    ];
    const tags = [
      { Key: 'Environment', Value: 'Production' },
      { Key: 'Team', Value: 'Analytics' },
    ];

    it('should successfully add tags to assets', async () => {
      const result = await service.bulkUpdateTags(assets, tags, 'add', TEST_USER);

      expect(result).toEqual({
        jobId: TEST_JOB_ID,
        status: 'QUEUED',
        message: 'Bulk tag-update operation queued',
        estimatedOperations: TWO_ITEMS,
      });

      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          operationConfig: expect.objectContaining({
            operationType: 'tag-update',
            assets,
            tags,
            action: 'add',
            requestedBy: TEST_USER,
          } as BulkTagUpdateConfig),
        })
      );
    });

    it('should support replace action', async () => {
      const result = await service.bulkUpdateTags(assets, tags, 'replace', TEST_USER);

      expect(result.message).toBe('Bulk tag-update operation queued');
      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          operationConfig: expect.objectContaining({
            action: 'replace',
          }),
        })
      );
    });

    it('should support remove action', async () => {
      const result = await service.bulkUpdateTags(assets, tags, 'remove', TEST_USER);

      expect(result.message).toBe('Bulk tag-update operation queued');
      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          operationConfig: expect.objectContaining({
            action: 'remove',
          }),
        })
      );
    });

    it('should validate tags array', async () => {
      await expect(service.bulkUpdateTags(assets, [], 'add', TEST_USER)).rejects.toThrow(
        'Tags array is required and must not be empty'
      );

      await expect(service.bulkUpdateTags(assets, null as any, 'add', TEST_USER)).rejects.toThrow(
        'Tags array is required and must not be empty'
      );
    });

    it('should validate tag structure', async () => {
      const invalidTags = [{ Value: 'test' } as any];

      await expect(service.bulkUpdateTags(assets, invalidTags, 'add', TEST_USER)).rejects.toThrow(
        'Each tag must have a Key'
      );
    });

    it('should validate tag Key type', async () => {
      const invalidTags = [{ Key: 123, Value: 'test' } as any];

      await expect(service.bulkUpdateTags(assets, invalidTags, 'add', TEST_USER)).rejects.toThrow(
        'Each tag must have a Key'
      );
    });
  });
});

describe('BulkOperationsService - Delete Operations', () => {
  let service: BulkOperationsService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = TEST_ACCOUNT_ID;

    mockCacheService = {
      getCacheEntries: vi.fn(),
    } as any;

    (CacheService.getInstance as Mock).mockReturnValue(mockCacheService);
    (jobFactory.createJob as Mock).mockResolvedValue(createMockJobResponse());

    service = new BulkOperationsService();
  });

  describe('bulkDelete', () => {
    it('should successfully queue delete operation', async () => {
      const assets = [
        createMockAsset(ASSET_TYPES.dashboard, 'dash-1'),
        createMockAsset(ASSET_TYPES.analysis, 'anal-1'),
        createMockAsset(ASSET_TYPES.dataset, 'data-1'),
      ];
      const reason = 'Cleanup obsolete assets';

      const result = await service.bulkDelete(assets, TEST_USER, reason);

      expect(result).toEqual({
        jobId: TEST_JOB_ID,
        status: 'QUEUED',
        message: 'Bulk delete operation queued',
        estimatedOperations: THREE_ITEMS,
      });

      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          operationConfig: expect.objectContaining({
            operationType: 'delete',
            assets,
            requestedBy: TEST_USER,
            reason,
          } as BulkDeleteConfig),
        })
      );
    });

    it('should work without a reason', async () => {
      const assets = [createMockAsset(ASSET_TYPES.dashboard, 'dash-1')];

      const result = await service.bulkDelete(assets, TEST_USER);

      expect(result.message).toBe('Bulk delete operation queued');
      expect(jobFactory.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          operationConfig: expect.objectContaining({
            reason: undefined,
          }),
        })
      );
    });

    it('should validate assets before deletion', async () => {
      await expect(service.bulkDelete([], TEST_USER)).rejects.toThrow(
        'Assets array is required and must not be empty'
      );
    });
  });
});

describe('BulkOperationsService - Delete Validation', () => {
  let service: BulkOperationsService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = TEST_ACCOUNT_ID;

    mockCacheService = {
      getCacheEntries: vi.fn(),
    } as any;

    (CacheService.getInstance as Mock).mockReturnValue(mockCacheService);
    (jobFactory.createJob as Mock).mockResolvedValue(createMockJobResponse());

    service = new BulkOperationsService();
  });

  describe('validateBulkDelete', () => {
    it('should validate deletion with no issues', async () => {
      const assets = [
        createMockAsset(ASSET_TYPES.dashboard, 'dash-1'),
        createMockAsset(ASSET_TYPES.analysis, 'anal-1'),
      ];

      mockCacheService.getCacheEntries.mockResolvedValue([]);

      const result = await service.validateBulkDelete(assets);

      expect(result).toEqual({
        canDelete: true,
        warnings: [],
        errors: [],
      });
    });

    it('should detect dashboard dependencies on datasets', async () => {
      const assets = [createMockAsset(ASSET_TYPES.dataset, 'data-1')];

      mockCacheService.getCacheEntries.mockResolvedValue([
        {
          assetId: 'dash-1',
          assetType: ASSET_TYPES.dashboard,
          assetName: 'Sales Dashboard',
          metadata: {
            lineageData: {
              datasetIds: ['data-1', 'data-2'],
            },
          },
        },
        {
          assetId: 'anal-1',
          assetType: ASSET_TYPES.analysis,
          assetName: 'Revenue Analysis',
          metadata: {
            lineageData: {
              datasetIds: ['data-1'],
            },
          },
        },
      ] as any);

      const result = await service.validateBulkDelete(assets);

      expect(result.canDelete).toBe(true);
      expect(result.warnings).toHaveLength(TWO_ITEMS);
      expect(result.warnings).toContain(
        'dashboard "Sales Dashboard" depends on dataset(s) being deleted'
      );
      expect(result.warnings).toContain(
        'analysis "Revenue Analysis" depends on dataset(s) being deleted'
      );
      expect(result.errors).toHaveLength(0);
    });

    it('should detect dataset dependencies on datasources', async () => {
      const assets = [createMockAsset(ASSET_TYPES.datasource, 'ds-1')];

      mockCacheService.getCacheEntries.mockResolvedValue([
        {
          assetId: 'data-1',
          assetType: ASSET_TYPES.dataset,
          assetName: 'Customer Dataset',
          metadata: {
            lineageData: {
              datasourceIds: ['ds-1', 'ds-2'],
            },
          },
        },
      ] as any);

      const result = await service.validateBulkDelete(assets);

      expect(result.canDelete).toBe(true);
      expect(result.warnings).toHaveLength(SINGLE_ITEM);
      expect(result.warnings).toContain(
        'Dataset "Customer Dataset" depends on datasource(s) being deleted'
      );
    });

    it('should prevent deletion of collection assets', async () => {
      const assets = [
        createMockAsset(ASSET_TYPES.dashboard, 'collection_dashboards'),
        createMockAsset(ASSET_TYPES.analysis, 'collection_analyses'),
        createMockAsset(ASSET_TYPES.dataset, 'collection_datasets'),
      ];

      mockCacheService.getCacheEntries.mockResolvedValue([]);

      const result = await service.validateBulkDelete(assets);

      expect(result.canDelete).toBe(false);
      expect(result.errors).toHaveLength(THREE_ITEMS);
      expect(result.errors).toContain('Cannot delete collection asset: collection_dashboards');
      expect(result.errors).toContain('Cannot delete collection asset: collection_analyses');
      expect(result.errors).toContain('Cannot delete collection asset: collection_datasets');
    });

    it('should handle cache service errors gracefully', async () => {
      const assets = [createMockAsset(ASSET_TYPES.dataset, 'data-1')];

      mockCacheService.getCacheEntries.mockRejectedValue(new Error('Cache error'));

      const result = await service.validateBulkDelete(assets);

      expect(result.canDelete).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(
        'Could not check dependencies for deletion validation',
        expect.any(Object)
      );
    });

    it('should handle mixed asset types with dependencies', async () => {
      const assets = [
        createMockAsset(ASSET_TYPES.dataset, 'data-1'),
        createMockAsset(ASSET_TYPES.datasource, 'ds-1'),
      ];

      mockCacheService.getCacheEntries.mockResolvedValue([
        {
          assetId: 'dash-1',
          assetType: ASSET_TYPES.dashboard,
          assetName: 'Dashboard 1',
          metadata: {
            lineageData: {
              datasetIds: ['data-1'],
            },
          },
        },
        {
          assetId: 'data-2',
          assetType: ASSET_TYPES.dataset,
          assetName: 'Dataset 2',
          metadata: {
            lineageData: {
              datasourceIds: ['ds-1'],
            },
          },
        },
      ] as any);

      const result = await service.validateBulkDelete(assets);

      expect(result.canDelete).toBe(true);
      expect(result.warnings).toHaveLength(TWO_ITEMS);
      expect(result.warnings).toContainEqual(expect.stringContaining('Dashboard 1'));
      expect(result.warnings).toContainEqual(expect.stringContaining('Dataset 2'));
    });
  });
});

describe('BulkOperationsService - Job Creation', () => {
  let service: BulkOperationsService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = TEST_ACCOUNT_ID;
    process.env.BUCKET_NAME = TEST_BUCKET_NAME;

    mockCacheService = {
      getCacheEntries: vi.fn(),
    } as any;

    (CacheService.getInstance as Mock).mockReturnValue(mockCacheService);
    (jobFactory.createJob as Mock).mockResolvedValue(createMockJobResponse());

    service = new BulkOperationsService();
  });

  it('should log job creation', async () => {
    const assets = [createMockAsset(ASSET_TYPES.dashboard, 'dash-1')];
    const folderIds = ['folder-1'];

    await service.bulkAddToFolders(assets, folderIds, TEST_USER);

    expect(logger.info).toHaveBeenCalledWith(
      'Creating bulk operation job',
      expect.objectContaining({
        operationType: 'folder-add',
        estimatedOperations: SINGLE_ITEM,
        requestedBy: TEST_USER,
      })
    );

    expect(logger.info).toHaveBeenCalledWith(
      'Bulk operation job created',
      expect.objectContaining({
        jobId: TEST_JOB_ID,
        operationType: 'folder-add',
      })
    );
  });

  it('should pass correct job configuration', async () => {
    const assets = [createMockAsset(ASSET_TYPES.dashboard, 'dash-1')];

    await service.bulkDelete(assets, TEST_USER);

    expect(jobFactory.createJob).toHaveBeenCalledWith({
      jobType: 'bulk-operation',
      accountId: TEST_ACCOUNT_ID,
      bucketName: TEST_BUCKET_NAME,
      userId: TEST_USER,
      operationConfig: expect.objectContaining({
        operationType: 'delete',
      }),
      estimatedOperations: SINGLE_ITEM,
      batchSize: DEFAULT_BATCH_SIZE,
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
    });
  });

  it('should handle job creation errors', async () => {
    const error = new Error('Job queue unavailable');
    (jobFactory.createJob as Mock).mockRejectedValue(error);

    const assets = [createMockAsset(ASSET_TYPES.dashboard, 'dash-1')];

    await expect(service.bulkDelete(assets, TEST_USER)).rejects.toThrow('Job queue unavailable');
  });
});

describe('BulkOperationsService - Edge Cases', () => {
  let service: BulkOperationsService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ACCOUNT_ID = TEST_ACCOUNT_ID;

    mockCacheService = {
      getCacheEntries: vi.fn(),
    } as any;

    (CacheService.getInstance as Mock).mockReturnValue(mockCacheService);
    (jobFactory.createJob as Mock).mockResolvedValue(createMockJobResponse());

    service = new BulkOperationsService();
  });

  it('should handle assets with optional name field', async () => {
    const assets = [
      createMockAsset(ASSET_TYPES.dashboard, 'dash-1', 'Dashboard 1'),
      createMockAsset(ASSET_TYPES.analysis, 'anal-1'), // No name
    ];

    const result = await service.bulkDelete(assets, TEST_USER);

    expect(result.estimatedOperations).toBe(TWO_ITEMS);
  });

  it('should handle maximum allowed assets', async () => {
    const maxAssets = Array(MAX_ITEMS_PER_REQUEST)
      .fill(null)
      .map((_, i) => createMockAsset(ASSET_TYPES.dashboard, `dash-${i}`));

    const result = await service.bulkDelete(maxAssets, TEST_USER);

    expect(result.estimatedOperations).toBe(MAX_ITEMS_PER_REQUEST);
  });

  it('should handle single asset single folder scenario', async () => {
    const assets = [createMockAsset(ASSET_TYPES.dashboard, 'dash-1')];
    const folderIds = ['folder-1'];

    const result = await service.bulkAddToFolders(assets, folderIds, TEST_USER);

    expect(result.estimatedOperations).toBe(SINGLE_ITEM);
  });

  it('should handle empty cache entries in validation', async () => {
    const assets = [createMockAsset(ASSET_TYPES.dataset, 'data-1')];

    mockCacheService.getCacheEntries.mockResolvedValue(null as any);

    const result = await service.validateBulkDelete(assets);

    expect(result.canDelete).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle assets without metadata in validation', async () => {
    const assets = [createMockAsset(ASSET_TYPES.dataset, 'data-1')];

    mockCacheService.getCacheEntries.mockResolvedValue([
      {
        assetId: 'dash-1',
        assetType: ASSET_TYPES.dashboard,
        assetName: 'Dashboard',
        // No metadata field
      },
    ] as any);

    const result = await service.validateBulkDelete(assets);

    expect(result.canDelete).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('should handle assets with empty lineage data', async () => {
    const assets = [createMockAsset(ASSET_TYPES.dataset, 'data-1')];

    mockCacheService.getCacheEntries.mockResolvedValue([
      {
        assetId: 'dash-1',
        assetType: ASSET_TYPES.dashboard,
        assetName: 'Dashboard',
        metadata: {
          lineageData: {
            datasetIds: [], // Empty array
          },
        },
      },
    ] as any);

    const result = await service.validateBulkDelete(assets);

    expect(result.canDelete).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
