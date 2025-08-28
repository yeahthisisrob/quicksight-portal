import { vi, type Mocked } from 'vitest';

import type { AssetExportData } from '../../../../../../../shared/models/asset-export.model';
import type { QuickSightService } from '../../../../../../../shared/services/aws/QuickSightService';
import type { S3Service } from '../../../../../../../shared/services/aws/S3Service';
import { logger } from '../../../../../../../shared/utils/logger';
import { DashboardRestoreStrategy } from '../DashboardRestoreStrategy';

vi.mock('../../../../../../../shared/utils/logger');

const PERMISSIONS_COUNT = 1;
const TAGS_COUNT = 1;
const DATASETS_COUNT = 2;
const COMPLEX_PERMISSIONS_COUNT = 2;

// Test setup utilities
let strategy: DashboardRestoreStrategy;
let mockQuickSightService: Mocked<QuickSightService>;
let mockS3Service: Mocked<S3Service>;
const mockAwsAccountId = '123456789012';
const mockBucketName = 'test-bucket';

function setupTestEnvironment() {
  vi.clearAllMocks();

  mockQuickSightService = {
    deleteDashboard: vi.fn(),
    createDashboard: vi.fn(),
    describeDataset: vi.fn(),
  } as any;

  mockS3Service = {
    objectExists: vi.fn(),
  } as any;

  strategy = new DashboardRestoreStrategy(
    mockQuickSightService,
    mockS3Service,
    mockAwsAccountId,
    'dashboard',
    mockBucketName
  );
}

describe('DashboardRestoreStrategy - restore basics', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('restore - basic functionality', () => {
    const mockDashboardData: AssetExportData = {
      apiResponses: {
        describe: {
          timestamp: new Date().toISOString(),
          data: {
            dashboardId: 'test-dashboard',
            Name: 'Test Dashboard',
            arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard',
          },
        },
        definition: {
          timestamp: new Date().toISOString(),
          data: {
            Definition: {
              DataSetIdentifierDeclarations: [
                {
                  Identifier: 'dataset1',
                  DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset1',
                },
              ],
              Sheets: [
                {
                  SheetId: 'sheet1',
                  Name: 'Sheet 1',
                  Visuals: [],
                },
              ],
            },
            DashboardPublishOptions: {
              AdHocFilteringOption: {
                AvailabilityStatus: 'ENABLED',
              },
            },
          },
        },
        permissions: {
          timestamp: new Date().toISOString(),
          data: [
            {
              Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
              Actions: ['quicksight:DescribeDashboard', 'quicksight:UpdateDashboard'],
            },
          ],
        },
        tags: {
          timestamp: new Date().toISOString(),
          data: [{ Key: 'Environment', Value: 'Production' }],
        },
      },
    } as unknown as AssetExportData;

    it('should successfully restore a dashboard', async () => {
      const expectedArn = 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard';
      mockQuickSightService.createDashboard.mockResolvedValue({
        arn: expectedArn,
        dashboardId: 'test-dashboard',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      const result = await strategy.restore('test-dashboard', mockDashboardData);

      expect(result.arn).toBe(expectedArn);
      expect(mockQuickSightService.createDashboard).toHaveBeenCalledWith({
        dashboardId: 'test-dashboard',
        name: 'Test Dashboard',
        definition: mockDashboardData.apiResponses.definition!.data.Definition,
        dashboardPublishOptions:
          mockDashboardData.apiResponses.definition!.data.DashboardPublishOptions,
        permissions: mockDashboardData.apiResponses.permissions!.data,
        tags: [{ key: 'Environment', value: 'Production' }],
        sourceEntity: undefined,
        themeArn: undefined,
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Restoring dashboard',
        expect.objectContaining({
          assetId: 'test-dashboard',
          assetType: 'dashboard',
          name: 'Test Dashboard',
          hasDefinition: true,
          hasPublishOptions: true,
          permissionCount: PERMISSIONS_COUNT,
          tagCount: TAGS_COUNT,
        })
      );
    });

    it('should throw error when definition is missing', async () => {
      const dataWithoutDefinition: AssetExportData = {
        apiResponses: {
          describe: {
            timestamp: new Date().toISOString(),
            data: {
              Name: 'Test Dashboard',
            },
          },
        },
      };

      await expect(strategy.restore('test-dashboard', dataWithoutDefinition)).rejects.toThrow(
        'No dashboard definition found for dashboard test-dashboard'
      );

      expect(mockQuickSightService.createDashboard).not.toHaveBeenCalled();
    });
  });
});

describe('DashboardRestoreStrategy - restore edge cases', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('restore - edge cases', () => {
    it('should handle missing permissions and tags', async () => {
      const minimalData: AssetExportData = {
        apiResponses: {
          describe: {
            timestamp: new Date().toISOString(),
            data: {
              Name: 'Minimal Dashboard',
            },
          },
          definition: {
            timestamp: new Date().toISOString(),
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                Sheets: [],
              },
            },
          },
        },
      };

      mockQuickSightService.createDashboard.mockResolvedValue({
        arn: 'test-arn',
        dashboardId: 'test-dashboard',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-dashboard', minimalData);

      expect(mockQuickSightService.createDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: [],
          // No tags property when there are no tags
        })
      );
    });
  });
});

describe('DashboardRestoreStrategy - date handling', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('restore - date handling', () => {
    it('should handle date fields in definition', async () => {
      const dataWithDates: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Name: 'Dashboard with Dates',
              CreatedTime: '2025-01-01T10:00:00Z',
              LastUpdatedTime: '2025-01-15T10:00:00Z',
            },
          },
          definition: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                Sheets: [],
                CreatedTime: '2025-01-01T10:00:00Z',
                LastUpdatedTime: '2025-01-15T10:00:00Z',
              },
              DashboardPublishOptions: {
                LastPublishedTime: '2025-01-14T10:00:00Z',
              },
            },
          },
        },
      } as AssetExportData;

      mockQuickSightService.createDashboard.mockResolvedValue({
        arn: 'test-arn',
        dashboardId: 'test-dashboard',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-dashboard', dataWithDates);

      // The cleanDatesInDefinition method should have been removed,
      // so dates pass through unchanged (with TODO comment about SDK issue)
      const callArgs = mockQuickSightService.createDashboard.mock.calls[0]![0];
      expect((callArgs.definition as any)?.CreatedTime).toBe('2025-01-01T10:00:00Z');
      expect((callArgs.dashboardPublishOptions as any)?.LastPublishedTime).toBe(
        '2025-01-14T10:00:00Z'
      );
    });
  });
});

describe('DashboardRestoreStrategy - deleteExisting', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('deleteExisting', () => {
    it('should delete existing dashboard successfully', async () => {
      mockQuickSightService.deleteDashboard.mockResolvedValue(undefined);

      await strategy.deleteExisting('test-dashboard');

      expect(mockQuickSightService.deleteDashboard).toHaveBeenCalledWith('test-dashboard');
      expect(logger.info).toHaveBeenCalledWith(
        'Deleted existing dashboard test-dashboard before restore'
      );
    });

    it('should handle ResourceNotFoundException gracefully', async () => {
      const notFoundError = new Error('Dashboard not found');
      (notFoundError as any).name = 'ResourceNotFoundException';
      mockQuickSightService.deleteDashboard.mockRejectedValue(notFoundError);

      await expect(strategy.deleteExisting('test-dashboard')).resolves.not.toThrow();

      expect(mockQuickSightService.deleteDashboard).toHaveBeenCalledWith('test-dashboard');
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should throw other errors', async () => {
      const otherError = new Error('Permission denied');
      mockQuickSightService.deleteDashboard.mockRejectedValue(otherError);

      await expect(strategy.deleteExisting('test-dashboard')).rejects.toThrow('Permission denied');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete existing dashboard test-dashboard before restore',
        expect.objectContaining({
          error: 'Permission denied',
        })
      );
    });
  });
});

describe('DashboardRestoreStrategy - validateDependencies', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('validateDependencies', () => {
    const mockDashboardData: AssetExportData = {
      apiResponses: {
        describe: {
          data: {
            Definition: {
              DataSetIdentifierDeclarations: [
                {
                  Identifier: 'dataset1',
                  DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset1',
                },
                {
                  Identifier: 'dataset2',
                  DataSetArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset2',
                },
              ],
            },
          },
        },
      },
    } as AssetExportData;

    it('should validate all datasets exist', async () => {
      mockS3Service.objectExists.mockResolvedValue(true);

      const results = await (strategy as any).validateDependencies(
        'test-dashboard',
        mockDashboardData
      );

      expect(results).toHaveLength(0);
      expect(mockS3Service.objectExists).toHaveBeenCalledTimes(DATASETS_COUNT);
      expect(mockS3Service.objectExists).toHaveBeenCalledWith(
        mockBucketName,
        'assets/datasets/dataset1.json'
      );
      expect(mockS3Service.objectExists).toHaveBeenCalledWith(
        mockBucketName,
        'assets/datasets/dataset2.json'
      );
    });

    it('should report missing datasets', async () => {
      mockS3Service.objectExists
        .mockResolvedValueOnce(true) // dataset1 exists
        .mockResolvedValueOnce(false); // dataset2 doesn't exist

      const results = await (strategy as any).validateDependencies(
        'test-dashboard',
        mockDashboardData
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        validator: 'dependencies',
        passed: false,
        message: 'Required dataset dataset2 not found',
        severity: 'warning',
        details: {
          assetId: 'test-dashboard',
          datasetId: 'dataset2',
        },
      });
    });

    it('should handle dashboards with no datasets', async () => {
      const dataWithoutDatasets: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
              },
            },
          },
        },
      } as AssetExportData;

      const results = await (strategy as any).validateDependencies(
        'test-dashboard',
        dataWithoutDatasets
      );

      expect(results).toHaveLength(0);
      expect(mockS3Service.objectExists).not.toHaveBeenCalled();
    });
  });
});

describe('DashboardRestoreStrategy - edge cases', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('dashboard with theme', () => {
    it('should handle dashboard with theme', async () => {
      const dataWithTheme: AssetExportData = {
        apiResponses: {
          describe: {
            data: {
              Name: 'Themed Dashboard',
            },
          },
          definition: {
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                Sheets: [],
              },
              ThemeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/custom-theme',
            },
          },
        },
      } as AssetExportData;

      mockQuickSightService.createDashboard.mockResolvedValue({
        arn: 'test-arn',
        dashboardId: 'test-dashboard',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-dashboard', dataWithTheme);

      expect(mockQuickSightService.createDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          themeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/custom-theme',
        })
      );
    });
  });

  describe('complex permission structures', () => {
    it('should handle complex permission structures', async () => {
      const complexPermissions: AssetExportData = {
        apiResponses: {
          describe: {
            timestamp: new Date().toISOString(),
            data: {
              Name: 'Dashboard with Complex Permissions',
            },
          },
          definition: {
            timestamp: new Date().toISOString(),
            data: {
              Definition: {
                DataSetIdentifierDeclarations: [],
                Sheets: [],
              },
            },
          },
          permissions: {
            timestamp: new Date().toISOString(),
            data: [
              {
                Principal: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1',
                Actions: [
                  'quicksight:DescribeDashboard',
                  'quicksight:UpdateDashboard',
                  'quicksight:DeleteDashboard',
                ],
              },
              {
                Principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/viewers',
                Actions: ['quicksight:DescribeDashboard'],
              },
            ],
          },
        },
      } as unknown as AssetExportData;

      mockQuickSightService.createDashboard.mockResolvedValue({
        arn: 'test-arn',
        dashboardId: 'test-dashboard',
        creationStatus: 'CREATION_SUCCESSFUL',
      });

      await strategy.restore('test-dashboard', complexPermissions);

      expect(mockQuickSightService.createDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: complexPermissions.apiResponses.permissions!.data,
        })
      );

      // Verify the permissions count
      expect(complexPermissions.apiResponses.permissions!.data).toHaveLength(
        COMPLEX_PERMISSIONS_COUNT
      );
    });
  });
});
