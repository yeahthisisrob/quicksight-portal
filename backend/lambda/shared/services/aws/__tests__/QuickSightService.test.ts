import { vi, type Mock, type Mocked } from 'vitest';

import { QuickSightAdapter } from '../../../../adapters/aws/QuickSightAdapter';
import { type OperationTracker } from '../../../models/operations.model';
import * as awsRetry from '../../../utils/awsRetry';
import { QuickSightService } from '../QuickSightService';

// Test constants
const TEST_CONSTANTS = {
  PAGE_SIZE: 10,
  AWS_ACCOUNT_ID: '123456789012',
  AWS_REGION: 'us-east-1',
  VERSION_NUMBER: 5,
} as const;

// Mock dependencies
vi.mock('../../../../adapters/aws/QuickSightAdapter');
vi.mock('../S3Service');
vi.mock('../../../utils/logger');
vi.mock('../../../utils/awsRetry');

// Test data factories
const createMockDatasource = (overrides = {}) => ({
  DataSourceId: 'test-datasource-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/test-datasource-id',
  Name: 'Test DataSource',
  Type: 'REDSHIFT',
  Status: 'CREATION_SUCCESSFUL',
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  DataSourceParameters: {
    RedshiftParameters: {
      Host: 'redshift-cluster.amazonaws.com',
      Port: 5439,
      Database: 'testdb',
    },
  },
  ...overrides,
});

const createMockDashboard = (overrides = {}) => ({
  DashboardId: 'test-dashboard-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/test-dashboard-id',
  Name: 'Test Dashboard',
  Version: {
    VersionNumber: 1,
    Status: 'CREATION_SUCCESSFUL',
  },
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  ...overrides,
});

const createMockDataset = (overrides = {}) => ({
  DataSetId: 'test-dataset-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/test-dataset-id',
  Name: 'Test Dataset',
  ImportMode: 'SPICE',
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  ...overrides,
});

const createMockAnalysis = (overrides = {}) => ({
  AnalysisId: 'test-analysis-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/test-analysis-id',
  Name: 'Test Analysis',
  Status: 'CREATION_SUCCESSFUL' as const,
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  ...overrides,
});

const createMockFolder = (overrides = {}) => ({
  FolderId: 'test-folder-id',
  Arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/test-folder-id',
  Name: 'Test Folder',
  CreatedTime: new Date('2024-01-01'),
  LastUpdatedTime: new Date('2024-01-15'),
  ...overrides,
});

describe('QuickSightService - Describe', () => {
  let service: QuickSightService;
  let mockAdapter: Mocked<QuickSightAdapter>;
  let mockOperationTracker: Mocked<OperationTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    (awsRetry.withRetry as Mock).mockImplementation((fn) => fn());
    mockAdapter = new QuickSightAdapter(
      {} as any,
      TEST_CONSTANTS.AWS_ACCOUNT_ID
    ) as Mocked<QuickSightAdapter>;
    mockOperationTracker = {
      trackOperation: vi.fn(),
    } as any;
    service = new QuickSightService(TEST_CONSTANTS.AWS_ACCOUNT_ID, mockOperationTracker);
    (service as any).adapter = mockAdapter;
  });

  describe('Describe Operations', () => {
    describe('describeDatasource', () => {
      it('should return raw SDK response from adapter', async () => {
        const mockRawResponse = createMockDatasource();
        mockAdapter.describeDatasource.mockResolvedValue(mockRawResponse);

        const result = await service.describeDatasource('test-datasource-id', 'Test DataSource');

        expect(result).toEqual(mockRawResponse);
        expect(mockAdapter.describeDatasource).toHaveBeenCalledWith('test-datasource-id');
        expect(mockOperationTracker.trackOperation).toHaveBeenCalledWith({
          namespace: 'api',
          resource: 'datasource',
          action: 'describe',
          count: 1,
        });
      });
    });

    describe('describeDashboard', () => {
      it('should return raw SDK response from adapter', async () => {
        const mockRawResponse = createMockDashboard({
          Version: {
            CreatedTime: new Date('2024-01-01'),
            VersionNumber: 1,
            Status: 'CREATION_SUCCESSFUL',
          },
        });

        mockAdapter.describeDashboard.mockResolvedValue(mockRawResponse);
        const result = await service.describeDashboard('test-dashboard-id', 'Test Dashboard');

        expect(result).toEqual(mockRawResponse);
        expect(mockAdapter.describeDashboard).toHaveBeenCalledWith('test-dashboard-id');
      });
    });

    describe('describeDataset', () => {
      it('should return raw SDK response from adapter', async () => {
        const mockRawResponse = createMockDataset();
        mockAdapter.describeDataset.mockResolvedValue(mockRawResponse);

        const result = await service.describeDataset('test-dataset-id', 'Test Dataset');

        expect(result).toEqual(mockRawResponse);
        expect(mockAdapter.describeDataset).toHaveBeenCalledWith('test-dataset-id');
      });

      it('should handle FILE dataset errors silently', async () => {
        const error = new Error('FILE datasets are not supported through API');
        mockAdapter.describeDataset.mockRejectedValue(error);

        await expect(service.describeDataset('test-dataset-id')).rejects.toThrow(error);
        expect(mockAdapter.describeDataset).toHaveBeenCalledWith('test-dataset-id');
      });
    });

    describe('describeAnalysis', () => {
      it('should return raw SDK response from adapter', async () => {
        const mockRawResponse = createMockAnalysis();
        mockAdapter.describeAnalysis.mockResolvedValue(mockRawResponse);

        const result = await service.describeAnalysis('test-analysis-id', 'Test Analysis');

        expect(result).toEqual(mockRawResponse);
        expect(mockAdapter.describeAnalysis).toHaveBeenCalledWith('test-analysis-id');
      });
    });

    describe('describeFolder', () => {
      it('should return raw SDK response from adapter', async () => {
        const mockRawResponse = createMockFolder();
        mockAdapter.describeFolder.mockResolvedValue(mockRawResponse);

        const result = await service.describeFolder('test-folder-id', 'Test Folder');

        expect(result).toEqual(mockRawResponse);
        expect(mockAdapter.describeFolder).toHaveBeenCalledWith('test-folder-id');
      });
    });
  });
});

describe('QuickSightService - Definition', () => {
  let service: QuickSightService;
  let mockAdapter: Mocked<QuickSightAdapter>;
  let mockOperationTracker: Mocked<OperationTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    (awsRetry.withRetry as Mock).mockImplementation((fn) => fn());
    mockAdapter = new QuickSightAdapter(
      {} as any,
      TEST_CONSTANTS.AWS_ACCOUNT_ID
    ) as Mocked<QuickSightAdapter>;
    mockOperationTracker = {
      trackOperation: vi.fn(),
    } as any;
    service = new QuickSightService(TEST_CONSTANTS.AWS_ACCOUNT_ID, mockOperationTracker);
    (service as any).adapter = mockAdapter;
  });

  describe('Definition Operations', () => {
    describe('describeDashboardDefinition', () => {
      it('should return full definition response from adapter', async () => {
        const mockDefinitionResponse = {
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
                Visuals: [],
              },
            ],
          },
          Status: 200,
          RequestId: 'test-request-id',
        };

        mockAdapter.describeDashboardDefinition.mockResolvedValue(mockDefinitionResponse);

        const result = await service.describeDashboardDefinition(
          'test-dashboard-id',
          'Test Dashboard'
        );

        expect(result).toEqual(mockDefinitionResponse);
        expect(mockAdapter.describeDashboardDefinition).toHaveBeenCalledWith(
          'test-dashboard-id',
          undefined
        );
      });

      it('should pass version number when provided', async () => {
        const mockDefinitionResponse = { Definition: {} };
        mockAdapter.describeDashboardDefinition.mockResolvedValue(mockDefinitionResponse);

        await service.describeDashboardDefinition(
          'test-dashboard-id',
          'Test Dashboard',
          TEST_CONSTANTS.VERSION_NUMBER
        );

        expect(mockAdapter.describeDashboardDefinition).toHaveBeenCalledWith(
          'test-dashboard-id',
          TEST_CONSTANTS.VERSION_NUMBER
        );
      });
    });

    describe('describeAnalysisDefinition', () => {
      it('should return full definition response from adapter', async () => {
        const mockDefinitionResponse = {
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
        };

        mockAdapter.describeAnalysisDefinition.mockResolvedValue(mockDefinitionResponse);

        const result = await service.describeAnalysisDefinition(
          'test-analysis-id',
          'Test Analysis'
        );

        expect(result).toEqual(mockDefinitionResponse);
        expect(mockAdapter.describeAnalysisDefinition).toHaveBeenCalledWith('test-analysis-id');
      });
    });
  });
});

describe('QuickSightService - Create Analysis and Dashboard', () => {
  let service: QuickSightService;
  let mockAdapter: Mocked<QuickSightAdapter>;
  let mockOperationTracker: Mocked<OperationTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    (awsRetry.withRetry as Mock).mockImplementation((fn) => fn());
    mockAdapter = new QuickSightAdapter(
      {} as any,
      TEST_CONSTANTS.AWS_ACCOUNT_ID
    ) as Mocked<QuickSightAdapter>;
    mockOperationTracker = {
      trackOperation: vi.fn(),
    } as any;
    service = new QuickSightService(TEST_CONSTANTS.AWS_ACCOUNT_ID, mockOperationTracker);
    (service as any).adapter = mockAdapter;
  });

  describe('Analysis and Dashboard', () => {
    describe('createAnalysis', () => {
      it('should create analysis with transformed tags', async () => {
        const params = {
          analysisId: 'new-analysis',
          name: 'New Analysis',
          definition: { DataSetIdentifierDeclarations: [], Sheets: [] } as any,
          permissions: [],
          tags: [
            { key: 'Environment', value: 'Production' },
            { key: 'Department', value: 'Sales' },
          ],
          sourceEntity: { SourceTemplate: { Arn: 'template-arn' } } as any,
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/new-analysis',
          analysisId: 'new-analysis',
          creationStatus: 'CREATION_SUCCESSFUL',
        };
        mockAdapter.createAnalysis.mockResolvedValue(mockResponse);

        const result = await service.createAnalysis(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createAnalysis).toHaveBeenCalledWith({
          ...params,
          tags: [
            { Key: 'Environment', Value: 'Production' },
            { Key: 'Department', Value: 'Sales' },
          ],
        });
        expect(mockOperationTracker.trackOperation).toHaveBeenCalledWith({
          namespace: 'api',
          resource: 'analysis',
          action: 'other',
          count: 1,
        });
      });

      it('should handle missing optional parameters', async () => {
        const params = {
          analysisId: 'new-analysis',
          name: 'New Analysis',
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/new-analysis',
          analysisId: 'new-analysis',
          creationStatus: 'CREATION_SUCCESSFUL',
        };
        mockAdapter.createAnalysis.mockResolvedValue(mockResponse);

        const result = await service.createAnalysis(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createAnalysis).toHaveBeenCalledWith({
          analysisId: 'new-analysis',
          name: 'New Analysis',
          tags: undefined,
        });
      });
    });

    describe('createDashboard', () => {
      it('should create dashboard with all parameters', async () => {
        const params = {
          dashboardId: 'new-dashboard',
          name: 'New Dashboard',
          definition: { DataSetIdentifierDeclarations: [], Sheets: [] } as any,
          permissions: [],
          tags: [{ key: 'Owner', value: 'Analytics' }],
          dashboardPublishOptions: {
            AdHocFilteringOption: { AvailabilityStatus: 'ENABLED' },
          } as any,
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/new-dashboard',
          dashboardId: 'new-dashboard',
          creationStatus: 'CREATION_SUCCESSFUL',
        };
        mockAdapter.createDashboard.mockResolvedValue(mockResponse);

        const result = await service.createDashboard(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createDashboard).toHaveBeenCalledWith({
          ...params,
          tags: [{ Key: 'Owner', Value: 'Analytics' }],
        });
      });
    });
  });
});

describe('QuickSightService - Create Data Resources', () => {
  let service: QuickSightService;
  let mockAdapter: Mocked<QuickSightAdapter>;
  let mockOperationTracker: Mocked<OperationTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    (awsRetry.withRetry as Mock).mockImplementation((fn) => fn());
    mockAdapter = new QuickSightAdapter(
      {} as any,
      TEST_CONSTANTS.AWS_ACCOUNT_ID
    ) as Mocked<QuickSightAdapter>;
    mockOperationTracker = {
      trackOperation: vi.fn(),
    } as any;
    service = new QuickSightService(TEST_CONSTANTS.AWS_ACCOUNT_ID, mockOperationTracker);
    (service as any).adapter = mockAdapter;
  });

  describe('Data Operations', () => {
    describe('createDataSet', () => {
      it('should create dataset with all parameters', async () => {
        const params = {
          dataSetId: 'new-dataset',
          name: 'New Dataset',
          physicalTableMap: { table1: { RelationalTable: { Name: 'sales' } } as any },
          logicalTableMap: { logical1: { Alias: 'Sales Data' } as any },
          importMode: 'SPICE' as const,
          permissions: [],
          tags: [{ key: 'Type', value: 'Sales' }],
          columnGroups: [],
          fieldFolders: {},
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/new-dataset',
          dataSetId: 'new-dataset',
          ingestionArn: undefined,
        };
        mockAdapter.createDataSet.mockResolvedValue(mockResponse);

        const result = await service.createDataSet(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createDataSet).toHaveBeenCalledWith({
          ...params,
          tags: [{ Key: 'Type', Value: 'Sales' }],
        });
      });
    });

    describe('createDataSource', () => {
      it('should create datasource with credentials', async () => {
        const params = {
          dataSourceId: 'new-datasource',
          name: 'New DataSource',
          type: 'POSTGRESQL',
          dataSourceParameters: {
            PostgreSqlParameters: {
              Host: 'db.example.com',
              Port: 5432,
              Database: 'mydb',
            },
          },
          credentials: {
            CredentialPair: {
              Username: 'dbuser',
              Password: 'dbpass',
            },
          },
          tags: [{ key: 'Environment', value: 'Dev' }],
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/new-datasource',
          dataSourceId: 'new-datasource',
          creationStatus: 'CREATION_SUCCESSFUL',
        };
        mockAdapter.createDataSource.mockResolvedValue(mockResponse);

        const result = await service.createDataSource(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createDataSource).toHaveBeenCalledWith({
          ...params,
          tags: [{ Key: 'Environment', Value: 'Dev' }],
        });
      });
    });
  });
});

describe('QuickSightService - Create Folder and Group', () => {
  let service: QuickSightService;
  let mockAdapter: Mocked<QuickSightAdapter>;
  let mockOperationTracker: Mocked<OperationTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    (awsRetry.withRetry as Mock).mockImplementation((fn) => fn());
    mockAdapter = new QuickSightAdapter(
      {} as any,
      TEST_CONSTANTS.AWS_ACCOUNT_ID
    ) as Mocked<QuickSightAdapter>;
    mockOperationTracker = {
      trackOperation: vi.fn(),
    } as any;
    service = new QuickSightService(TEST_CONSTANTS.AWS_ACCOUNT_ID, mockOperationTracker);
    (service as any).adapter = mockAdapter;
  });

  describe('Folder and Group Operations', () => {
    describe('createFolder', () => {
      it('should create folder with parent', async () => {
        const params = {
          folderId: 'new-folder',
          name: 'New Folder',
          parentFolderArn: 'arn:aws:quicksight:us-east-1:123456789012:folder/parent-folder',
          permissions: [],
          tags: [{ key: 'Department', value: 'HR' }],
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/new-folder',
          folderId: 'new-folder',
        };
        mockAdapter.createFolder.mockResolvedValue(mockResponse);

        const result = await service.createFolder(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createFolder).toHaveBeenCalledWith({
          ...params,
          tags: [{ Key: 'Department', Value: 'HR' }],
        });
      });
    });

    describe('createGroup', () => {
      it('should create group with description', async () => {
        const params = {
          groupName: 'new-group',
          description: 'Analytics Team',
          namespace: 'default',
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/new-group',
          groupName: 'new-group',
          principalId: 'principal-new-group',
        };
        mockAdapter.createGroup.mockResolvedValue(mockResponse);

        const result = await service.createGroup(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createGroup).toHaveBeenCalledWith(params);
      });
    });

    describe('createFolderMembership', () => {
      it('should create folder membership', async () => {
        const mockResponse = { Status: 200 };
        mockAdapter.createFolderMembership.mockResolvedValue(mockResponse);

        const result = await service.createFolderMembership(
          'folder-id',
          'dashboard-id',
          'DASHBOARD'
        );

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createFolderMembership).toHaveBeenCalledWith(
          'folder-id',
          'dashboard-id',
          'DASHBOARD'
        );
      });
    });

    describe('createGroupMembership', () => {
      it('should create group membership with default namespace', async () => {
        mockAdapter.createGroupMembership.mockResolvedValue(undefined);

        const result = await service.createGroupMembership('group-name', 'user-name');

        expect(result).toEqual(undefined);
        expect(mockAdapter.createGroupMembership).toHaveBeenCalledWith(
          'group-name',
          'user-name',
          'default'
        );
      });

      it('should create group membership with custom namespace', async () => {
        mockAdapter.createGroupMembership.mockResolvedValue(undefined);

        const result = await service.createGroupMembership('group-name', 'user-name', 'custom-ns');

        expect(result).toEqual(undefined);
        expect(mockAdapter.createGroupMembership).toHaveBeenCalledWith(
          'group-name',
          'user-name',
          'custom-ns'
        );
      });
    });

    describe('createRefreshSchedule', () => {
      it('should create refresh schedule', async () => {
        const schedule = {
          ScheduleId: 'schedule-1',
          ScheduleFrequency: { Interval: 'DAILY' },
          RefreshType: 'INCREMENTAL_REFRESH',
        };

        const mockResponse = { Status: 200, ScheduleId: 'schedule-1' };
        mockAdapter.createRefreshSchedule.mockResolvedValue(mockResponse);

        const result = await service.createRefreshSchedule('dataset-id', schedule);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.createRefreshSchedule).toHaveBeenCalledWith('dataset-id', schedule);
      });
    });
  });
});

describe('QuickSightService - Update Assets', () => {
  let service: QuickSightService;
  let mockAdapter: Mocked<QuickSightAdapter>;
  let mockOperationTracker: Mocked<OperationTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    (awsRetry.withRetry as Mock).mockImplementation((fn) => fn());
    mockAdapter = new QuickSightAdapter(
      {} as any,
      TEST_CONSTANTS.AWS_ACCOUNT_ID
    ) as Mocked<QuickSightAdapter>;
    mockOperationTracker = {
      trackOperation: vi.fn(),
    } as any;
    service = new QuickSightService(TEST_CONSTANTS.AWS_ACCOUNT_ID, mockOperationTracker);
    (service as any).adapter = mockAdapter;
  });

  describe('Update Operations', () => {
    describe('updateAnalysis', () => {
      it('should update analysis', async () => {
        const params = {
          analysisId: 'analysis-id',
          name: 'Updated Analysis',
          definition: { DataSetIdentifierDeclarations: [], Sheets: [] } as any,
          themeArn: 'theme-arn',
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/analysis-id',
          analysisId: 'analysis-id',
          status: 200,
        };
        mockAdapter.updateAnalysis.mockResolvedValue(mockResponse);

        const result = await service.updateAnalysis(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateAnalysis).toHaveBeenCalledWith(params);
      });
    });

    describe('updateDashboard', () => {
      it('should update dashboard', async () => {
        const params = {
          dashboardId: 'dashboard-id',
          name: 'Updated Dashboard',
          definition: { DataSetIdentifierDeclarations: [], Sheets: [] } as any,
          dashboardPublishOptions: { adHocFilteringOption: { AvailabilityStatus: 'DISABLED' } },
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dashboard-id',
          dashboardId: 'dashboard-id',
          status: 200,
          versionArn: undefined,
        };
        mockAdapter.updateDashboard.mockResolvedValue(mockResponse);

        const result = await service.updateDashboard(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateDashboard).toHaveBeenCalledWith(params);
      });
    });

    describe('updateDataSet', () => {
      it('should update dataset', async () => {
        const params = {
          dataSetId: 'dataset-id',
          name: 'Updated Dataset',
          physicalTableMap: { table1: { RelationalTable: { Name: 'sales_updated' } } },
          importMode: 'DIRECT_QUERY' as const,
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/dataset-id',
          dataSetId: 'dataset-id',
          ingestionArn: undefined,
        };
        mockAdapter.updateDataSet.mockResolvedValue(mockResponse);

        const result = await service.updateDataSet(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateDataSet).toHaveBeenCalledWith(params);
      });
    });

    describe('updateDataSource', () => {
      it('should update datasource', async () => {
        const params = {
          dataSourceId: 'datasource-id',
          name: 'Updated DataSource',
          dataSourceParameters: {
            PostgreSqlParameters: {
              Host: 'new-db.example.com',
              Port: 5432,
              Database: 'newdb',
            },
          },
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/datasource-id',
          dataSourceId: 'datasource-id',
          updateStatus: 'UPDATE_SUCCESSFUL',
        };
        mockAdapter.updateDataSource.mockResolvedValue(mockResponse);

        const result = await service.updateDataSource(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateDataSource).toHaveBeenCalledWith(params);
      });
    });
  });
});

describe('QuickSightService - Update Folder and Users', () => {
  let service: QuickSightService;
  let mockAdapter: Mocked<QuickSightAdapter>;
  let mockOperationTracker: Mocked<OperationTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    (awsRetry.withRetry as Mock).mockImplementation((fn) => fn());
    mockAdapter = new QuickSightAdapter(
      {} as any,
      TEST_CONSTANTS.AWS_ACCOUNT_ID
    ) as Mocked<QuickSightAdapter>;
    mockOperationTracker = {
      trackOperation: vi.fn(),
    } as any;
    service = new QuickSightService(TEST_CONSTANTS.AWS_ACCOUNT_ID, mockOperationTracker);
    (service as any).adapter = mockAdapter;
  });

  describe('Update Operations', () => {
    describe('updateFolder', () => {
      it('should update folder', async () => {
        const params = {
          folderId: 'folder-id',
          name: 'Updated Folder',
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/folder-id',
          folderId: 'folder-id',
          status: 200,
        };
        mockAdapter.updateFolder.mockResolvedValue(mockResponse);

        const result = await service.updateFolder(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateFolder).toHaveBeenCalledWith(params);
      });
    });

    describe('updateGroup', () => {
      it('should update group', async () => {
        const params = {
          groupName: 'group-name',
          description: 'Updated description',
          namespace: 'default',
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group-name',
          groupName: 'group-name',
          principalId: 'principal-group-name',
        };
        mockAdapter.updateGroup.mockResolvedValue(mockResponse);

        const result = await service.updateGroup(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateGroup).toHaveBeenCalledWith(params);
      });
    });

    describe('updateUser', () => {
      it('should update user', async () => {
        const params = {
          userName: 'user-name',
          email: 'newemail@example.com',
          role: 'AUTHOR',
          namespace: 'default',
        };

        const mockResponse = {
          arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user-name',
          userName: 'user-name',
          principalId: 'principal-user-name',
          role: 'AUTHOR',
        };
        mockAdapter.updateUser.mockResolvedValue(mockResponse);

        const result = await service.updateUser(params);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateUser).toHaveBeenCalledWith(params);
      });
    });
  });
});

describe('QuickSightService - Permissions', () => {
  let service: QuickSightService;
  let mockAdapter: Mocked<QuickSightAdapter>;
  let mockOperationTracker: Mocked<OperationTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    (awsRetry.withRetry as Mock).mockImplementation((fn) => fn());
    mockAdapter = new QuickSightAdapter(
      {} as any,
      TEST_CONSTANTS.AWS_ACCOUNT_ID
    ) as Mocked<QuickSightAdapter>;
    mockOperationTracker = {
      trackOperation: vi.fn(),
    } as any;
    service = new QuickSightService(TEST_CONSTANTS.AWS_ACCOUNT_ID, mockOperationTracker);
    (service as any).adapter = mockAdapter;
  });

  describe('Permission Operations', () => {
    describe('updateAnalysisPermissions', () => {
      it('should update analysis permissions', async () => {
        const permissions: any[] = [
          { Principal: 'user-arn', Actions: ['quicksight:DescribeAnalysis'] },
        ];
        const revokations: any[] = [
          { Principal: 'old-user-arn', Actions: ['quicksight:UpdateAnalysis'] },
        ];

        const mockResponse = { Status: 200 };
        mockAdapter.updateAnalysisPermissions.mockResolvedValue(mockResponse);

        const result = await service.updateAnalysisPermissions(
          'analysis-id',
          permissions,
          revokations
        );

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateAnalysisPermissions).toHaveBeenCalledWith(
          'analysis-id',
          permissions,
          revokations
        );
      });
    });

    describe('updateDashboardPermissions', () => {
      it('should update dashboard permissions', async () => {
        const permissions: any[] = [
          { Principal: 'group-arn', Actions: ['quicksight:DescribeDashboard'] },
        ];

        const mockResponse = { Status: 200 };
        mockAdapter.updateDashboardPermissions.mockResolvedValue(mockResponse);

        const result = await service.updateDashboardPermissions('dashboard-id', permissions);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateDashboardPermissions).toHaveBeenCalledWith(
          'dashboard-id',
          permissions,
          []
        );
      });
    });

    describe('updateDataSetPermissions', () => {
      it('should update dataset permissions', async () => {
        const permissions: any[] = [];
        const revokations: any[] = [
          { Principal: 'user-arn', Actions: ['quicksight:UpdateDataSet'] },
        ];

        const mockResponse = { Status: 200 };
        mockAdapter.updateDataSetPermissions.mockResolvedValue(mockResponse);

        const result = await service.updateDataSetPermissions(
          'dataset-id',
          permissions,
          revokations
        );

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateDataSetPermissions).toHaveBeenCalledWith(
          'dataset-id',
          permissions,
          revokations
        );
      });
    });

    describe('updateDataSourcePermissions', () => {
      it('should update datasource permissions', async () => {
        const permissions: any[] = [
          { Principal: 'user-arn', Actions: ['quicksight:UpdateDataSource'] },
        ];

        const mockResponse = { Status: 200 };
        mockAdapter.updateDataSourcePermissions.mockResolvedValue(mockResponse);

        const result = await service.updateDataSourcePermissions('datasource-id', permissions);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateDataSourcePermissions).toHaveBeenCalledWith(
          'datasource-id',
          permissions,
          []
        );
      });
    });

    describe('updateFolderPermissions', () => {
      it('should update folder permissions', async () => {
        const permissions: any[] = [
          { Principal: 'group-arn', Actions: ['quicksight:DescribeFolder'] },
        ];

        const mockResponse = { Status: 200 };
        mockAdapter.updateFolderPermissions.mockResolvedValue(mockResponse);

        const result = await service.updateFolderPermissions('folder-id', permissions);

        expect(result).toEqual(mockResponse);
        expect(mockAdapter.updateFolderPermissions).toHaveBeenCalledWith(
          'folder-id',
          permissions,
          []
        );
      });
    });
  });
});
