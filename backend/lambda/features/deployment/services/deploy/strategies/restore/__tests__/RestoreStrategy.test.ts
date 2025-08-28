import { vi, type Mocked } from 'vitest';

import { AssetStatus } from '../../../../../../../shared/models/asset.model';
import { type S3Service } from '../../../../../../../shared/services/aws/S3Service';
import { type CacheService } from '../../../../../../../shared/services/cache/CacheService';
import { logger } from '../../../../../../../shared/utils/logger';
import type { DeploymentConfig } from '../../../types';
import { RestoreStrategy } from '../RestoreStrategy';

vi.mock('../../../../../../../shared/services/aws/QuickSightService');
vi.mock('../../../../../../../shared/services/aws/S3Service');
vi.mock('../../../../../../../shared/services/cache/CacheService');
vi.mock('../../../../../../../shared/utils/logger');
vi.mock('../RestoreStrategyFactory');

// Test setup utilities
let restoreStrategy: RestoreStrategy;
let mockS3Service: Mocked<S3Service>;
let mockCacheService: Mocked<CacheService>;
const mockBucketName = 'test-bucket';
const mockAwsAccountId = '123456789012';
const mockAwsRegion = 'us-east-1';

function setupTestEnvironment() {
  vi.clearAllMocks();

  mockS3Service = {
    getObject: vi.fn(),
    putObject: vi.fn(),
    objectExists: vi.fn(),
    ensureBucketExists: vi.fn(),
  } as any;

  mockCacheService = {
    replaceAsset: vi.fn(),
    rebuildCacheForAssetType: vi.fn(),
  } as any;

  restoreStrategy = new RestoreStrategy(
    mockS3Service,
    mockCacheService,
    mockBucketName,
    mockAwsAccountId,
    mockAwsRegion
  );
}

describe('RestoreStrategy - deploy success', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('deploy - basic functionality', () => {
    const mockAssetData = {
      apiResponses: {
        describe: {
          data: {
            DashboardId: 'test-dashboard',
            Name: 'Test Dashboard',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard',
            CreatedTime: '2025-01-01T10:00:00Z',
            LastUpdatedTime: '2025-01-15T10:00:00Z',
          },
        },
        definition: {
          data: {
            Definition: {
              DataSetIdentifierDeclarations: [],
              Sheets: [],
            },
          },
        },
        permissions: {
          data: [
            {
              Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
              Actions: ['quicksight:DescribeDashboard'],
            },
          ],
        },
        tags: {
          data: [{ Key: 'Environment', Value: 'Production' }],
        },
      },
    };

    const mockConfig: DeploymentConfig = {
      deploymentType: 'restore',
      source: 'archive',
      target: {
        accountId: mockAwsAccountId,
        region: mockAwsRegion,
      },
      options: {
        overwriteExisting: false,
      },
      validation: {
        checkDependencies: true,
      },
    };

    it('should successfully restore an archived dashboard', async () => {
      const strategy = restoreStrategy as any;

      // Mock the RestoreStrategyFactory and specific strategy
      const mockDashboardStrategy = {
        restore: vi.fn().mockResolvedValue({ arn: mockAssetData.apiResponses.describe.data.Arn }),
        deleteExisting: vi.fn(),
        validate: vi.fn().mockResolvedValue([]),
      };

      strategy.restoreStrategyFactory = {
        getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
      };

      // Mock S3 operations
      mockS3Service.objectExists.mockResolvedValue(false); // Asset doesn't exist in active

      const result = await restoreStrategy.deploy(
        'dashboard',
        'test-dashboard',
        mockAssetData,
        mockConfig
      );

      expect(result.success).toBe(true);
      expect(result.deploymentType).toBe('restore');
      expect(result.targetId).toBe('test-dashboard');
      expect(result.targetArn).toBe(mockAssetData.apiResponses.describe.data.Arn);

      // Verify cache was updated
      expect(mockCacheService.replaceAsset).toHaveBeenCalledWith(
        'dashboard',
        'test-dashboard',
        expect.objectContaining({
          assetId: 'test-dashboard',
          assetType: 'dashboard',
          assetName: 'Test Dashboard',
          status: AssetStatus.ACTIVE,
          enrichmentStatus: 'enriched',
        })
      );

      // Verify cache was rebuilt
      expect(mockCacheService.rebuildCacheForAssetType).toHaveBeenCalledWith('dashboard');
    });
  });
});

describe('RestoreStrategy - deploy errors', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('deploy - error handling', () => {
    const mockAssetData = {
      apiResponses: {
        describe: {
          data: {
            DashboardId: 'test-dashboard',
            Name: 'Test Dashboard',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard',
            CreatedTime: '2025-01-01T10:00:00Z',
            LastUpdatedTime: '2025-01-15T10:00:00Z',
          },
        },
        definition: {
          data: {
            Definition: {
              DataSetIdentifierDeclarations: [],
              Sheets: [],
            },
          },
        },
        permissions: {
          data: [
            {
              Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
              Actions: ['quicksight:DescribeDashboard'],
            },
          ],
        },
        tags: {
          data: [{ Key: 'Environment', Value: 'Production' }],
        },
      },
    };

    const mockConfig: DeploymentConfig = {
      deploymentType: 'restore',
      source: 'archive',
      target: {
        accountId: mockAwsAccountId,
        region: mockAwsRegion,
      },
      options: {
        overwriteExisting: false,
      },
      validation: {
        checkDependencies: true,
      },
    };

    it('should handle restore failures gracefully', async () => {
      const strategy = restoreStrategy as any;
      const restoreError = new Error('Failed to create dashboard: Invalid definition');

      const mockDashboardStrategy = {
        restore: vi.fn().mockRejectedValue(restoreError),
        deleteExisting: vi.fn(),
        validate: vi.fn().mockResolvedValue([]),
      };

      strategy.restoreStrategyFactory = {
        getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
      };

      mockS3Service.objectExists.mockResolvedValue(false);

      const result = await restoreStrategy.deploy(
        'dashboard',
        'test-dashboard',
        mockAssetData,
        mockConfig
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Failed to create dashboard');

      // Cache should not be updated on failure
      expect(mockCacheService.replaceAsset).not.toHaveBeenCalled();
      expect(mockCacheService.rebuildCacheForAssetType).not.toHaveBeenCalled();
    });

    it('should handle AWS SDK date serialization errors', async () => {
      const strategy = restoreStrategy as any;
      const dateError = new Error('_.getTime is not a function');

      const mockDashboardStrategy = {
        restore: vi.fn().mockRejectedValue(dateError),
        deleteExisting: vi.fn(),
        validate: vi.fn().mockResolvedValue([]),
      };

      strategy.restoreStrategyFactory = {
        getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
      };

      mockS3Service.objectExists.mockResolvedValue(false);

      const result = await restoreStrategy.deploy(
        'dashboard',
        'test-dashboard',
        mockAssetData,
        mockConfig
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Date parsing error');
      expect(result.error).toContain('invalid date formats');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to restore dashboard'),
        expect.objectContaining({
          error: expect.stringContaining('Date parsing error'),
        })
      );
    });
  });
});

describe('RestoreStrategy - backup and archiving', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('deploy - backup and archiving', () => {
    const mockAssetData = {
      apiResponses: {
        describe: {
          data: {
            DashboardId: 'test-dashboard',
            Name: 'Test Dashboard',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard',
            CreatedTime: '2025-01-01T10:00:00Z',
            LastUpdatedTime: '2025-01-15T10:00:00Z',
          },
        },
        definition: {
          data: {
            Definition: {
              DataSetIdentifierDeclarations: [],
              Sheets: [],
            },
          },
        },
        permissions: {
          data: [
            {
              Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
              Actions: ['quicksight:DescribeDashboard'],
            },
          ],
        },
        tags: {
          data: [{ Key: 'Environment', Value: 'Production' }],
        },
      },
    };

    const mockConfig: DeploymentConfig = {
      deploymentType: 'restore',
      source: 'archive',
      target: {
        accountId: mockAwsAccountId,
        region: mockAwsRegion,
      },
      options: {
        overwriteExisting: false,
      },
      validation: {
        checkDependencies: true,
      },
    };

    it('should backup existing asset when overwriteExisting is true', async () => {
      const configWithOverwrite = {
        ...mockConfig,
        options: {
          ...mockConfig.options,
          overwriteExisting: true,
        },
      };

      const strategy = restoreStrategy as any;

      const mockDashboardStrategy = {
        restore: vi.fn().mockResolvedValue({ arn: mockAssetData.apiResponses.describe.data.Arn }),
        deleteExisting: vi.fn(),
        validate: vi.fn().mockResolvedValue([]),
      };

      strategy.restoreStrategyFactory = {
        getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
      };

      // Asset exists in active location
      mockS3Service.objectExists.mockResolvedValue(true);
      mockS3Service.getObject.mockResolvedValue({ existing: 'data' });

      await restoreStrategy.deploy(
        'dashboard',
        'test-dashboard',
        mockAssetData,
        configWithOverwrite
      );

      // Verify backup was created
      expect(mockS3Service.getObject).toHaveBeenCalledWith(
        mockBucketName,
        'assets/dashboards/test-dashboard.json'
      );
      expect(mockS3Service.putObject).toHaveBeenCalledWith(
        mockBucketName,
        expect.stringMatching(/^backups\/dashboards\/test-dashboard-\d+\.json$/),
        { existing: 'data' }
      );
    });

    it('should copy asset from archived to active location', async () => {
      const strategy = restoreStrategy as any;

      const mockDashboardStrategy = {
        restore: vi.fn().mockResolvedValue({ arn: mockAssetData.apiResponses.describe.data.Arn }),
        deleteExisting: vi.fn(),
        validate: vi.fn().mockResolvedValue([]),
      };

      strategy.restoreStrategyFactory = {
        getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
      };

      mockS3Service.objectExists.mockResolvedValue(false);
      mockS3Service.getObject.mockResolvedValueOnce(mockAssetData); // Get archived data

      await restoreStrategy.deploy('dashboard', 'test-dashboard', mockAssetData, mockConfig);

      // Verify asset was copied to active location
      expect(mockS3Service.getObject).toHaveBeenCalledWith(
        mockBucketName,
        'archived/dashboards/test-dashboard.json'
      );
      expect(mockS3Service.putObject).toHaveBeenCalledWith(
        mockBucketName,
        'assets/dashboards/test-dashboard.json',
        mockAssetData
      );
    });

    it('should create numbered backup of archived version', async () => {
      const strategy = restoreStrategy as any;

      const mockDashboardStrategy = {
        restore: vi.fn().mockResolvedValue({ arn: mockAssetData.apiResponses.describe.data.Arn }),
        deleteExisting: vi.fn(),
        validate: vi.fn().mockResolvedValue([]),
      };

      strategy.restoreStrategyFactory = {
        getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
      };

      // Simulate no existing active asset, but existing backups
      mockS3Service.objectExists
        .mockResolvedValueOnce(false) // Active asset doesn't exist (handleExistingAssetBackup check)
        .mockResolvedValueOnce(false); // backup-1 doesn't exist (createArchivedBackup finds first available)

      mockS3Service.getObject.mockResolvedValue(mockAssetData);

      await restoreStrategy.deploy('dashboard', 'test-dashboard', mockAssetData, mockConfig);

      // Should create backup-1 since it's the first available
      expect(mockS3Service.putObject).toHaveBeenCalledWith(
        mockBucketName,
        'archived/dashboards/test-dashboard-previous-archive-1.json',
        expect.objectContaining({
          ...mockAssetData,
          backupMetadata: expect.objectContaining({
            backupNumber: 1,
            originalArchivePath: 'archived/dashboards/test-dashboard.json',
          }),
        })
      );
    });
  });
});

describe('RestoreStrategy - validate source', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  const mockAssetData = {
    apiResponses: {
      describe: {
        data: {
          Name: 'Test Dashboard',
        },
      },
    },
  };

  const mockConfig: DeploymentConfig = {
    deploymentType: 'restore',
    source: 'archive',
    target: {
      accountId: mockAwsAccountId,
      region: mockAwsRegion,
    },
    options: {},
    validation: {
      checkDependencies: true,
    },
  };

  it('should validate source is archive', async () => {
    const strategy = restoreStrategy as any;
    const mockDashboardStrategy = {
      validate: vi.fn().mockResolvedValue([]),
    };

    strategy.restoreStrategyFactory = {
      getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
    };

    const invalidConfig = {
      ...mockConfig,
      source: 'quicksight' as any,
    };

    const results = await restoreStrategy.validate(
      'dashboard',
      'test-dashboard',
      mockAssetData,
      invalidConfig
    );

    const sourceValidation = results.find((r) => r.validator === 'source');
    expect(sourceValidation).toBeDefined();
    expect(sourceValidation?.passed).toBe(false);
    expect(sourceValidation?.message).toContain('requires source to be "archive"');
  });

  it('should validate asset data exists', async () => {
    const strategy = restoreStrategy as any;
    const mockDashboardStrategy = {
      validate: vi.fn().mockResolvedValue([]),
    };

    strategy.restoreStrategyFactory = {
      getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
    };

    const results = await restoreStrategy.validate('dashboard', 'test-dashboard', null, mockConfig);

    const dataValidation = results.find((r) => r.validator === 'asset-data');
    expect(dataValidation).toBeDefined();
    expect(dataValidation?.passed).toBe(false);
    expect(dataValidation?.message).toContain('not found in archive');
  });

  it('should validate asset ID format', async () => {
    const strategy = restoreStrategy as any;
    const mockDashboardStrategy = {
      validate: vi.fn().mockResolvedValue([]),
    };

    strategy.restoreStrategyFactory = {
      getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
    };

    const invalidIdConfig = {
      ...mockConfig,
      options: {
        id: 'invalid id with spaces!',
      },
    };

    const results = await restoreStrategy.validate(
      'dashboard',
      'test-dashboard',
      mockAssetData,
      invalidIdConfig
    );

    const idValidation = results.find((r) => r.validator === 'asset-id');
    expect(idValidation).toBeDefined();
    expect(idValidation?.passed).toBe(false);
    expect(idValidation?.message).toContain('Invalid asset ID');
  });
});

describe('RestoreStrategy - validate existence', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  const mockAssetData = {
    apiResponses: {
      describe: {
        data: {
          Name: 'Test Dashboard',
        },
      },
    },
  };

  const mockConfig: DeploymentConfig = {
    deploymentType: 'restore',
    source: 'archive',
    target: {
      accountId: mockAwsAccountId,
      region: mockAwsRegion,
    },
    options: {},
    validation: {
      checkDependencies: true,
    },
  };

  it('should check if asset already exists', async () => {
    const strategy = restoreStrategy as any;
    const mockDashboardStrategy = {
      validate: vi.fn().mockResolvedValue([]),
    };

    strategy.restoreStrategyFactory = {
      getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
    };

    mockS3Service.objectExists.mockResolvedValue(true);

    const results = await restoreStrategy.validate(
      'dashboard',
      'test-dashboard',
      mockAssetData,
      mockConfig
    );

    const existsValidation = results.find((r) => r.validator === 'asset-exists');
    expect(existsValidation).toBeDefined();
    expect(existsValidation?.passed).toBe(false);
    expect(existsValidation?.message).toContain('already exists');
  });

  it('should allow restore if skipIfExists is true', async () => {
    mockS3Service.objectExists.mockResolvedValue(true);

    const skipConfig = {
      ...mockConfig,
      options: {
        skipIfExists: true,
      },
    };

    const strategy = restoreStrategy as any;
    const mockDashboardStrategy = {
      validate: vi.fn().mockResolvedValue([]),
    };

    strategy.restoreStrategyFactory = {
      getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
    };

    const results = await restoreStrategy.validate(
      'dashboard',
      'test-dashboard',
      mockAssetData,
      skipConfig
    );

    const existsValidation = results.find((r) => r.validator === 'asset-exists');
    expect(existsValidation).toBeUndefined();
  });

  it('should pass validation when all checks succeed', async () => {
    mockS3Service.objectExists.mockResolvedValue(false);

    const strategy = restoreStrategy as any;
    const mockDashboardStrategy = {
      validate: vi.fn().mockResolvedValue([]),
    };

    strategy.restoreStrategyFactory = {
      getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
    };

    const results = await restoreStrategy.validate(
      'dashboard',
      'test-dashboard',
      mockAssetData,
      mockConfig
    );

    const overallValidation = results.find((r) => r.validator === 'overall');
    expect(overallValidation).toBeDefined();
    expect(overallValidation?.passed).toBe(true);
    expect(overallValidation?.message).toContain('Ready to restore');
  });
});

describe('RestoreStrategy - cache update', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('cache update after restore', () => {
    it('should update cache with correct asset metadata', async () => {
      const mockAssetData = {
        apiResponses: {
          describe: {
            data: {
              DashboardId: 'test-dashboard',
              Name: 'Test Dashboard',
              Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard',
              CreatedTime: '2025-01-01T10:00:00Z',
              LastUpdatedTime: '2025-01-15T10:00:00Z',
            },
          },
          permissions: {
            data: [
              {
                Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
                Actions: ['quicksight:DescribeDashboard', 'quicksight:UpdateDashboard'],
              },
            ],
          },
          tags: {
            data: [
              { Key: 'Environment', Value: 'Production' },
              { Key: 'Team', Value: 'Analytics' },
            ],
          },
        },
      };

      const mockConfig: DeploymentConfig = {
        deploymentType: 'restore',
        source: 'archive',
        target: {
          accountId: mockAwsAccountId,
          region: mockAwsRegion,
        },
        options: {},
      };

      const strategy = restoreStrategy as any;

      const mockDashboardStrategy = {
        restore: vi.fn().mockResolvedValue({ arn: mockAssetData.apiResponses.describe.data.Arn }),
        deleteExisting: vi.fn(),
        validate: vi.fn().mockResolvedValue([]),
      };

      strategy.restoreStrategyFactory = {
        getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
      };

      mockS3Service.objectExists.mockResolvedValue(false);
      mockS3Service.getObject.mockResolvedValue(mockAssetData);

      await restoreStrategy.deploy('dashboard', 'test-dashboard', mockAssetData, mockConfig);

      // Verify cache was updated with all metadata
      expect(mockCacheService.replaceAsset).toHaveBeenCalledWith(
        'dashboard',
        'test-dashboard',
        expect.objectContaining({
          assetId: 'test-dashboard',
          assetType: 'dashboard',
          assetName: 'Test Dashboard',
          arn: mockAssetData.apiResponses.describe.data.Arn,
          status: AssetStatus.ACTIVE,
          enrichmentStatus: 'enriched',
          exportFilePath: 'assets/dashboards/test-dashboard.json',
          storageType: 'individual',
          tags: [
            { key: 'Environment', value: 'Production' },
            { key: 'Team', value: 'Analytics' },
          ],
          permissions: [
            {
              principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
              actions: ['quicksight:DescribeDashboard', 'quicksight:UpdateDashboard'],
            },
          ],
          metadata: expect.objectContaining({
            hasPermissions: true,
            hasTags: true,
            restoredAt: expect.any(String),
          }),
        })
      );
    });

    it('should handle cache rebuild failures gracefully', async () => {
      const strategy = restoreStrategy as any;

      const mockDashboardStrategy = {
        restore: vi.fn().mockResolvedValue({ arn: 'test-arn' }),
        deleteExisting: vi.fn(),
        validate: vi.fn().mockResolvedValue([]),
      };

      strategy.restoreStrategyFactory = {
        getStrategy: vi.fn().mockReturnValue(mockDashboardStrategy),
      };

      mockS3Service.objectExists.mockResolvedValue(false);
      mockCacheService.rebuildCacheForAssetType.mockRejectedValue(
        new Error('Cache rebuild failed')
      );

      const mockConfig: DeploymentConfig = {
        deploymentType: 'restore',
        source: 'archive',
        target: {
          accountId: mockAwsAccountId,
          region: mockAwsRegion,
        },
        options: {},
      };

      const result = await restoreStrategy.deploy(
        'dashboard',
        'test-dashboard',
        { apiResponses: { describe: { data: { Name: 'Test' } } } },
        mockConfig
      );

      // Restore should still succeed even if cache rebuild fails
      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to rebuild cache after restore'),
        expect.any(Error)
      );
    });
  });
});
