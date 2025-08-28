import { AssetComparisonService } from './AssetComparisonService';
import { BatchProcessingService } from './BatchProcessingService';
import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import {
  type AssetTypeSummary,
  type ExportOptions,
  type ExportProgressCallback,
  type ExportSummary,
} from '../../../shared/models/export.model';
import { getAssetId, getAssetName } from '../../../shared/models/quicksight-domain.model';
import { ArchiveService } from '../../../shared/services/archive/ArchiveService';
import { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { S3Service } from '../../../shared/services/aws/S3Service';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { type JobStateService } from '../../../shared/services/jobs/JobStateService';
import { LineageService } from '../../../shared/services/lineage/LineageService';
import { OperationTrackingService } from '../../../shared/services/operations/OperationTrackingService';
import { AssetParserService } from '../../../shared/services/parsing/AssetParserService';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { CatalogService } from '../../data-catalog/services/CatalogService';
import { TagService } from '../../organization/services/TagService';
import { AnalysisProcessor } from '../processors/AnalysisProcessor';
import {
  type BaseAssetProcessor,
  type EnhancedProcessingResult,
} from '../processors/BaseAssetProcessor';
import { DashboardProcessor } from '../processors/DashboardProcessor';
import { DatasetProcessor } from '../processors/DatasetProcessor';
import { DatasourceProcessor } from '../processors/DatasourceProcessor';
import { IngestionProcessor } from '../processors/IngestionProcessor';
import { FolderProcessor } from '../processors/organizational/FolderProcessor';
import { GroupProcessor } from '../processors/organizational/GroupProcessor';
import { UserProcessor } from '../processors/organizational/UserProcessor';
import { type AssetType, type AssetSummary, type ProcessingContext } from '../types';

/**
 * Unified Export Orchestrator
 * Handles all export operations with proper architecture and detailed progress tracking
 */
export class ExportOrchestrator {
  private archiveService: ArchiveService;
  private readonly assetComparisonService: AssetComparisonService;
  private readonly assetParserService: AssetParserService;
  private readonly awsAccountId: string;
  private readonly batchProcessingService: BatchProcessingService;
  private bucketName: string | null = null;
  private ingestionProcessor: IngestionProcessor | null = null;
  private jobId: string = '';
  private jobStateService: JobStateService | null = null;
  private readonly operationTracker: OperationTrackingService;
  private readonly processors: Map<AssetType, BaseAssetProcessor>;

  private readonly quickSightService: QuickSightService;
  private readonly s3Service: S3Service;
  private readonly tagService: TagService;

  constructor(awsAccountId: string) {
    this.awsAccountId = awsAccountId;

    // Initialize operation tracking
    this.operationTracker = new OperationTrackingService();

    // Initialize AWS services with operation tracking
    this.quickSightService = new QuickSightService(awsAccountId, this.operationTracker);
    this.s3Service = new S3Service(awsAccountId, this.operationTracker);

    // Initialize other services
    this.tagService = new TagService(awsAccountId);
    this.assetParserService = new AssetParserService();
    this.assetComparisonService = new AssetComparisonService();
    this.batchProcessingService = new BatchProcessingService(this.s3Service);

    // Archive service will be initialized after bucket name is available
    this.archiveService = null as any;

    // Initialize processors
    this.processors = new Map();
    this.initializeProcessors();
  }

  public async exportAssets(
    options: ExportOptions = {},
    progressCallback?: ExportProgressCallback
  ): Promise<ExportSummary> {
    const startTime = Date.now();

    // Initialize and validate
    const exportOptions = await this.initializeExport(options);

    // Handle cache clearing based on options
    await this.handleCacheClearing(exportOptions);

    // Process ingestions if requested
    if (exportOptions.exportIngestions) {
      await this.processIngestions();
    }

    // Process each asset type
    let assetTypeSummaries: AssetTypeSummary[] = [];
    if (exportOptions.assetTypes && exportOptions.assetTypes.length > 0) {
      assetTypeSummaries = await this.processAssetTypes(
        exportOptions.assetTypes,
        exportOptions,
        progressCallback
      );
    }

    // Create and log summary
    const exportSummary = await this.createFinalExportSummary(
      startTime,
      assetTypeSummaries,
      exportOptions
    );

    // Rebuild catalogs if needed
    await this.rebuildCatalogsAfterExport(exportOptions, exportSummary.totals.processed);

    return exportSummary;
  }

  /**
   * Get current operation statistics
   */
  public getOperationStats(): Record<string, number> {
    return this.operationTracker.getOperationStats();
  }

  /**
   * Reset operation statistics
   */
  public resetOperationStats(): void {
    this.operationTracker.resetOperationStats();
  }

  /**
   * Set the job state service and job ID for this orchestrator instance
   */
  public setJobStateService(jobStateService: JobStateService, jobId: string): void {
    this.jobStateService = jobStateService;
    this.jobId = jobId;
    // Connect operation tracker to job for real-time tracking
    this.operationTracker.connectToJob(jobStateService, jobId);
    // Also set it on the services for logging
    this.assetComparisonService.setJobContext(jobStateService, jobId);
    this.batchProcessingService.setJobContext(jobStateService, jobId);
  }

  /**
   * Get bucket name from environment variable
   */
  /**
   * Archive deleted assets detected during comparison
   */
  private async archiveDeletedAssets(
    assetType: AssetType,
    deletedAssetIds: Set<string>
  ): Promise<void> {
    if (deletedAssetIds.size === 0) {
      return;
    }

    await this.jobStateService?.logInfo(
      this.jobId,
      `Archiving ${deletedAssetIds.size} deleted ${assetType} assets`,
      { assetType }
    );

    // Build array of assets to archive (same pattern as BulkDeleteService)
    const assetsToArchive = Array.from(deletedAssetIds).map((assetId) => ({
      assetType,
      assetId,
      archiveReason: 'Asset deleted from QuickSight (detected during export)',
      archivedBy: 'system',
    }));

    try {
      // Use bulk archive for efficiency (same as BulkDeleteService)
      const archiveResults = await this.archiveService?.archiveAssetsBulk(assetsToArchive);

      const successCount = archiveResults?.filter((r) => r.success).length || 0;
      const failCount = archiveResults?.filter((r) => !r.success).length || 0;

      if (successCount > 0) {
        logger.info(`Successfully archived ${successCount} deleted ${assetType} assets`);
      }
      if (failCount > 0) {
        logger.warn(`Failed to archive ${failCount} deleted ${assetType} assets`);
      }
    } catch (error) {
      logger.error(`Error archiving deleted ${assetType} assets:`, error);
    }
  }

  /**
   * Calculate API call statistics for an asset type summary
   */
  private calculateApiCallStats(): { total: number } {
    // Get running total of all API calls so far in this export
    const total = this.operationTracker.getTotalForNamespace('api');
    return { total };
  }

  /**
   * Clear caches and catalog for rebuild index mode
   */
  private async clearCachesForRebuild(): Promise<void> {
    logger.info('Rebuild index requested - clearing catalog');
    if (this.jobStateService) {
      await this.jobStateService.logInfo(this.jobId, 'Rebuild index requested - clearing catalog');
    }
    try {
      // Clear all caches using the cache service
      await cacheService.clearAllCaches();

      // Also clear the data catalog
      const catalogService = new CatalogService();
      await catalogService.clearCatalog();

      logger.info('Catalog cleared successfully');
      if (this.jobStateService) {
        await this.jobStateService.logInfo(this.jobId, 'Catalog cleared successfully');
      }
    } catch (error) {
      logger.error('Failed to clear catalog:', error);
      if (this.jobStateService) {
        await this.jobStateService.logError(this.jobId, `Failed to clear catalog: ${error}`);
      }
      // Continue with export even if clearing fails
    }
  }

  /**
   * Create asset type summary after processing
   */
  private async createAssetTypeSummary(
    context: {
      assetType: AssetType;
      totalListed: number;
      results: EnhancedProcessingResult[];
      errors: Array<{ assetId: string; assetName: string; error: string; timestamp: string }>;
      timing: {
        listingTime: number;
        enrichmentTime: number;
        startTime: number;
      };
      options: ExportOptions;
    },
    progressCallback?: ExportProgressCallback
  ): Promise<AssetTypeSummary> {
    const { assetType, totalListed, results, errors, timing, options } = context;
    const totalTime = Date.now() - timing.startTime;

    // Calculate API call statistics for the summary (running total)
    const apiCalls = this.calculateApiCallStats();

    const summary: AssetTypeSummary = {
      assetType,
      totalListed,
      totalProcessed: results.length,
      successful: results.filter((r) => r.status === 'success').length,
      cached: results.filter((r) => r.status === 'cached').length,
      failed: results.filter((r) => r.status === 'error').length,
      timing: {
        listingMs: timing.listingTime,
        comparisonMs: 0,
        processingMs: timing.enrichmentTime,
        totalMs: totalTime,
      },
      apiCalls,
      errors,
    };

    // Rebuild cache if needed
    await this.rebuildCacheForAssetType(assetType, results.length, options.rebuildIndex);

    progressCallback?.onAssetTypeComplete?.(assetType, summary);

    // Log final status
    await this.logFinalAssetTypeStatus(assetType, summary);

    logger.info(`Completed two-phase export for ${assetType}`, {
      totalListed: summary.totalListed,
      processed: summary.totalProcessed,
      successful: summary.successful,
      cached: summary.cached,
      failed: summary.failed,
      timing: summary.timing,
      apiCalls: summary.apiCalls.total,
    });

    return summary;
  }

  /**
   * Create summary for fully cached assets
   */
  private async createCachedSummary(
    assetType: AssetType,
    totalListed: number,
    listingTime: number,
    startTime: number,
    progressCallback?: ExportProgressCallback
  ): Promise<AssetTypeSummary> {
    if (this.jobStateService) {
      await this.jobStateService.logInfo(
        this.jobId,
        `No assets need enrichment - all ${totalListed} assets are up to date`,
        { assetType }
      );
    }

    const summary: AssetTypeSummary = {
      assetType,
      totalListed,
      totalProcessed: 0,
      successful: 0,
      cached: totalListed,
      failed: 0,
      timing: {
        listingMs: listingTime,
        comparisonMs: 0,
        processingMs: 0,
        totalMs: Date.now() - startTime,
      },
      errors: [],
      apiCalls: this.calculateApiCallStats(),
    };

    progressCallback?.onAssetTypeComplete?.(assetType, summary);
    return summary;
  }

  /**
   * Create a failed summary for an asset type
   */
  private createFailedSummary(assetType: AssetType, error: unknown): AssetTypeSummary {
    return {
      assetType,
      totalListed: 0,
      totalProcessed: 0,
      successful: 0,
      cached: 0,
      failed: 1,
      timing: { listingMs: 0, comparisonMs: 0, processingMs: 0, totalMs: 0 },
      apiCalls: { total: 0 },
      errors: [
        {
          assetId: 'N/A',
          assetName: `${assetType} export`,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  /**
   * Create final export summary and update job status
   */
  private async createFinalExportSummary(
    startTime: number,
    assetTypeSummaries: AssetTypeSummary[],
    exportOptions: ExportOptions
  ): Promise<ExportSummary> {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Calculate totals
    const totals = assetTypeSummaries.reduce(
      (acc, summary) => ({
        listed: acc.listed + summary.totalListed,
        processed: acc.processed + summary.totalProcessed,
        successful: acc.successful + summary.successful,
        cached: acc.cached + summary.cached,
        failed: acc.failed + summary.failed,
        apiCalls: acc.apiCalls + summary.apiCalls.total,
      }),
      { listed: 0, processed: 0, successful: 0, cached: 0, failed: 0, apiCalls: 0 }
    );

    // Get total API calls from operation tracker
    const totalApiCalls = this.operationTracker.getTotalForNamespace('api');

    const exportSummary: ExportSummary = {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration,
      assetTypes: assetTypeSummaries,
      totals: { ...totals, apiCalls: totalApiCalls },
      options: exportOptions,
    };

    logger.info('Export orchestration completed', {
      duration,
      totals: { ...totals, apiCalls: totalApiCalls },
      assetTypeCount: assetTypeSummaries.length,
    });

    // Update job with final status
    await this.updateJobFinalStatus(totals, duration, totalApiCalls, exportOptions);

    return exportSummary;
  }

  /**
   * Determine which assets to process based on refresh mode
   */
  private async determineAssetsToProcess(
    assetType: AssetType,
    listingResult: {
      allAssetsToProcess: Array<{
        id: string;
        name: string;
        arn: string;
        lastModified: string | undefined;
        created: string | undefined;
        status: 'UPDATED';
        originalSummary: any;
      }>;
      deletedAssets: any[];
    },
    options: ExportOptions,
    jobStateService: JobStateService
  ): Promise<typeof listingResult.allAssetsToProcess> {
    // Check if this is a permissions-only or tags-only refresh
    const isPermissionsOnlyRefresh =
      options.refreshOptions &&
      options.refreshOptions.permissions === true &&
      options.refreshOptions.definitions === false;

    const isTagsOnlyRefresh =
      options.refreshOptions &&
      options.refreshOptions.tags === true &&
      options.refreshOptions.definitions === false;

    const isMetadataOnlyRefresh = isPermissionsOnlyRefresh || isTagsOnlyRefresh;

    if (isMetadataOnlyRefresh) {
      // For metadata-only refresh (permissions/tags), process ALL assets regardless of lastModified
      await jobStateService.logInfo(
        this.jobId,
        `Metadata-only refresh: Processing ALL ${listingResult.allAssetsToProcess.length} assets for ${
          isPermissionsOnlyRefresh ? 'permissions' : 'tags'
        }`,
        { assetType }
      );
      return listingResult.allAssetsToProcess;
    }

    // Standard refresh: Compare with cache and detect changes
    const comparisonResult = await this.assetComparisonService.compareAndDetectChanges(
      assetType,
      listingResult.allAssetsToProcess,
      listingResult.deletedAssets,
      options.forceRefresh || false
    );

    // Archive deleted assets (move files from assets/ to archived/)
    await this.archiveDeletedAssets(assetType, comparisonResult.deletedAssetIds);

    // Filter to only assets that need processing
    const activeAssetsToProcess = listingResult.allAssetsToProcess.filter(
      (asset) =>
        !comparisonResult.deletedAssetIds.has(asset.id) &&
        comparisonResult.needsUpdate.has(asset.id)
    );

    await jobStateService.logInfo(
      this.jobId,
      `Comparison result: ${comparisonResult.needsUpdate.size} need updates, ${comparisonResult.unchanged.size} unchanged`,
      { assetType }
    );

    return activeAssetsToProcess;
  }

  private async ensureBucketName(): Promise<string> {
    if (!this.bucketName) {
      this.bucketName =
        process.env.BUCKET_NAME || `quicksight-metadata-bucket-${this.awsAccountId}`;
      await this.s3Service.ensureBucketExists(this.bucketName);

      if (!this.archiveService) {
        this.archiveService = new ArchiveService(this.bucketName, cacheService);
      }
    }
    return this.bucketName;
  }

  /**
   * Export a single asset type with two-phase list-first enrichment
   */
  private async exportAssetType(
    assetType: AssetType,
    options: ExportOptions,
    progressCallback?: ExportProgressCallback
  ): Promise<AssetTypeSummary> {
    const processor = this.processors.get(assetType);
    if (!processor) {
      throw new Error(`No processor found for asset type: ${assetType}`);
    }

    // exportStateService is guaranteed to be initialized when called from exportAll
    if (!this.jobStateService) {
      throw new Error('Export state service not initialized');
    }
    const jobStateService = this.jobStateService;

    const assetTypeStartTime = Date.now();
    logger.info(`Starting two-phase export for ${assetType}`);
    await jobStateService.updateJobStatus(this.jobId, { message: `Listing ${assetType}` });

    // Phase 1: List and prepare assets
    const listingStartTime = Date.now();
    const listingResult = await this.listAndPrepareAssets(assetType);
    const listingTime = Date.now() - listingStartTime;

    // Phase 2: Determine which assets to process
    await this.ensureBucketName();
    const activeAssetsToProcess = await this.determineAssetsToProcess(
      assetType,
      listingResult,
      options,
      jobStateService
    );

    progressCallback?.onAssetTypeStart?.(assetType, activeAssetsToProcess.length);
    await jobStateService.updateJobStatus(this.jobId, { message: `Enriching ${assetType}` });

    // Check if any assets need enrichment
    if (activeAssetsToProcess.length === 0) {
      return this.createCachedSummary(
        assetType,
        listingResult.allAssetsToProcess.length,
        listingTime,
        assetTypeStartTime,
        progressCallback
      );
    }

    // Phase 3: Process assets in batches
    const { results, errors, enrichmentTime } = await this.processActiveAssets(
      assetType,
      activeAssetsToProcess,
      listingResult.allAssetsToProcess.length,
      options,
      processor,
      progressCallback
    );

    // Create and finalize summary
    const summary = await this.createAssetTypeSummary(
      {
        assetType,
        totalListed: listingResult.allAssetsToProcess.length,
        results,
        errors,
        timing: {
          listingTime,
          enrichmentTime,
          startTime: assetTypeStartTime,
        },
        options,
      },
      progressCallback
    );

    return summary;
  }

  /**
   * Get asset ID from summary using proper domain types
   */
  private getAssetIdFromSummary(summary: AssetSummary, _assetType: AssetType): string {
    return getAssetId(summary);
  }

  /**
   * Get asset name from summary using proper domain types
   */
  private getAssetNameFromSummary(summary: AssetSummary, _assetType: AssetType): string {
    return getAssetName(summary);
  }

  /**
   * Handle cache clearing based on export options
   */
  private async handleCacheClearing(exportOptions: ExportOptions): Promise<void> {
    if (exportOptions.rebuildIndex && !exportOptions.forceRefresh && !exportOptions.assetTypes) {
      // Cache rebuild only - don't clear, will rebuild from S3 later
      logger.info('Cache rebuild requested - will rebuild from existing S3 files');
      if (this.jobStateService) {
        await this.jobStateService.logInfo(
          this.jobId,
          'Cache rebuild requested - will rebuild from existing S3 files'
        );
      }
    } else if (exportOptions.rebuildIndex) {
      await this.clearCachesForRebuild();
    } else if (exportOptions.forceRefresh) {
      logger.info(
        'Force refresh requested - will re-export all assets while preserving view stats'
      );
      if (this.jobStateService) {
        await this.jobStateService.logInfo(
          this.jobId,
          'Force refresh requested - will re-export all assets'
        );
      }
    }
  }

  /**
   * Initialize export and validate job state
   */
  private async initializeExport(options: ExportOptions): Promise<ExportOptions> {
    // Check if this is an ingestion-only or cache-rebuild-only operation
    const isIngestionOnly = options.exportIngestions && !options.assetTypes;
    const isCacheRebuildOnly = options.rebuildIndex && !options.forceRefresh && !options.assetTypes;

    // Merge options with defaults
    const exportOptions: ExportOptions = {
      forceRefresh: false,
      refreshOptions: { definitions: true, permissions: true, tags: true },
      // Only set default assetTypes if not ingestion-only or cache-rebuild-only
      assetTypes:
        isIngestionOnly || isCacheRebuildOnly
          ? undefined
          : options.assetTypes || Object.values(ASSET_TYPES),
      batchSize: EXPORT_CONFIG.batch.assetBatchSize,
      maxConcurrency: EXPORT_CONFIG.concurrency.perProcessor,
      ...options,
    };

    logger.info('Starting export orchestration', { options: exportOptions });

    // Initialize export state
    await this.ensureBucketName();

    // JobStateService must be initialized via setJobStateService
    if (!this.jobStateService || this.jobId === '') {
      throw new Error('JobStateService not initialized. Call setJobStateService first.');
    }

    // Log infrastructure initialization
    await this.jobStateService.logInfo(
      this.jobId,
      `Initialized export infrastructure (bucket: ${this.bucketName})`
    );

    await this.jobStateService.logInfo(
      this.jobId,
      `Export options: ${JSON.stringify(exportOptions)}`
    );

    // Log file path for local development
    const logFilePath = (logger as any).getLogFilePath?.();
    if (logFilePath) {
      logger.info(`Local development logs are being written to: ${logFilePath}`);
    }

    return exportOptions;
  }

  /**
   * Initialize all asset processors with the new architecture
   */
  private initializeProcessors(): void {
    const maxConcurrency = EXPORT_CONFIG.concurrency.perProcessor;

    this.processors.set(
      ASSET_TYPES.dashboard,
      new DashboardProcessor(
        this.quickSightService,
        this.s3Service,
        this.tagService,
        this.assetParserService,
        this.awsAccountId,
        maxConcurrency
      )
    );

    this.processors.set(
      ASSET_TYPES.analysis,
      new AnalysisProcessor(
        this.quickSightService,
        this.s3Service,
        this.tagService,
        this.assetParserService,
        this.awsAccountId,
        maxConcurrency
      )
    );

    this.processors.set(
      ASSET_TYPES.dataset,
      new DatasetProcessor(
        this.quickSightService,
        this.s3Service,
        this.tagService,
        this.assetParserService,
        this.awsAccountId,
        maxConcurrency
      )
    );

    this.processors.set(
      ASSET_TYPES.datasource,
      new DatasourceProcessor(
        this.quickSightService,
        this.s3Service,
        this.tagService,
        this.assetParserService,
        this.awsAccountId,
        maxConcurrency
      )
    );

    this.processors.set(
      'group',
      new GroupProcessor(
        this.quickSightService,
        this.s3Service,
        this.tagService,
        this.assetParserService,
        this.awsAccountId,
        maxConcurrency
      )
    );

    this.processors.set(
      'folder',
      new FolderProcessor(
        this.quickSightService,
        this.s3Service,
        this.tagService,
        this.assetParserService,
        this.awsAccountId,
        maxConcurrency
      )
    );

    this.processors.set(
      'user',
      new UserProcessor(
        this.quickSightService,
        this.s3Service,
        this.tagService,
        this.assetParserService,
        this.awsAccountId,
        maxConcurrency
      )
    );
  }

  /**
   * List and prepare assets for processing
   */
  private async listAndPrepareAssets(assetType: AssetType): Promise<{
    allAssetsToProcess: Array<{
      id: string;
      name: string;
      arn: string;
      lastModified: string | undefined;
      created: string | undefined;
      status: 'UPDATED';
      originalSummary: any;
    }>;
    deletedAssets: any[];
  }> {
    const { assets: allAssets, apiCalls: listApiCalls } =
      await this.quickSightService.listAllAssetsOfType(assetType);

    // Track list API calls using operation tracker
    if (listApiCalls > 0) {
      await this.operationTracker.trackOperation(`api.${assetType}.list`, listApiCalls);
    }

    // Separate active and deleted assets
    const activeAssets = allAssets.filter((asset) => (asset.Status || asset.status) !== 'DELETED');
    const deletedAssets = allAssets.filter((asset) => (asset.Status || asset.status) === 'DELETED');

    const allAssetsToProcess = this.assetComparisonService.prepareAssetsForComparison(
      activeAssets,
      assetType,
      (asset, type) => this.getAssetIdFromSummary(asset, type),
      (asset, type) => this.getAssetNameFromSummary(asset, type)
    );

    if (this.jobStateService) {
      await this.jobStateService.logInfo(
        this.jobId,
        `Listed ${allAssetsToProcess.length} ${assetType} assets`,
        { assetType }
      );
    }

    return { allAssetsToProcess, deletedAssets };
  }

  /**
   * Log final status for an asset type export
   */
  private async logFinalAssetTypeStatus(
    assetType: AssetType,
    summary: AssetTypeSummary
  ): Promise<void> {
    if (!this.jobStateService) {
      return;
    }

    await this.jobStateService.logInfo(
      this.jobId,
      `Completed export for ${assetType}: ${summary.successful} successful, ${summary.failed} failed`,
      { assetType }
    );
  }

  /**
   * Process assets that need enrichment
   */
  private async processActiveAssets(
    assetType: AssetType,
    activeAssetsToProcess: Array<{
      id: string;
      name: string;
      arn: string;
      lastModified: string | undefined;
      created: string | undefined;
      status: 'UPDATED';
      originalSummary: AssetSummary;
    }>,
    totalAssetsCount: number,
    options: ExportOptions,
    processor: BaseAssetProcessor,
    progressCallback?: ExportProgressCallback
  ): Promise<{
    results: EnhancedProcessingResult[];
    errors: Array<{ assetId: string; assetName: string; error: string; timestamp: string }>;
    stopped: boolean;
    enrichmentTime: number;
  }> {
    const enrichmentStartTime = Date.now();

    // Set up processing context
    const context: ProcessingContext = {
      forceRefresh: options.forceRefresh || options.rebuildIndex || false,
      refreshOptions: options.refreshOptions
        ? {
            definitions: options.refreshOptions.definitions ?? true,
            permissions: options.refreshOptions.permissions ?? true,
            tags: options.refreshOptions.tags ?? true,
          }
        : undefined,
    };

    // Process using the batch service
    const { results, errors, stopped } = await this.batchProcessingService.processAssetsInBatches(
      {
        assetType,
        activeAssetsToProcess,
        totalAssetsCount,
        processor,
        processingContext: context,
      },
      {
        batchSize: options.batchSize || EXPORT_CONFIG.batch.assetBatchSize,
        maxConcurrency: options.maxConcurrency || EXPORT_CONFIG.concurrency.perAssetType,
        shouldStop: this.jobStateService
          ? async () => {
              const shouldStop = await this.jobStateService?.isStopRequested(this.jobId);
              return shouldStop || false;
            }
          : undefined,
      },
      {
        onBatchComplete: (batchIndex, totalBatches, batchResults) => {
          progressCallback?.onBatchComplete?.(assetType, batchIndex, totalBatches, batchResults);
        },
        onItemComplete: (result) => {
          progressCallback?.onAssetComplete?.(assetType, result);
        },
        onItemError: (error, assetId) => {
          progressCallback?.onError?.(error, assetType, assetId);
        },
      }
    );

    // If batch processing was stopped, update job status
    if (stopped && this.jobStateService) {
      await this.jobStateService.updateJobStatus(this.jobId, {
        status: 'stopped',
        endTime: new Date().toISOString(),
        message: `Stopped during ${assetType} batch processing`,
      });
    }

    const enrichmentTime = Date.now() - enrichmentStartTime;
    return { results, errors, stopped: stopped || false, enrichmentTime };
  }

  /**
   * Process all asset types sequentially
   */
  private async processAssetTypes(
    assetTypes: AssetType[],
    exportOptions: ExportOptions,
    progressCallback?: ExportProgressCallback
  ): Promise<AssetTypeSummary[]> {
    const assetTypeSummaries: AssetTypeSummary[] = [];

    for (const assetType of assetTypes) {
      // Check for stop signal before processing each asset type
      if (this.jobStateService) {
        const shouldStop = await this.jobStateService.isStopRequested(this.jobId);
        if (shouldStop) {
          logger.info(`Export stopped by user request at ${assetType}`);
          await this.jobStateService.logWarn(
            this.jobId,
            `Export stopped by user request at ${assetType}`
          );
          await this.jobStateService.updateJobStatus(this.jobId, {
            status: 'stopped',
            endTime: new Date().toISOString(),
            message: 'Stopped by user',
          });
          break;
        }
      }

      try {
        const summary = await this.exportAssetType(assetType, exportOptions, progressCallback);
        assetTypeSummaries.push(summary);
      } catch (error) {
        logger.error(`Failed to export ${assetType}:`, error);
        if (this.jobStateService) {
          await this.jobStateService.logError(
            this.jobId,
            `Failed to export ${assetType}: ${error instanceof Error ? error.message : String(error)}`,
            { assetType }
          );
        }
        progressCallback?.onError?.(
          error instanceof Error ? error : new Error(String(error)),
          assetType
        );

        // Create failed summary
        assetTypeSummaries.push(this.createFailedSummary(assetType, error));
      }
    }

    return assetTypeSummaries;
  }

  /**
   * Process and cache ingestions
   */
  private async processIngestions(): Promise<void> {
    try {
      logger.info('Processing ingestions...');
      if (this.jobStateService) {
        await this.jobStateService.logInfo(this.jobId, 'Processing ingestions');
      }

      // Initialize ingestion processor if not already done
      if (!this.ingestionProcessor) {
        this.ingestionProcessor = new IngestionProcessor(this.quickSightService, cacheService);
      }

      // Process ingestions
      const result = await this.ingestionProcessor.processIngestions();

      // Save to cache
      await cacheService.saveIngestions(result.ingestions, result.metadata);

      logger.info('Ingestions processed and cached successfully', {
        totalIngestions: result.metadata.totalIngestions,
        runningIngestions: result.metadata.runningIngestions,
        failedIngestions: result.metadata.failedIngestions,
        processingTimeMs: result.processingTimeMs,
      });

      if (this.jobStateService) {
        await this.jobStateService.logInfo(
          this.jobId,
          `Processed ${result.metadata.totalIngestions} ingestions (${result.metadata.runningIngestions} running, ${result.metadata.failedIngestions} failed)`
        );
      }
    } catch (error) {
      logger.error('Failed to process ingestions:', error);
      if (this.jobStateService) {
        await this.jobStateService.logError(
          this.jobId,
          `Failed to process ingestions: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      // Don't fail the entire export if ingestion processing fails
    }
  }

  /**
   * Rebuild cache for a specific asset type
   */
  private async rebuildCacheForAssetType(
    assetType: AssetType,
    resultsCount: number,
    isRebuildIndex?: boolean
  ): Promise<void> {
    if (resultsCount > 0 && !isRebuildIndex) {
      try {
        logger.info(`Rebuilding cache to include completed ${assetType} assets`);
        await cacheService.rebuildCacheForAssetType(assetType);
        logger.info(`Successfully rebuilt cache for ${assetType}`);
      } catch (error) {
        logger.error(`Failed to rebuild ${assetType} cache:`, error);
      }
    }
  }

  /**
   * Rebuild catalogs after export
   */
  private async rebuildCatalogsAfterExport(
    exportOptions: ExportOptions,
    totalProcessed: number
  ): Promise<void> {
    // Check if this is a cache-rebuild-only operation
    const isCacheRebuildOnly =
      exportOptions.rebuildIndex && !exportOptions.forceRefresh && !exportOptions.assetTypes;

    if (
      totalProcessed > 0 ||
      exportOptions.rebuildIndex ||
      exportOptions.forceRefresh ||
      isCacheRebuildOnly
    ) {
      try {
        logger.info('Rebuilding data catalog after export...');

        // For rebuild index mode, do a cache rebuild
        if (exportOptions.rebuildIndex || isCacheRebuildOnly) {
          // Rebuild cache with lineage from existing S3 files
          await cacheService.rebuildCache(true, true);
          await cacheService.updateFieldCache(null);
          logger.info('Cache rebuilt successfully from S3 files');
        }

        // Rebuild field cache once after all exports complete
        if (!exportOptions.rebuildIndex && !isCacheRebuildOnly) {
          // rebuildIndex already did this above
          logger.info('Rebuilding field cache after all exports...');
          await cacheService.updateFieldCache(null);
        }

        const catalogService = new CatalogService();
        await catalogService.getDataCatalog();
        await catalogService.buildVisualFieldCatalog();
        logger.info('Data catalog rebuilt successfully');

        // Now rebuild lineage since all assets are exported
        if (!exportOptions.rebuildIndex && !isCacheRebuildOnly) {
          // rebuildIndex already did this above
          logger.info('Rebuilding lineage after all assets exported...');
          const lineageService = new LineageService();
          await lineageService.rebuildLineage();
          logger.info('Lineage rebuilt successfully');
        }
      } catch (error) {
        logger.error('Failed to rebuild catalogs after export:', error);
        if (this.jobStateService) {
          await this.jobStateService.logWarn(
            this.jobId,
            'Warning: Failed to rebuild data catalogs after export - may need manual refresh'
          );
        }
        // Don't fail the export if catalog rebuild fails
      }
    }
  }

  /**
   * Update job with final status and logs
   */
  private async updateJobFinalStatus(
    totals: any,
    duration: number,
    totalApiCalls: number,
    exportOptions: ExportOptions
  ): Promise<void> {
    if (!this.jobStateService) {
      return;
    }

    // Log completion
    await this.jobStateService.logInfo(
      this.jobId,
      `Export orchestration completed: ${totals.successful} successful, ${totals.failed} failed`,
      {
        duration,
        totalAssets: totals.listed,
        processedAssets: totals.successful,
        failedAssets: totals.failed,
      }
    );

    // Update job status
    await this.jobStateService.updateJobStatus(this.jobId, {
      status: totals.failed === 0 ? 'completed' : 'failed',
      endTime: new Date().toISOString(),
      duration: duration,
      stats: {
        totalAssets: totals.listed,
        processedAssets: totals.successful,
        failedAssets: totals.failed,
      },
      message:
        totals.failed === 0
          ? 'Export completed successfully'
          : `Export completed with ${totals.failed} errors`,
    });

    // Log API calls if any
    if (totalApiCalls > 0) {
      await this.jobStateService.logInfo(
        this.jobId,
        `Total API calls for export: ${totalApiCalls}`
      );
    }

    // Log catalog rebuild if applicable
    if (totals.processed > 0 || exportOptions.rebuildIndex || exportOptions.forceRefresh) {
      await this.jobStateService.logInfo(this.jobId, `Starting catalog rebuild after export`);
    }
  }
}
