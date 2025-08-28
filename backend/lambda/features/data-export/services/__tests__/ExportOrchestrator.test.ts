import { vi, type Mocked } from 'vitest';

import { type ArchiveService } from '../../../../shared/services/archive/ArchiveService';
import type { JobStateService } from '../../../../shared/services/jobs/JobStateService';
import { logger } from '../../../../shared/utils/logger';
import { type AssetComparisonService } from '../AssetComparisonService';
import { ExportOrchestrator } from '../ExportOrchestrator';

vi.mock('../AssetComparisonService');
vi.mock('../BatchProcessingService');
vi.mock('../../../../shared/services/archive/ArchiveService');
vi.mock('../../../../shared/services/aws/QuickSightService');
vi.mock('../../../../shared/services/aws/S3Service');
vi.mock('../../../../shared/services/cache/CacheService');
vi.mock('../../../../shared/services/lineage/LineageService');
vi.mock('../../../../shared/services/operations/OperationTrackingService');
vi.mock('../../../../shared/services/parsing/AssetParserService');
vi.mock('../../../../shared/utils/logger');
vi.mock('../../../data-catalog/services/CatalogService');
vi.mock('../../../organization/services/TagService');

const DELETED_ASSETS_COUNT = 3;
const EXPECTED_ACTIVE_ASSETS = 2;
const ENRICHMENT_TIME = 1000;
const ENRICHMENT_TIME_SHORT = 500;

// Test setup utilities
let orchestrator: ExportOrchestrator;
let mockArchiveService: Mocked<ArchiveService>;
let mockAssetComparisonService: Mocked<AssetComparisonService>;
let mockJobStateService: Mocked<JobStateService>;
const mockAwsAccountId = '123456789012';

function setupTestEnvironment() {
  vi.clearAllMocks();

  orchestrator = new ExportOrchestrator(mockAwsAccountId);

  // Access the private members via any type for testing
  const orch = orchestrator as any;

  // Setup mock services
  mockArchiveService = {
    archiveAssetsBulk: vi.fn(),
  } as any;
  orch.archiveService = mockArchiveService;

  mockAssetComparisonService = {
    compareAndDetectChanges: vi.fn(),
    detectDeletedAssets: vi.fn(),
    setJobContext: vi.fn(),
  } as any;
  orch.assetComparisonService = mockAssetComparisonService;

  mockJobStateService = {
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    updateJobStatus: vi.fn(),
    isStopRequested: vi.fn().mockResolvedValue(false),
  } as any;
  orch.jobStateService = mockJobStateService;
  orch.jobId = 'test-job-123';
}

describe('ExportOrchestrator - archiveDeletedAssets', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('archiveDeletedAssets', () => {
    it('should archive deleted assets when deletions are detected', async () => {
      const deletedAssetIds = new Set(['deleted1', 'deleted2', 'deleted3']);
      const assetType = 'dashboard';

      mockArchiveService.archiveAssetsBulk.mockResolvedValue([
        {
          assetId: 'deleted1',
          success: true,
          assetType: 'dashboard',
          originalPath: 'assets/dashboards/deleted1.json',
          archivePath: 'archived/dashboards/deleted1.json',
          archivedAt: new Date().toISOString(),
        },
        {
          assetId: 'deleted2',
          success: true,
          assetType: 'dashboard',
          originalPath: 'assets/dashboards/deleted2.json',
          archivePath: 'archived/dashboards/deleted2.json',
          archivedAt: new Date().toISOString(),
        },
        {
          assetId: 'deleted3',
          success: true,
          assetType: 'dashboard',
          originalPath: 'assets/dashboards/deleted3.json',
          archivePath: 'archived/dashboards/deleted3.json',
          archivedAt: new Date().toISOString(),
        },
      ]);

      // Call the private method directly for testing
      const orch = orchestrator as any;
      await orch.archiveDeletedAssets(assetType, deletedAssetIds);

      // Verify logging
      expect(mockJobStateService.logInfo).toHaveBeenCalledWith(
        'test-job-123',
        `Archiving ${DELETED_ASSETS_COUNT} deleted dashboard assets`,
        { assetType: 'dashboard' }
      );

      // Verify archive service was called with correct parameters
      expect(mockArchiveService.archiveAssetsBulk).toHaveBeenCalledWith([
        {
          assetType: 'dashboard',
          assetId: 'deleted1',
          archiveReason: 'Asset deleted from QuickSight (detected during export)',
          archivedBy: 'system',
        },
        {
          assetType: 'dashboard',
          assetId: 'deleted2',
          archiveReason: 'Asset deleted from QuickSight (detected during export)',
          archivedBy: 'system',
        },
        {
          assetType: 'dashboard',
          assetId: 'deleted3',
          archiveReason: 'Asset deleted from QuickSight (detected during export)',
          archivedBy: 'system',
        },
      ]);

      expect(logger.info).toHaveBeenCalledWith(
        `Successfully archived ${DELETED_ASSETS_COUNT} deleted dashboard assets`
      );
    });

    it('should handle partial archive failures', async () => {
      const deletedAssetIds = new Set(['deleted1', 'deleted2']);
      const assetType = 'analysis';

      mockArchiveService.archiveAssetsBulk.mockResolvedValue([
        {
          assetId: 'deleted1',
          success: true,
          assetType: 'analysis',
          originalPath: 'assets/analyses/deleted1.json',
          archivePath: 'archived/analyses/deleted1.json',
          archivedAt: new Date().toISOString(),
        },
        {
          assetId: 'deleted2',
          success: false,
          assetType: 'analysis',
          originalPath: 'assets/analyses/deleted2.json',
          archivePath: 'archived/analyses/deleted2.json',
          archivedAt: new Date().toISOString(),
          error: 'Failed to move file',
        },
      ]);

      const orch = orchestrator as any;
      await orch.archiveDeletedAssets(assetType, deletedAssetIds);

      expect(logger.info).toHaveBeenCalledWith('Successfully archived 1 deleted analysis assets');
      expect(logger.warn).toHaveBeenCalledWith('Failed to archive 1 deleted analysis assets');
    });

    it('should handle archive service errors gracefully', async () => {
      const deletedAssetIds = new Set(['deleted1']);
      const assetType = 'dataset';
      const error = new Error('Archive service unavailable');

      mockArchiveService.archiveAssetsBulk.mockRejectedValue(error);

      const orch = orchestrator as any;
      await orch.archiveDeletedAssets(assetType, deletedAssetIds);

      expect(logger.error).toHaveBeenCalledWith('Error archiving deleted dataset assets:', error);
    });

    it('should skip archiving when no deleted assets are detected', async () => {
      const deletedAssetIds = new Set<string>();
      const assetType = 'dashboard';

      const orch = orchestrator as any;
      await orch.archiveDeletedAssets(assetType, deletedAssetIds);

      expect(mockJobStateService.logInfo).not.toHaveBeenCalled();
      expect(mockArchiveService.archiveAssetsBulk).not.toHaveBeenCalled();
    });
  });
});

describe('ExportOrchestrator - exportAssetType', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('exportAssetType - deletion detection', () => {
    it('should detect and archive deleted assets during export', async () => {
      const assetType = 'dashboard';
      const mockAssets = [
        { id: 'asset1', name: 'Asset 1' },
        { id: 'asset2', name: 'Asset 2' },
      ];

      // Mock the listing service
      const orch = orchestrator as any;
      orch.listAndPrepareAssets = vi.fn().mockResolvedValue({
        allAssetsToProcess: mockAssets,
        deletedAssets: [],
      });

      // Mock comparison result with deleted assets
      mockAssetComparisonService.compareAndDetectChanges.mockResolvedValue({
        needsUpdate: new Set(['asset1', 'asset2']),
        unchanged: new Set(),
        deletedAssetIds: new Set(['deleted1', 'deleted2']),
      });

      // Mock archive service
      mockArchiveService.archiveAssetsBulk.mockResolvedValue([
        {
          assetId: 'deleted1',
          success: true,
          assetType: 'dashboard',
          originalPath: 'assets/dashboards/deleted1.json',
          archivePath: 'archived/dashboards/deleted1.json',
          archivedAt: new Date().toISOString(),
        },
        {
          assetId: 'deleted2',
          success: true,
          assetType: 'dashboard',
          originalPath: 'assets/dashboards/deleted2.json',
          archivePath: 'archived/dashboards/deleted2.json',
          archivedAt: new Date().toISOString(),
        },
      ]);

      // Mock other required methods
      orch.ensureBucketName = vi.fn().mockResolvedValue('test-bucket');
      orch.processActiveAssets = vi.fn().mockResolvedValue({
        results: [],
        errors: [],
        stopped: false,
        enrichmentTime: ENRICHMENT_TIME,
      });
      orch.createAssetTypeSummary = vi.fn().mockResolvedValue({
        assetType: 'dashboard',
        totalListed: 2,
        totalProcessed: 2,
        successful: 2,
        failed: 0,
        cached: 0,
      });

      // Mock processor
      const mockProcessor = { process: vi.fn() };
      orch.processors = new Map([['dashboard', mockProcessor]]);

      const result = await orch.exportAssetType(assetType, { forceRefresh: false });

      // Verify comparison service was called
      expect(mockAssetComparisonService.compareAndDetectChanges).toHaveBeenCalledWith(
        'dashboard',
        mockAssets,
        [],
        false
      );

      // Verify archive service was called for deleted assets
      expect(mockArchiveService.archiveAssetsBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            assetId: 'deleted1',
            assetType: 'dashboard',
            archiveReason: 'Asset deleted from QuickSight (detected during export)',
          }),
          expect.objectContaining({
            assetId: 'deleted2',
            assetType: 'dashboard',
            archiveReason: 'Asset deleted from QuickSight (detected during export)',
          }),
        ])
      );

      expect(result).toBeDefined();
    });
  });

  describe('exportAssetType - error handling', () => {
    it('should continue export even if archiving fails', async () => {
      const assetType = 'analysis';
      const mockAssets = [{ id: 'asset1', name: 'Asset 1' }];

      const orch = orchestrator as any;
      orch.listAndPrepareAssets = vi.fn().mockResolvedValue({
        allAssetsToProcess: mockAssets,
        deletedAssets: [],
      });

      mockAssetComparisonService.compareAndDetectChanges.mockResolvedValue({
        needsUpdate: new Set(['asset1']),
        unchanged: new Set(),
        deletedAssetIds: new Set(['deleted1']),
      });

      // Mock archive failure
      mockArchiveService.archiveAssetsBulk.mockRejectedValue(new Error('Archive failed'));

      orch.ensureBucketName = vi.fn().mockResolvedValue('test-bucket');
      orch.processActiveAssets = vi.fn().mockResolvedValue({
        results: [{ assetId: 'asset1', status: 'success' }],
        errors: [],
        stopped: false,
        enrichmentTime: ENRICHMENT_TIME,
      });
      orch.createAssetTypeSummary = vi.fn().mockResolvedValue({
        assetType: 'analysis',
        totalListed: 1,
        totalProcessed: 1,
        successful: 1,
        failed: 0,
        cached: 0,
      });

      const mockProcessor = { process: vi.fn() };
      orch.processors = new Map([['analysis', mockProcessor]]);

      const result = await orch.exportAssetType(assetType, { forceRefresh: false });

      // Export should continue despite archive failure
      expect(orch.processActiveAssets).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith(
        'Error archiving deleted analysis assets:',
        expect.any(Error)
      );
    });
  });
});

describe('ExportOrchestrator - asset filtering', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('exportAssetType - asset filtering', () => {
    it('should filter out deleted assets from processing', async () => {
      const assetType = 'dataset';
      const mockAssets = [
        {
          id: 'active1',
          name: 'Active 1',
          originalSummary: {
            dataSetId: 'active1',
            name: 'Active 1',
            arn: 'arn:aws:active1',
            createdTime: new Date(),
            lastUpdatedTime: new Date(),
          },
        },
        {
          id: 'active2',
          name: 'Active 2',
          originalSummary: {
            dataSetId: 'active2',
            name: 'Active 2',
            arn: 'arn:aws:active2',
            createdTime: new Date(),
            lastUpdatedTime: new Date(),
          },
        },
        {
          id: 'deleted1',
          name: 'To Be Deleted',
          originalSummary: {
            dataSetId: 'deleted1',
            name: 'To Be Deleted',
            arn: 'arn:aws:deleted1',
            createdTime: new Date(),
            lastUpdatedTime: new Date(),
          },
        },
      ];

      const orch = orchestrator as any;
      orch.listAndPrepareAssets = vi.fn().mockResolvedValue({
        allAssetsToProcess: mockAssets,
        deletedAssets: [],
      });

      // Mark deleted1 as deleted and needing update (shouldn't happen but test the filter)
      mockAssetComparisonService.compareAndDetectChanges.mockResolvedValue({
        needsUpdate: new Set(['active1', 'active2', 'deleted1']),
        unchanged: new Set(),
        deletedAssetIds: new Set(['deleted1']),
      });

      mockArchiveService.archiveAssetsBulk.mockResolvedValue([
        {
          assetId: 'deleted1',
          success: true,
          assetType: 'dataset',
          originalPath: 'assets/datasets/deleted1.json',
          archivePath: 'archived/datasets/deleted1.json',
          archivedAt: new Date().toISOString(),
        },
      ]);

      orch.ensureBucketName = vi.fn().mockResolvedValue('test-bucket');
      orch.processActiveAssets = vi.fn().mockResolvedValue({
        results: [],
        errors: [],
        stopped: false,
        enrichmentTime: ENRICHMENT_TIME,
      });
      orch.createAssetTypeSummary = vi.fn().mockResolvedValue({
        assetType: 'dataset',
        totalListed: 3,
        totalProcessed: 2,
        successful: 2,
        failed: 0,
        cached: 0,
      });

      const mockProcessor = { process: vi.fn() };
      orch.processors = new Map([['dataset', mockProcessor]]);

      await orch.exportAssetType(assetType, { forceRefresh: false });

      // Verify processActiveAssets was called with filtered list (excluding deleted1)
      expect(orch.processActiveAssets).toHaveBeenCalledWith(
        'dataset',
        expect.arrayContaining([
          expect.objectContaining({ id: 'active1' }),
          expect.objectContaining({ id: 'active2' }),
        ]),
        DELETED_ASSETS_COUNT,
        expect.any(Object),
        expect.any(Object),
        undefined
      );

      const callArgs = orch.processActiveAssets.mock.calls[0][1];
      expect(callArgs).toHaveLength(EXPECTED_ACTIVE_ASSETS);
      expect(callArgs.find((a: any) => a.id === 'deleted1')).toBeUndefined();
    });
  });
});

describe('ExportOrchestrator - integration', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe('integration with comparison service', () => {
    it('should properly integrate deletion detection with archiving', async () => {
      const assetType = 'dashboard';

      // Setup complete workflow
      const orch = orchestrator as any;
      orch.listAndPrepareAssets = vi.fn().mockResolvedValue({
        allAssetsToProcess: [{ id: 'active1', name: 'Active Dashboard' }],
        deletedAssets: [],
      });

      // Simulate detection of deleted assets
      const deletedIds = new Set(['deleted-dash-1', 'deleted-dash-2']);
      mockAssetComparisonService.compareAndDetectChanges.mockResolvedValue({
        needsUpdate: new Set(['active1']),
        unchanged: new Set(),
        deletedAssetIds: deletedIds,
      });

      mockArchiveService.archiveAssetsBulk.mockResolvedValue([
        {
          assetId: 'deleted-dash-1',
          success: true,
          assetType: 'dashboard',
          originalPath: 'assets/dashboards/deleted-dash-1.json',
          archivePath: 'archived/dashboards/deleted-dash-1.json',
          archivedAt: new Date().toISOString(),
        },
        {
          assetId: 'deleted-dash-2',
          success: true,
          assetType: 'dashboard',
          originalPath: 'assets/dashboards/deleted-dash-2.json',
          archivePath: 'archived/dashboards/deleted-dash-2.json',
          archivedAt: new Date().toISOString(),
        },
      ]);

      orch.ensureBucketName = vi.fn().mockResolvedValue('test-bucket');
      orch.processActiveAssets = vi.fn().mockResolvedValue({
        results: [{ assetId: 'active1', status: 'success' }],
        errors: [],
        stopped: false,
        enrichmentTime: ENRICHMENT_TIME_SHORT,
      });
      orch.createAssetTypeSummary = vi.fn().mockResolvedValue({
        assetType: 'dashboard',
        totalListed: 1,
        totalProcessed: 1,
        successful: 1,
        failed: 0,
        cached: 0,
      });

      const mockProcessor = { process: vi.fn() };
      orch.processors = new Map([['dashboard', mockProcessor]]);

      await orch.exportAssetType(assetType, { forceRefresh: false });

      // Verify the complete flow
      expect(mockAssetComparisonService.compareAndDetectChanges).toHaveBeenCalled();
      expect(mockJobStateService.logInfo).toHaveBeenCalledWith(
        'test-job-123',
        'Archiving 2 deleted dashboard assets',
        { assetType: 'dashboard' }
      );
      expect(mockArchiveService.archiveAssetsBulk).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Successfully archived 2 deleted dashboard assets');
    });
  });
});

describe('ExportOrchestrator - Permissions-only refresh', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  it('should process ALL assets when refreshOptions.permissions=true and definitions=false', async () => {
    const assetType = 'dashboard';
    const mockAssets = [
      {
        id: 'asset1',
        name: 'Asset 1',
        lastModified: '2024-01-01',
        created: '2023-01-01',
        status: 'UPDATED' as const,
        arn: 'arn1',
        originalSummary: {},
      },
      {
        id: 'asset2',
        name: 'Asset 2',
        lastModified: '2024-01-02',
        created: '2023-01-02',
        status: 'UPDATED' as const,
        arn: 'arn2',
        originalSummary: {},
      },
      {
        id: 'asset3',
        name: 'Asset 3',
        lastModified: '2024-01-03',
        created: '2023-01-03',
        status: 'UPDATED' as const,
        arn: 'arn3',
        originalSummary: {},
      },
    ];

    const orch = orchestrator as any;

    // Mock the listing service
    orch.listAndPrepareAssets = vi.fn().mockResolvedValue({
      allAssetsToProcess: mockAssets,
      deletedAssets: [],
    });

    // Mock ensure bucket
    orch.ensureBucketName = vi.fn().mockResolvedValue('test-bucket');

    // Mock process active assets
    orch.processActiveAssets = vi.fn().mockResolvedValue({
      results: mockAssets.map((asset) => ({
        assetId: asset.id,
        assetName: asset.name,
        status: 'success',
        processingTimeMs: 100,
      })),
      errors: [],
      stopped: false,
      enrichmentTime: ENRICHMENT_TIME,
    });

    // Mock createAssetTypeSummary
    orch.createAssetTypeSummary = vi.fn().mockResolvedValue({
      assetType,
      totalListed: mockAssets.length,
      totalProcessed: mockAssets.length,
      successful: mockAssets.length,
      cached: 0,
      failed: 0,
    });

    // Mock processor
    const mockProcessor = {
      assetType,
      capabilities: { hasPermissions: true, hasTags: true },
    };
    orch.processors = new Map([[assetType, mockProcessor]]);

    // Call exportAssetType with permissions-only refresh options
    const options = {
      forceRefresh: false,
      refreshOptions: {
        definitions: false,
        permissions: true,
        tags: false,
      },
    };

    await orch.exportAssetType(assetType, options, undefined);

    // Verify that comparison service was NOT called
    expect(mockAssetComparisonService.compareAndDetectChanges).not.toHaveBeenCalled();

    // Verify that ALL assets were processed
    expect(orch.processActiveAssets).toHaveBeenCalledWith(
      assetType,
      mockAssets, // All assets should be processed
      mockAssets.length,
      options,
      mockProcessor,
      undefined
    );

    // Verify log message about metadata-only refresh
    expect(mockJobStateService.logInfo).toHaveBeenCalledWith(
      'test-job-123',
      'Metadata-only refresh: Processing ALL 3 assets for permissions',
      { assetType }
    );
  });
});

describe('ExportOrchestrator - Tags-only refresh', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  it('should process ALL assets when refreshOptions.tags=true and definitions=false', async () => {
    const assetType = 'dataset';
    const mockAssets = [
      {
        id: 'ds1',
        name: 'Dataset 1',
        lastModified: '2024-01-01',
        created: '2023-01-01',
        status: 'UPDATED' as const,
        arn: 'arn1',
        originalSummary: {},
      },
      {
        id: 'ds2',
        name: 'Dataset 2',
        lastModified: '2024-01-02',
        created: '2023-01-02',
        status: 'UPDATED' as const,
        arn: 'arn2',
        originalSummary: {},
      },
    ];

    const orch = orchestrator as any;

    // Mock the listing service
    orch.listAndPrepareAssets = vi.fn().mockResolvedValue({
      allAssetsToProcess: mockAssets,
      deletedAssets: [],
    });

    // Mock ensure bucket
    orch.ensureBucketName = vi.fn().mockResolvedValue('test-bucket');

    // Mock process active assets
    orch.processActiveAssets = vi.fn().mockResolvedValue({
      results: mockAssets.map((asset) => ({
        assetId: asset.id,
        assetName: asset.name,
        status: 'success',
        processingTimeMs: 100,
      })),
      errors: [],
      stopped: false,
      enrichmentTime: ENRICHMENT_TIME_SHORT,
    });

    // Mock createAssetTypeSummary
    orch.createAssetTypeSummary = vi.fn().mockResolvedValue({
      assetType,
      totalListed: mockAssets.length,
      totalProcessed: mockAssets.length,
      successful: mockAssets.length,
      cached: 0,
      failed: 0,
    });

    // Mock processor
    const mockProcessor = {
      assetType,
      capabilities: { hasPermissions: true, hasTags: true },
    };
    orch.processors = new Map([[assetType, mockProcessor]]);

    // Call exportAssetType with tags-only refresh options
    const options = {
      forceRefresh: false,
      refreshOptions: {
        definitions: false,
        permissions: false,
        tags: true,
      },
    };

    await orch.exportAssetType(assetType, options, undefined);

    // Verify that comparison service was NOT called
    expect(mockAssetComparisonService.compareAndDetectChanges).not.toHaveBeenCalled();

    // Verify that ALL assets were processed
    expect(orch.processActiveAssets).toHaveBeenCalledWith(
      assetType,
      mockAssets,
      mockAssets.length,
      options,
      mockProcessor,
      undefined
    );

    // Verify log message about metadata-only refresh
    expect(mockJobStateService.logInfo).toHaveBeenCalledWith(
      'test-job-123',
      'Metadata-only refresh: Processing ALL 2 assets for tags',
      { assetType }
    );
  });
});

describe('ExportOrchestrator - Standard refresh with comparison', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  it('should use comparison service for standard refresh (definitions=true)', async () => {
    const assetType = 'analysis';
    const mockAssets = [
      {
        id: 'a1',
        name: 'Analysis 1',
        lastModified: '2024-01-01',
        created: '2023-01-01',
        status: 'UPDATED' as const,
        arn: 'arn1',
        originalSummary: {},
      },
      {
        id: 'a2',
        name: 'Analysis 2',
        lastModified: '2024-01-02',
        created: '2023-01-02',
        status: 'UPDATED' as const,
        arn: 'arn2',
        originalSummary: {},
      },
    ];

    const orch = orchestrator as any;

    // Mock the listing service
    orch.listAndPrepareAssets = vi.fn().mockResolvedValue({
      allAssetsToProcess: mockAssets,
      deletedAssets: [],
    });

    // Mock ensure bucket
    orch.ensureBucketName = vi.fn().mockResolvedValue('test-bucket');

    // Mock comparison service to return only one asset needs update
    mockAssetComparisonService.compareAndDetectChanges.mockResolvedValue({
      needsUpdate: new Set(['a1']), // Only a1 needs update
      unchanged: new Set(['a2']),
      deletedAssetIds: new Set(),
    });

    // Mock archive service
    orch.archiveDeletedAssets = vi.fn();

    // Mock process active assets
    orch.processActiveAssets = vi.fn().mockResolvedValue({
      results: [
        {
          assetId: 'a1',
          assetName: 'Analysis 1',
          status: 'success',
          processingTimeMs: 100,
        },
      ],
      errors: [],
      stopped: false,
      enrichmentTime: ENRICHMENT_TIME_SHORT,
    });

    // Mock createAssetTypeSummary
    orch.createAssetTypeSummary = vi.fn().mockResolvedValue({
      assetType,
      totalListed: mockAssets.length,
      totalProcessed: 1,
      successful: 1,
      cached: 1,
      failed: 0,
    });

    // Mock processor
    const mockProcessor = {
      assetType,
      capabilities: { hasDefinition: true, hasPermissions: true, hasTags: true },
    };
    orch.processors = new Map([[assetType, mockProcessor]]);

    // Call exportAssetType with standard refresh options
    const options = {
      forceRefresh: false,
      refreshOptions: {
        definitions: true,
        permissions: true,
        tags: true,
      },
    };

    await orch.exportAssetType(assetType, options, undefined);

    // Verify that comparison service WAS called
    expect(mockAssetComparisonService.compareAndDetectChanges).toHaveBeenCalledWith(
      assetType,
      mockAssets,
      [],
      false
    );

    // Verify that only the asset that needs update was processed
    expect(orch.processActiveAssets).toHaveBeenCalledWith(
      assetType,
      [mockAssets[0]], // Only a1 should be processed
      mockAssets.length,
      options,
      mockProcessor,
      undefined
    );

    // Verify standard comparison log message
    expect(mockJobStateService.logInfo).toHaveBeenCalledWith(
      'test-job-123',
      'Comparison result: 1 need updates, 1 unchanged',
      { assetType }
    );
  });
});
