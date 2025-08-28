import { vi, type Mocked } from 'vitest';

import { type QuickSightService } from '../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../../shared/services/parsing/AssetParserService';
import { type TagService } from '../../../organization/services/TagService';
import { type AssetType } from '../../types';
import { BaseAssetProcessor } from '../BaseAssetProcessor';

// Mock the logger
vi.mock('../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Create a concrete implementation for testing
class TestAssetProcessor extends BaseAssetProcessor {
  public readonly assetType: AssetType = 'dashboard';
  public readonly capabilities = {
    hasDefinition: true,
    hasPermissions: true,
    hasTags: true,
    hasSpecialOperations: false,
  };
  public readonly storageType = 'individual' as const;

  protected executeDescribe(assetId: string): Promise<any> {
    return Promise.resolve({ DashboardId: assetId, Name: 'Test Dashboard' });
  }

  protected executeGetPermissions(_assetId: string): Promise<any[]> {
    return Promise.resolve([{ Principal: 'user1', Actions: ['read'] }]);
  }

  protected executeGetTags(_assetId: string): Promise<any[]> {
    return Promise.resolve([{ Key: 'Environment', Value: 'Test' }]);
  }

  protected getAssetId(summary: any): string {
    return summary.dashboardId || '';
  }

  protected getAssetName(summary: any): string {
    return summary.name || '';
  }

  protected getServicePath(): string {
    return 'dashboards';
  }

  public testGetCollectionCacheKey(): string {
    return this.getCollectionCacheKey();
  }

  // Expose protected methods for testing
  public testSaveToCollection(bucketName: string, assetId: string, assetData: any): Promise<void> {
    return this.saveToCollection(bucketName, assetId, assetData);
  }
}

// Test processor for collection storage
class TestCollectionProcessor extends BaseAssetProcessor {
  public override readonly assetType: AssetType = 'user';
  public readonly capabilities = {
    hasDefinition: false,
    hasPermissions: false,
    hasTags: false,
    hasSpecialOperations: true,
  };
  public readonly storageType = 'collection' as const;

  protected executeDescribe(assetId: string): Promise<any> {
    return Promise.resolve({ UserName: assetId });
  }

  protected executeGetPermissions(_assetId: string): Promise<any[]> {
    return Promise.resolve([]);
  }

  protected executeGetTags(_assetId: string): Promise<any[]> {
    return Promise.resolve([]);
  }

  protected getAssetId(summary: any): string {
    return summary.UserName || '';
  }

  protected getAssetName(summary: any): string {
    return summary.UserName || '';
  }

  protected override getCollectionCacheKey(): string {
    return 'assets/organization/users.json';
  }

  protected getServicePath(): string {
    return 'users';
  }

  public testGetCollectionCacheKey(): string {
    return this.getCollectionCacheKey();
  }

  // Expose protected methods for testing
  public testSaveToCollection(bucketName: string, assetId: string, assetData: any): Promise<void> {
    return this.saveToCollection(bucketName, assetId, assetData);
  }
}

describe('BaseAssetProcessor - Individual Storage', () => {
  let processor: TestAssetProcessor;
  let mockQuickSightService: Mocked<QuickSightService>;
  let mockS3Service: Mocked<S3Service>;
  let mockTagService: Mocked<TagService>;
  let mockAssetParserService: Mocked<AssetParserService>;

  beforeEach(() => {
    // Clear collection batches before each test
    (BaseAssetProcessor as any).collectionBatches?.clear();

    mockQuickSightService = {
      describeAsset: vi.fn(),
      getAssetPermissions: vi.fn(),
      convertToSDKFormat: vi.fn().mockImplementation((...args) => args[1]),
    } as any;

    mockS3Service = {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn(),
      objectExists: vi.fn().mockResolvedValue(false),
      ensureBucketExists: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockTagService = {
      listTagsForResource: vi.fn(),
    } as any;

    mockAssetParserService = {
      parseAsset: vi.fn().mockReturnValue({
        parsed: { id: 'test-id', name: 'Test Asset' },
      }),
    } as any;

    processor = new TestAssetProcessor(
      mockQuickSightService,
      mockS3Service,
      mockTagService,
      mockAssetParserService,
      '123456789012'
    );
  });

  describe('processAsset', () => {
    it('should process an individual asset successfully', async () => {
      const summary = {
        dashboardId: 'dashboard-1',
        name: 'Test Dashboard',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard-1',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
      };
      const context = { forceRefresh: false };

      const result = await processor.processAsset(summary, context);

      expect(result).toMatchObject({
        assetId: 'dashboard-1',
        assetName: 'Test Dashboard',
        status: 'success',
      });
      expect(mockS3Service.putObject).toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      const summary = {
        dashboardId: 'dashboard-1',
        name: 'Test Dashboard',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard-1',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
      };
      const context = { forceRefresh: false };

      mockS3Service.putObject.mockRejectedValue(new Error('S3 error'));

      const result = await processor.processAsset(summary, context);

      expect(result).toMatchObject({
        assetId: 'dashboard-1',
        status: 'error',
        error: 'S3 error',
      });
    });
  });
});

describe('BaseAssetProcessor - Refresh Options', () => {
  let processor: TestAssetProcessor;
  let mockQuickSightService: Mocked<QuickSightService>;
  let mockS3Service: Mocked<S3Service>;
  let mockTagService: Mocked<TagService>;
  let mockAssetParserService: Mocked<AssetParserService>;

  beforeEach(() => {
    // Clear collection batches before each test
    (BaseAssetProcessor as any).collectionBatches?.clear();

    mockQuickSightService = {
      describeAsset: vi.fn(),
      getAssetPermissions: vi.fn(),
      convertToSDKFormat: vi.fn().mockImplementation((...args) => args[1]),
    } as any;

    mockS3Service = {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn(),
      objectExists: vi.fn().mockResolvedValue(false),
      ensureBucketExists: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockTagService = {
      listTagsForResource: vi.fn(),
    } as any;

    mockAssetParserService = {
      parseAsset: vi.fn().mockReturnValue({
        parsed: { id: 'test-id', name: 'Test Asset' },
      }),
    } as any;

    processor = new TestAssetProcessor(
      mockQuickSightService,
      mockS3Service,
      mockTagService,
      mockAssetParserService,
      '123456789012'
    );
  });

  describe('permissions-only refresh', () => {
    it('should skip describe for permissions-only refresh', async () => {
      const summary = {
        dashboardId: 'dashboard-1',
        name: 'Test Dashboard',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard-1',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
      };
      const context = {
        forceRefresh: false,
        refreshOptions: {
          definitions: false,
          permissions: true,
          tags: false,
        },
      };

      // Spy on the executeDescribe method
      const executeDescribeSpy = vi.spyOn(processor as any, 'executeDescribe');

      const result = await processor.processAsset(summary, context);

      expect(result).toMatchObject({
        assetId: 'dashboard-1',
        assetName: 'Test Dashboard',
        status: 'success',
      });

      // Verify describe was NOT called for permissions-only refresh
      expect(executeDescribeSpy).not.toHaveBeenCalled();

      // Verify permissions were still fetched
      expect(result.details?.permissions).toBe(true);
      expect(result.details?.definition).toBe(false);
      expect(result.details?.tags).toBe(false);
    });
  });

  describe('tags-only refresh', () => {
    it('should skip describe for tags-only refresh', async () => {
      const summary = {
        dashboardId: 'dashboard-1',
        name: 'Test Dashboard',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard-1',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
      };
      const context = {
        forceRefresh: false,
        refreshOptions: {
          definitions: false,
          permissions: false,
          tags: true,
        },
      };

      // Spy on the executeDescribe method
      const executeDescribeSpy = vi.spyOn(processor as any, 'executeDescribe');

      const result = await processor.processAsset(summary, context);

      expect(result).toMatchObject({
        assetId: 'dashboard-1',
        assetName: 'Test Dashboard',
        status: 'success',
      });

      // Verify describe was NOT called for tags-only refresh
      expect(executeDescribeSpy).not.toHaveBeenCalled();

      // Verify tags were still fetched
      expect(result.details?.tags).toBe(true);
      expect(result.details?.definition).toBe(false);
      expect(result.details?.permissions).toBe(false);
    });
  });

  describe('standard refresh', () => {
    it('should call describe for standard refresh with definitions', async () => {
      const summary = {
        dashboardId: 'dashboard-1',
        name: 'Test Dashboard',
        arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard-1',
        createdTime: new Date(),
        lastUpdatedTime: new Date(),
      };
      const context = {
        forceRefresh: false,
        refreshOptions: {
          definitions: true,
          permissions: true,
          tags: true,
        },
      };

      // Spy on the executeDescribe method
      const executeDescribeSpy = vi.spyOn(processor as any, 'executeDescribe');

      const result = await processor.processAsset(summary, context);

      expect(result).toMatchObject({
        assetId: 'dashboard-1',
        assetName: 'Test Dashboard',
        status: 'success',
      });

      // Verify describe WAS called for standard refresh
      expect(executeDescribeSpy).toHaveBeenCalledWith('dashboard-1', 'Test Dashboard');

      // Verify all data was fetched
      expect(result.details?.definition).toBe(true);
      expect(result.details?.permissions).toBe(true);
      expect(result.details?.tags).toBe(true);
    });
  });
});

describe('BaseAssetProcessor - Collection Storage', () => {
  let collectionProcessor: TestCollectionProcessor;
  let mockQuickSightService: Mocked<QuickSightService>;
  let mockS3Service: Mocked<S3Service>;
  let mockTagService: Mocked<TagService>;
  let mockAssetParserService: Mocked<AssetParserService>;

  beforeEach(() => {
    // Clear collection batches before each test
    (BaseAssetProcessor as any).collectionBatches?.clear();

    mockQuickSightService = {} as any;

    mockS3Service = {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn(),
      objectExists: vi.fn().mockResolvedValue(false),
      ensureBucketExists: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockTagService = {} as any;

    mockAssetParserService = {
      parseAsset: vi.fn().mockReturnValue({
        parsed: { id: 'test-id', name: 'Test Asset' },
      }),
    } as any;

    collectionProcessor = new TestCollectionProcessor(
      mockQuickSightService,
      mockS3Service,
      mockTagService,
      mockAssetParserService,
      '123456789012'
    );
  });

  describe('saveToCollection', () => {
    it('should start with empty collection for new batch', async () => {
      const bucketName = 'test-bucket';
      const assetId = 'user-1';
      const assetData = { UserName: 'user-1', Email: 'user1@example.com' };

      await collectionProcessor.testSaveToCollection(bucketName, assetId, assetData);

      // Check that batch was created with empty data initially
      const batchKey = `${bucketName}:${collectionProcessor.testGetCollectionCacheKey()}`;
      const batch = (BaseAssetProcessor as any).collectionBatches.get(batchKey);

      expect(batch).toBeDefined();
      expect(batch.data).toEqual({ 'user-1': assetData });
      expect(batch.isDirty).toBe(true);
    });

    it('should not load existing collection data', async () => {
      const bucketName = 'test-bucket';
      const assetId = 'user-2';
      const assetData = { UserName: 'user-2', Email: 'user2@example.com' };

      // Mock S3 to return existing collection with deleted items
      mockS3Service.getObject.mockResolvedValue({
        'deleted-user': { UserName: 'deleted-user', Email: 'deleted@example.com' },
        'old-user': { UserName: 'old-user', Email: 'old@example.com' },
      });

      await collectionProcessor.testSaveToCollection(bucketName, assetId, assetData);

      const batchKey = `${bucketName}:${collectionProcessor.testGetCollectionCacheKey()}`;
      const batch = (BaseAssetProcessor as any).collectionBatches.get(batchKey);

      // Should only contain the new user, not the old/deleted ones
      expect(batch.data).toEqual({ 'user-2': assetData });
      expect(batch.data['deleted-user']).toBeUndefined();
      expect(batch.data['old-user']).toBeUndefined();
    });

    it('should accumulate multiple assets in the same batch', async () => {
      const bucketName = 'test-bucket';

      await collectionProcessor.testSaveToCollection(bucketName, 'user-1', {
        UserName: 'user-1',
      });
      await collectionProcessor.testSaveToCollection(bucketName, 'user-2', {
        UserName: 'user-2',
      });
      await collectionProcessor.testSaveToCollection(bucketName, 'user-3', {
        UserName: 'user-3',
      });

      const batchKey = `${bucketName}:${collectionProcessor.testGetCollectionCacheKey()}`;
      const batch = (BaseAssetProcessor as any).collectionBatches.get(batchKey);

      const EXPECTED_USER_COUNT = 3;
      expect(Object.keys(batch.data)).toHaveLength(EXPECTED_USER_COUNT);
      expect(batch.data['user-1']).toBeDefined();
      expect(batch.data['user-2']).toBeDefined();
      expect(batch.data['user-3']).toBeDefined();
    });
  });
});

describe('BaseAssetProcessor - Flush Operations', () => {
  let collectionProcessor: TestCollectionProcessor;
  let mockS3Service: Mocked<S3Service>;

  beforeEach(() => {
    // Clear collection batches before each test
    (BaseAssetProcessor as any).collectionBatches?.clear();

    mockS3Service = {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn(),
    } as any;

    collectionProcessor = new TestCollectionProcessor(
      {} as any,
      mockS3Service,
      {} as any,
      {} as any,
      '123456789012'
    );
  });

  describe('flushCollectionBatches', () => {
    it('should flush all dirty batches to S3', async () => {
      const bucketName = 'test-bucket';

      // Create multiple batches
      await collectionProcessor.testSaveToCollection(bucketName, 'user-1', {
        UserName: 'user-1',
      });
      await collectionProcessor.testSaveToCollection(bucketName, 'user-2', {
        UserName: 'user-2',
      });

      // Flush batches
      await BaseAssetProcessor.flushCollectionBatches(mockS3Service);

      expect(mockS3Service.putObject).toHaveBeenCalledWith(
        bucketName,
        collectionProcessor.testGetCollectionCacheKey(),
        expect.objectContaining({
          'user-1': { UserName: 'user-1' },
          'user-2': { UserName: 'user-2' },
        })
      );
    });

    it('should clear batches after flushing', async () => {
      const bucketName = 'test-bucket';

      await collectionProcessor.testSaveToCollection(bucketName, 'user-1', {
        UserName: 'user-1',
      });

      await BaseAssetProcessor.flushCollectionBatches(mockS3Service);

      // Batches should be cleared
      expect((BaseAssetProcessor as any).collectionBatches.size).toBe(0);
    });

    it('should handle flush errors gracefully', async () => {
      const bucketName = 'test-bucket';

      await collectionProcessor.testSaveToCollection(bucketName, 'user-1', {
        UserName: 'user-1',
      });

      mockS3Service.putObject.mockRejectedValue(new Error('S3 flush error'));

      await expect(BaseAssetProcessor.flushCollectionBatches(mockS3Service)).rejects.toThrow(
        'S3 flush error'
      );
    });

    it('should only flush dirty batches', async () => {
      const bucketName = 'test-bucket';
      const collectionKey = collectionProcessor.testGetCollectionCacheKey();
      const batchKey = `${bucketName}:${collectionKey}`;

      // Manually create a non-dirty batch
      (BaseAssetProcessor as any).collectionBatches.set(batchKey, {
        data: { 'user-1': { UserName: 'user-1' } },
        isDirty: false,
      });

      await BaseAssetProcessor.flushCollectionBatches(mockS3Service);

      // Should not call putObject for non-dirty batch
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });
  });
});

describe('BaseAssetProcessor - Collection Rebuild', () => {
  let collectionProcessor: TestCollectionProcessor;
  let mockS3Service: Mocked<S3Service>;

  beforeEach(() => {
    // Clear collection batches before each test
    (BaseAssetProcessor as any).collectionBatches?.clear();

    mockS3Service = {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn(),
    } as any;

    collectionProcessor = new TestCollectionProcessor(
      {} as any,
      mockS3Service,
      {} as any,
      {} as any,
      '123456789012'
    );
  });

  describe('collection rebuild behavior', () => {
    it('should completely rebuild collection with only current assets', async () => {
      const bucketName = 'test-bucket';

      // Simulate export of current users (not including deleted ones)
      const currentUsers = ['user-1', 'user-2', 'user-3'];

      for (const userId of currentUsers) {
        await collectionProcessor.testSaveToCollection(bucketName, userId, {
          UserName: userId,
          Email: `${userId}@example.com`,
          Groups: ['group-1', 'group-2'], // These groups exist
        });
      }

      await BaseAssetProcessor.flushCollectionBatches(mockS3Service);

      // Verify only current users are in the collection
      expect(mockS3Service.putObject).toHaveBeenCalledWith(
        bucketName,
        collectionProcessor.testGetCollectionCacheKey(),
        expect.objectContaining({
          'user-1': expect.objectContaining({ UserName: 'user-1' }),
          'user-2': expect.objectContaining({ UserName: 'user-2' }),
          'user-3': expect.objectContaining({ UserName: 'user-3' }),
        })
      );

      // Verify the collection doesn't contain any other keys
      const callArgs = mockS3Service.putObject.mock.calls[0];
      const savedData = callArgs?.[2];
      expect(savedData).toBeDefined();
      const EXPECTED_USER_COUNT = 3;
      expect(Object.keys(savedData)).toHaveLength(EXPECTED_USER_COUNT);
    });
  });
});
