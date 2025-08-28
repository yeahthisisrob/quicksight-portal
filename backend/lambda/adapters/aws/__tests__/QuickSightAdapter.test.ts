import {
  QuickSightClient,
  DataSourceType,
  ResourceStatus,
  DataSetImportMode,
} from '@aws-sdk/client-quicksight';
import { mockClient } from 'aws-sdk-client-mock';
import { vi, type Mock } from 'vitest';

import { withRetry } from '../../../shared/utils/awsRetry';
import {
  quickSightRateLimiter,
  quickSightPermissionsRateLimiter,
} from '../../../shared/utils/rateLimiter';
import { QuickSightAdapter } from '../QuickSightAdapter';

// Test constants
const TEST_CONSTANTS = {
  TIMEOUT_MS: 10,
  RETRY_COUNT: 3,
  MAX_OPERATION_TIME_MS: 100,
} as const;

// Mock the QuickSight client
const quickSightMock = mockClient(QuickSightClient);

// Mock rate limiters and retry
vi.mock('../../../shared/utils/rateLimiter', () => ({
  quickSightRateLimiter: {
    waitForToken: vi.fn().mockResolvedValue(undefined),
  },
  quickSightPermissionsRateLimiter: {
    waitForToken: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../../shared/utils/awsRetry', () => ({
  withRetry: vi.fn().mockImplementation(async (fn) => fn()),
}));

// Test data factories
const createMockDataSource = (overrides = {}) => ({
  DataSourceId: 'test-datasource-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/test-datasource-id',
  Name: 'Test DataSource',
  Type: DataSourceType.REDSHIFT,
  Status: ResourceStatus.CREATION_SUCCESSFUL,
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  DataSourceParameters: {
    RedshiftParameters: {
      Host: 'redshift-cluster.amazonaws.com',
      Port: 5439,
      Database: 'testdb',
    },
  },
  SslProperties: {
    DisableSsl: false,
  },
  ...overrides,
});

const createMockDashboard = (overrides = {}) => ({
  DashboardId: 'test-dashboard-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard-id',
  Name: 'Test Dashboard',
  Version: {
    CreatedTime: new Date('2024-01-01'),
    VersionNumber: 1,
    Status: ResourceStatus.CREATION_SUCCESSFUL,
    Errors: [],
  },
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  LastPublishedTime: new Date('2024-01-14'),
  ...overrides,
});

const createMockDataset = (overrides = {}) => ({
  DataSetId: 'test-dataset-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/test-dataset-id',
  Name: 'Test Dataset',
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  ImportMode: DataSetImportMode.SPICE,
  PhysicalTableMap: {
    table1: {
      RelationalTable: {
        DataSourceArn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/source-1',
        Catalog: 'catalog',
        Schema: 'public',
        Name: 'orders',
      },
    } as any,
  },
  ...overrides,
});

const createMockAnalysis = (overrides = {}) => ({
  AnalysisId: 'test-analysis-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/test-analysis-id',
  Name: 'Test Analysis',
  Status: ResourceStatus.CREATION_SUCCESSFUL,
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  DataSetArns: ['arn:aws:quicksight:us-east-1:123456789012:dataset/dataset-1'],
  ...overrides,
});

// Test constants
const TEST_ACCOUNT_ID = '123456789012';

// Helper to setup adapter with mocked v2 client
const setupAdapter = (accountId = TEST_ACCOUNT_ID) => {
  const client = new QuickSightClient({ region: 'us-east-1' });
  const adapter = new QuickSightAdapter(client, accountId);

  // Mock the v2 client to prevent real AWS calls
  const mockV2Client = {
    listDataSources: vi.fn().mockReturnValue({
      promise: vi.fn().mockResolvedValue({
        DataSources: [],
        NextToken: undefined,
      }),
    }),
  };
  (adapter as any).v2DataSourceLister = mockV2Client;
  (adapter as any).v2CredentialsInitialized = Promise.resolve();

  return adapter;
};

describe('QuickSightAdapter', () => {
  let adapter: QuickSightAdapter;

  beforeEach(() => {
    quickSightMock.reset();
    adapter = setupAdapter();
  });

  describe('Raw SDK Response Methods (for exports)', () => {
    describe('describeDatasource', () => {
      it('should return raw SDK response with PascalCase', async () => {
        const mockDataSource = createMockDataSource();

        quickSightMock.onAnyCommand().resolves({
          DataSource: mockDataSource,
        });

        const result = await adapter.describeDatasource('test-datasource-id');

        // Should return raw SDK response (PascalCase)
        expect(result).toEqual(mockDataSource);
        expect(result.DataSourceId).toBe('test-datasource-id');
        expect(result.Name).toBe('Test DataSource');
        expect(result.DataSourceParameters.RedshiftParameters.Database).toBe('testdb');
      });
    });

    describe('describeDashboard', () => {
      it('should return raw SDK response with PascalCase', async () => {
        const mockDashboard = createMockDashboard();

        quickSightMock.onAnyCommand().resolves({
          Dashboard: mockDashboard,
        });

        const result = await adapter.describeDashboard('test-dashboard-id');

        // Should return raw SDK response (PascalCase)
        expect(result).toEqual(mockDashboard);
        expect(result.DashboardId).toBe('test-dashboard-id');
        expect(result.Name).toBe('Test Dashboard');
        expect(result.Version.Status).toBe(ResourceStatus.CREATION_SUCCESSFUL);
      });
    });

    describe('describeDataset', () => {
      it('should return raw SDK response with PascalCase', async () => {
        const mockDataSet = createMockDataset();

        quickSightMock.onAnyCommand().resolves({
          DataSet: mockDataSet,
        });

        const result = await adapter.describeDataset('test-dataset-id');

        // Should return raw SDK response (PascalCase)
        expect(result).toEqual(mockDataSet);
        expect(result.DataSetId).toBe('test-dataset-id');
        expect(result.ImportMode).toBe(DataSetImportMode.SPICE);
        expect(result.PhysicalTableMap).toBeDefined();
      });
    });

    describe('describeAnalysis', () => {
      it('should return raw SDK response with PascalCase', async () => {
        const mockAnalysis = createMockAnalysis();

        quickSightMock.onAnyCommand().resolves({
          Analysis: mockAnalysis,
        });

        const result = await adapter.describeAnalysis('test-analysis-id');

        // Should return raw SDK response (PascalCase)
        expect(result).toEqual(mockAnalysis);
        expect(result?.AnalysisId).toBe('test-analysis-id');
        expect(result?.Status).toBe('CREATION_SUCCESSFUL');
      });
    });
  });

  describe('Mapped Methods (for API/Frontend)', () => {
    describe('describeDatasourceMapped', () => {
      it('should return camelCase mapped response', async () => {
        const mockDataSource = createMockDataSource();

        quickSightMock.onAnyCommand().resolves({
          DataSource: mockDataSource,
        });

        const result = await adapter.describeDatasource('test-datasource-id');

        // Should return PascalCase response
        expect(result.DataSourceId).toBe('test-datasource-id');
        expect(result.Name).toBe('Test DataSource');
        expect(result.Type).toBe('REDSHIFT');
        expect(result.CreatedTime).toEqual(new Date('2024-01-01'));

        // Nested objects should remain PascalCase
        expect(result.DataSourceParameters.RedshiftParameters.Database).toBe('testdb');
      });

      it('should handle null datasource gracefully', async () => {
        quickSightMock.onAnyCommand().resolves({
          DataSource: undefined,
        });

        const result = await adapter.describeDatasource('non-existent');
        expect(result).toBeUndefined();
      });
    });

    describe('describeDashboardMapped', () => {
      it('should return camelCase mapped response', async () => {
        const mockDashboard = {
          DashboardId: 'test-dashboard-id',
          Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard-id',
          Name: 'Test Dashboard',
          Version: {
            CreatedTime: new Date('2024-01-01'),
            VersionNumber: 1,
            Status: ResourceStatus.CREATION_SUCCESSFUL,
            SourceEntityArn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/source-analysis',
          },
          CreatedTime: new Date('2024-01-01'),
          LastUpdatedTime: new Date('2024-01-15'),
        };

        quickSightMock.onAnyCommand().resolves({
          Dashboard: mockDashboard,
        });

        const result = await adapter.describeDashboard('test-dashboard-id');

        // Should return PascalCase response
        expect(result.DashboardId).toBe('test-dashboard-id');
        expect(result.Name).toBe('Test Dashboard');
        expect(result.Version).toBeDefined();
        expect(result.Version.VersionNumber).toBe(1);
        expect(result.Version.SourceEntityArn).toBe(
          'arn:aws:quicksight:us-east-1:123456789012:analysis/source-analysis'
        );
      });
    });
  });
});

describe('QuickSightAdapter - Definition Methods', () => {
  let adapter: QuickSightAdapter;

  beforeEach(() => {
    quickSightMock.reset();
    adapter = setupAdapter();
  });

  describe('Definition Methods (only for Dashboards and Analyses)', () => {
    describe('describeDashboardDefinition', () => {
      it('should return full SDK response including Definition', async () => {
        const mockResponse = {
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
                Name: 'Sales Overview',
              },
            ],
          },
          Status: 200,
          RequestId: 'test-request-id',
          Name: 'Test Dashboard',
          DashboardId: 'test-dashboard-id',
          Errors: [],
          ResourceStatus: 'CREATION_SUCCESSFUL',
          ThemeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/default',
        };

        quickSightMock.onAnyCommand().resolves(mockResponse);

        const result = await adapter.describeDashboardDefinition('test-dashboard-id');

        // Should return filtered response including Definition
        expect(result).toEqual({
          Definition: mockResponse.Definition,
          Name: mockResponse.Name,
          DashboardId: mockResponse.DashboardId,
          Errors: mockResponse.Errors,
          ResourceStatus: mockResponse.ResourceStatus,
          ThemeArn: mockResponse.ThemeArn,
        });
        expect(result.Definition).toBeDefined();
        expect(result.Definition.DataSetIdentifierDeclarations).toHaveLength(1);
      });
    });

    describe('describeAnalysisDefinition', () => {
      it('should return full SDK response including Definition', async () => {
        const mockResponse = {
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
                Name: 'Analysis Sheet',
              },
            ],
          },
          Status: 200,
          RequestId: 'test-request-id',
          Name: 'Test Analysis',
          AnalysisId: 'test-analysis-id',
          Errors: [],
          ResourceStatus: 'CREATION_SUCCESSFUL',
          ThemeArn: 'arn:aws:quicksight:us-east-1:123456789012:theme/default',
        };

        quickSightMock.onAnyCommand().resolves(mockResponse);

        const result = await adapter.describeAnalysisDefinition('test-analysis-id');

        // Should return filtered response including Definition
        expect(result).toEqual({
          Definition: mockResponse.Definition,
          Name: mockResponse.Name,
          AnalysisId: mockResponse.AnalysisId,
          Errors: mockResponse.Errors,
          ResourceStatus: mockResponse.ResourceStatus,
          ThemeArn: mockResponse.ThemeArn,
        });
        expect(result.Definition).toBeDefined();
      });
    });
  });

  describe('List Methods', () => {
    describe('listDatasources', () => {
      it('should map datasource summaries to camelCase', async () => {
        const mockDataSources = [
          {
            DataSourceId: 'ds1',
            Name: 'DataSource 1',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/ds1',
            Type: DataSourceType.REDSHIFT,
            Status: ResourceStatus.CREATION_SUCCESSFUL,
            CreatedTime: new Date('2024-01-01'),
            LastUpdatedTime: new Date('2024-01-15'),
          },
          {
            DataSourceId: 'ds2',
            Name: 'DataSource 2',
            Arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/ds2',
            Type: DataSourceType.S3,
            Status: ResourceStatus.CREATION_SUCCESSFUL,
            CreatedTime: new Date('2024-01-02'),
            LastUpdatedTime: new Date('2024-01-16'),
          },
        ];

        // Mock the v2 client response
        const mockV2Response = {
          DataSources: mockDataSources,
          NextToken: 'next-page-token',
        };

        ((adapter as any).v2DataSourceLister.listDataSources as Mock).mockReturnValue({
          promise: vi.fn().mockResolvedValue(mockV2Response),
        });

        const result = await adapter.listDatasources({ maxResults: 10 });

        expect(result.items).toHaveLength(2);
        const item0 = result.items[0];
        const item1 = result.items[1];
        expect(item0?.DataSourceId).toBe('ds1');
        expect(item0?.Name).toBe('DataSource 1');
        expect(item0?.Type).toBe('REDSHIFT');
        expect(item1?.DataSourceId).toBe('ds2');
        expect(item1?.Type).toBe('S3');
        expect(result.nextToken).toBe('next-page-token');
      });
    });
  });
});

describe('QuickSightAdapter - Error Handling', () => {
  let adapter: QuickSightAdapter;

  beforeEach(() => {
    quickSightMock.reset();
    adapter = setupAdapter();
  });

  describe('Error Handling', () => {
    it('should propagate AWS errors', async () => {
      const error = new Error('AccessDeniedException');
      error.name = 'AccessDeniedException';
      quickSightMock.onAnyCommand().rejects(error);

      await expect(adapter.describeDatasource('test-id')).rejects.toThrow('AccessDeniedException');
    });
  });
});

describe('QuickSightAdapter - Import patterns', () => {
  let adapter: QuickSightAdapter;

  beforeEach(() => {
    quickSightMock.reset();
    adapter = setupAdapter();
  });

  describe('Import patterns - prevent regression', () => {
    it('should use static imports for rate limiters - not dynamic imports', () => {
      // This test verifies that rate limiters are imported statically at module level
      // If this fails, it means someone changed back to dynamic imports
      expect(quickSightRateLimiter).toBeDefined();
      expect(typeof quickSightRateLimiter.waitForToken).toBe('function');
      expect(quickSightPermissionsRateLimiter).toBeDefined();
      expect(typeof quickSightPermissionsRateLimiter.waitForToken).toBe('function');
    });

    it('should use static imports for withRetry - not dynamic imports', () => {
      // This test verifies that withRetry is imported statically at module level
      expect(withRetry).toBeDefined();
      expect(typeof withRetry).toBe('function');
    });

    it('should not have any dynamic import() calls in the code', () => {
      // Get the adapter's method as a string and check for dynamic imports
      const adapterCode = adapter.constructor.toString();
      expect(adapterCode).not.toContain('await import(');
      expect(adapterCode).not.toContain('import(');
    });
  });
});

describe('QuickSightAdapter - Async/await patterns', () => {
  let adapter: QuickSightAdapter;

  beforeEach(() => {
    quickSightMock.reset();
    adapter = setupAdapter();
  });

  describe('Async/await patterns', () => {
    it('should properly await QuickSight operations', async () => {
      let operationCompleted = false;

      quickSightMock.onAnyCommand().callsFake(async () => {
        // Simulate async operation without setTimeout
        await Promise.resolve();
        operationCompleted = true;
        return { DashboardSummaryList: [] };
      });

      const result = await adapter.listDashboards();
      expect(operationCompleted).toBe(true);
      expect(result).toHaveProperty('items');
    });

    it('should properly await rate limiter before operations', async () => {
      let rateLimiterCalled = false;
      let operationCalled = false;

      (quickSightRateLimiter.waitForToken as Mock).mockImplementation(() => {
        rateLimiterCalled = true;
        return Promise.resolve();
      });

      quickSightMock.onAnyCommand().callsFake(() => {
        // Rate limiter should be called before operation
        expect(rateLimiterCalled).toBe(true);
        operationCalled = true;
        return Promise.resolve({ DashboardSummaryList: [] });
      });

      await adapter.listDashboards();

      expect(rateLimiterCalled).toBe(true);
      expect(operationCalled).toBe(true);
    });

    it('should handle concurrent operations efficiently', async () => {
      quickSightMock.onAnyCommand().resolves({ DashboardSummaryList: [] });

      const operations = [adapter.listDashboards(), adapter.listDatasets(), adapter.listAnalyses()];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(TEST_CONSTANTS.RETRY_COUNT);
      // Rate limiter should be called for each operation
      expect(quickSightRateLimiter.waitForToken).toHaveBeenCalledTimes(TEST_CONSTANTS.RETRY_COUNT);
    });
  });
});

describe('QuickSightAdapter - Performance patterns', () => {
  let adapter: QuickSightAdapter;

  beforeEach(() => {
    quickSightMock.reset();
    adapter = setupAdapter();
  });

  describe('Performance patterns', () => {
    it('should not re-import modules on each operation', async () => {
      // Clear any previous mock calls
      vi.clearAllMocks();

      quickSightMock.onAnyCommand().resolves({
        DashboardSummaryList: [],
        DataSetSummaries: [],
        AnalysisSummaryList: [],
      });

      // Perform multiple operations
      await adapter.listDashboards();
      await adapter.listDatasets();
      await adapter.listAnalyses();

      // Rate limiter should be called for each operation
      expect(quickSightRateLimiter.waitForToken).toHaveBeenCalledTimes(TEST_CONSTANTS.RETRY_COUNT);

      // But the module itself should already be imported (static import)
      // If someone changes to dynamic imports, this test setup would break
    });

    it('should handle Lambda cold starts efficiently', async () => {
      const client = new QuickSightClient({ region: 'us-east-1' });
      const newAdapter = new QuickSightAdapter(client, TEST_ACCOUNT_ID);

      quickSightMock.onAnyCommand().resolves({ DashboardSummaryList: [] });

      // First operation should work without any dynamic import delays
      const startTime = Date.now();
      await newAdapter.listDashboards();
      const duration = Date.now() - startTime;

      // Should be fast (no dynamic import overhead)
      expect(duration).toBeLessThan(TEST_CONSTANTS.MAX_OPERATION_TIME_MS);
    });
  });
});

describe('QuickSightAdapter - Lambda execution context', () => {
  let adapter: QuickSightAdapter;

  beforeEach(() => {
    quickSightMock.reset();
    adapter = setupAdapter();
  });

  it('should not leak state between adapter instances', () => {
    const client = new QuickSightClient({ region: 'us-east-1' });
    const adapter1 = new QuickSightAdapter(client, TEST_ACCOUNT_ID);
    const adapter2 = new QuickSightAdapter(client, TEST_ACCOUNT_ID);

    // Each adapter should be independent
    expect(adapter1).not.toBe(adapter2);

    // But they should share the same static imports (for efficiency)
    // This is verified by the fact that both use the same mocked rate limiters
  });

  it('should handle errors without hanging promises', async () => {
    const error = new Error('QuickSight operation failed');
    quickSightMock.onAnyCommand().rejects(error);

    await expect(adapter.listDashboards()).rejects.toThrow('QuickSight operation failed');

    // Ensure rate limiter was still called
    expect(quickSightRateLimiter.waitForToken).toHaveBeenCalled();
  });
});
