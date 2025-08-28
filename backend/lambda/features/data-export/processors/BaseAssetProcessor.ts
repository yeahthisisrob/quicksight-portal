import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import { type AssetExportData } from '../../../shared/models/asset-export.model';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../shared/services/parsing/AssetParserService';
import { logger } from '../../../shared/utils/logger';
import { buildAssetCacheKey } from '../../../shared/utils/s3KeyUtils';
import { type TagService } from '../../organization/services/TagService';
import { type AssetType, type AssetSummary, type ProcessingContext } from '../types';

/**
 * Asset processing capabilities - defines what operations an asset type supports
 */
export interface AssetProcessingCapabilities {
  hasDefinition: boolean;
  hasPermissions: boolean;
  hasTags: boolean;
  hasSpecialOperations: boolean;
}

/**
 * Processing result with detailed timing information
 */
export interface EnhancedProcessingResult {
  assetId: string;
  assetName: string;
  status: 'success' | 'cached' | 'error';
  error?: string;
  processingTimeMs: number;
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
    phases: {
      cacheCheck?: number;
      dataFetching?: number;
      parsing?: number;
      saving?: number;
    };
  };
  cacheHit: boolean;
  details?: {
    definition?: boolean;
    permissions?: boolean;
    tags?: boolean;
  };
}

/**
 * Enhanced base processor with proper abstraction and consistent patterns
 */
export abstract class BaseAssetProcessor {
  // Collection batching - maps collection key to pending updates
  private static readonly collectionBatches: Map<
    string,
    { data: Record<string, any>; isDirty: boolean }
  > = new Map();
  /**
   * Flush all pending collection updates to S3
   * This should be called by the orchestrator after processing a batch of assets
   */
  public static async flushCollectionBatches(s3Service: S3Service): Promise<void> {
    // Use lower concurrency for collection flushes to avoid S3 rate limiting
    const flushLimit = pLimit(EXPORT_CONFIG.s3Operations.maxConcurrentArchiveOps);
    const flushPromises: Promise<void>[] = [];

    for (const [batchKey, batch] of BaseAssetProcessor.collectionBatches.entries()) {
      if (batch.isDirty) {
        const parts = batchKey.split(':');
        if (parts.length !== 2) {
          logger.warn(`Invalid batch key format: ${batchKey}`);
          continue;
        }
        const [bucketName, collectionKey] = parts;
        if (!bucketName || !collectionKey) {
          logger.warn(`Invalid batch key parts: ${batchKey}`);
          continue;
        }

        flushPromises.push(
          flushLimit(async () => {
            await s3Service.putObject(bucketName, collectionKey, batch.data);
            logger.info(`Flushed collection batch for ${collectionKey}`, {
              assetCount: Object.keys(batch.data).length,
            });
          }).catch((error) => {
            logger.error(`Failed to flush collection batch for ${collectionKey}`, { error });
            throw error;
          })
        );
      }
    }

    // Wait for all flushes to complete
    await Promise.all(flushPromises);

    // Clear the batches after flushing
    BaseAssetProcessor.collectionBatches.clear();
  }
  protected assetParserService: AssetParserService;
  public abstract readonly assetType: AssetType;

  protected awsAccountId: string;

  protected bucketName: string | null = null;

  public abstract readonly capabilities: AssetProcessingCapabilities;

  protected quickSightService: QuickSightService;

  // =============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // =============================================================================

  protected s3Service: S3Service;
  public abstract readonly storageType: 'individual' | 'collection';
  protected tagService: TagService;
  constructor(
    quickSightService: QuickSightService,
    s3Service: S3Service,
    tagService: TagService,
    assetParserService: AssetParserService,
    awsAccountId: string,
    _maxConcurrency: number = EXPORT_CONFIG.concurrency.perProcessor
  ) {
    this.quickSightService = quickSightService;
    this.s3Service = s3Service;
    this.tagService = tagService;
    this.assetParserService = assetParserService;
    this.awsAccountId = awsAccountId;
  }

  protected buildExportData(summary: AssetSummary, data: any): AssetExportData {
    const timestamp = new Date().toISOString();

    // Convert domain summary back to SDK format for export
    // This preserves the original AWS API response format
    const sdkSummary = this.quickSightService.convertToSDKFormat(this.assetType, summary);

    // Build the new structure with apiResponses
    const exportData: AssetExportData = {
      apiResponses: {
        list: {
          timestamp,
          data: sdkSummary, // Use SDK format for export
        },
      },
    };

    // Add describe data if available
    if (data.describe) {
      if (!data.describe._isUploadedFile && !data.describe._failedToDescribe) {
        exportData.apiResponses.describe = {
          timestamp,
          data: data.describe,
        };
      } else if (data.describe._isUploadedFile) {
        // For uploaded files, mark that describe was attempted but not available
        exportData.apiResponses.describe = {
          timestamp,
          data: null,
          error: 'Asset is an uploaded file that cannot be described',
        };
        logger.debug(
          `Marked describe as unavailable for uploaded file ${this.assetType} ${this.getAssetId(summary)}`
        );
      }
    }

    // Add definition data if available
    if (data.definition) {
      exportData.apiResponses.definition = {
        timestamp,
        data: data.definition,
      };
    }

    // Add permissions data
    if (data.permissions) {
      exportData.apiResponses.permissions = {
        timestamp,
        data: data.permissions,
      };
    }

    // Add tags data
    if (data.tags) {
      exportData.apiResponses.tags = {
        timestamp,
        data: data.tags,
      };
    }

    // Add special operations data
    if (data.special) {
      Object.entries(data.special).forEach(([key, value]) => {
        (exportData.apiResponses as any)[key] = {
          timestamp,
          data: value,
        };
      });
    }

    return exportData;
  }

  /**
   * Get bucket name from environment variable
   */
  protected async ensureBucketName(): Promise<string> {
    if (!this.bucketName) {
      this.bucketName =
        process.env.BUCKET_NAME || `quicksight-metadata-bucket-${this.awsAccountId}`;
      // Ensure bucket exists
      await this.s3Service.ensureBucketExists(this.bucketName);
    }
    return this.bucketName;
  }

  // Core describe operation - all asset types must implement
  protected abstract executeDescribe(assetId: string, assetName?: string): Promise<any>;
  // Definition operations (dashboards, analyses)
  protected executeDescribeDefinition?(assetId: string, assetName?: string): Promise<any>;

  // =============================================================================
  // OPTIONAL METHODS - Override if asset type supports them
  // =============================================================================

  // Permissions and tags - all asset types support these
  protected abstract executeGetPermissions(assetId: string): Promise<any[]>;

  protected abstract executeGetTags(assetId: string): Promise<any[]>;

  // Special operations (dataset refresh schedules, etc.)
  protected executeSpecialOperations?(
    assetId: string,
    assetName?: string
  ): Promise<Record<string, any>>;

  // =============================================================================
  // PUBLIC INTERFACE
  // =============================================================================

  protected async fetchAssetData(
    assetId: string,
    assetName: string,
    context: ProcessingContext
  ): Promise<any> {
    const refreshOptions = this.getRefreshOptions(context);
    const isMetadataOnlyRefresh = this.isMetadataOnlyRefresh(refreshOptions);

    // Load existing data for metadata-only refresh
    const existingData = isMetadataOnlyRefresh ? await this.loadExistingData(assetId) : null;

    const data: any = {};

    // Fetch all data types using helper methods
    await this.fetchDescribeData(
      data,
      assetId,
      assetName,
      refreshOptions,
      isMetadataOnlyRefresh,
      existingData
    );
    await this.fetchDefinitionData(
      data,
      assetId,
      assetName,
      refreshOptions,
      isMetadataOnlyRefresh,
      existingData
    );
    await this.fetchPermissionsData(
      data,
      assetId,
      context,
      refreshOptions,
      isMetadataOnlyRefresh,
      existingData
    );
    await this.fetchTagsData(
      data,
      assetId,
      context,
      refreshOptions,
      isMetadataOnlyRefresh,
      existingData
    );
    await this.fetchSpecialOperationsData(
      data,
      assetId,
      assetName,
      isMetadataOnlyRefresh,
      existingData
    );

    return data;
  }

  // =============================================================================
  // PROTECTED HELPER METHODS
  // =============================================================================

  protected abstract getAssetId(summary: AssetSummary): string | undefined;

  protected abstract getAssetName(summary: AssetSummary): string;

  protected getCacheKey(assetId: string): string {
    return buildAssetCacheKey(this.getServicePath(), assetId, this.storageType);
  }

  protected getCollectionCacheKey(): string {
    return `assets/organization/${this.getServicePath()}.json`;
  }

  protected abstract getServicePath(): string;

  // Custom parsing logic
  protected parseAssetData?(data: any): any;

  /**
   * Process a single asset with full tracking and error handling
   * Single write pattern: fetches all data and writes once
   */
  public async processAsset(
    summary: AssetSummary,
    context: ProcessingContext
  ): Promise<EnhancedProcessingResult> {
    const startTime = Date.now();
    const assetId = this.getAssetId(summary);
    const assetName = this.getAssetName(summary);

    if (!assetId) {
      throw new Error(`Asset ID not found in summary for ${this.assetType}`);
    }

    const result = this.initializeResult(assetId, assetName, startTime);

    try {
      // Phase 0: Cache check
      const cacheCheckStart = Date.now();
      const cacheKey = this.getCacheKey(assetId);
      const bucketName = await this.ensureBucketName();
      result.timing.phases.cacheCheck = Date.now() - cacheCheckStart;

      // Phase 1: Fetch asset data
      const dataFetchingStart = Date.now();
      const data = await this.fetchAssetData(assetId, assetName, context);
      result.timing.phases.dataFetching = Date.now() - dataFetchingStart;

      // Phase 2: Build and save export data
      const savingStart = Date.now();
      const exportData = this.buildExportData(summary, data);

      if (this.storageType === 'collection') {
        await this.saveToCollection(bucketName, assetId, exportData);
      } else {
        await this.s3Service.putObject(bucketName, cacheKey, exportData);
      }
      result.timing.phases.saving = Date.now() - savingStart;

      // Finalize result
      this.finalizeResult(result, startTime, context);
      return result;
    } catch (error) {
      result.status = 'error';
      result.error = error instanceof Error ? error.message : String(error);
      this.finalizeResult(result, startTime, context);

      logger.error(`Failed to process ${this.assetType} ${assetId}`, {
        error: result.error,
        duration: result.timing.duration,
      });

      return result;
    }
  }

  protected async saveToCollection(
    bucketName: string,
    assetId: string,
    assetData: any
  ): Promise<void> {
    const collectionKey = this.getCollectionCacheKey();
    const batchKey = `${bucketName}:${collectionKey}`;

    try {
      // Get or create batch for this collection
      let batch = BaseAssetProcessor.collectionBatches.get(batchKey);

      if (!batch) {
        // Start with empty batch - don't merge with existing data
        // Existing data merging happens at a higher level if needed
        batch = { data: {}, isDirty: false };
        BaseAssetProcessor.collectionBatches.set(batchKey, batch);
      }

      // Update the collection with this asset
      batch.data[assetId] = assetData;
      batch.isDirty = true;

      // Note: Actual writing is deferred until flushCollectionBatches is called
      // Adding await to satisfy linter - batch operations are synchronous
      await Promise.resolve();
    } catch (error) {
      logger.error(`Failed to prepare ${this.assetType} for collection save`, { error, assetId });
      throw error;
    }
  }

  /**
   * Fetch definition data with proper fallback logic
   */
  private async fetchDefinitionData(
    data: any,
    assetId: string,
    assetName: string,
    refreshOptions: any,
    isMetadataOnlyRefresh: boolean,
    existingData: AssetExportData | null
  ): Promise<void> {
    const shouldFetchDefinition =
      this.capabilities.hasDefinition &&
      refreshOptions.definitions &&
      this.executeDescribeDefinition;

    const shouldPreserveDefinition =
      this.capabilities.hasDefinition &&
      isMetadataOnlyRefresh &&
      existingData?.apiResponses?.definition;

    if (shouldFetchDefinition && this.executeDescribeDefinition) {
      data.definition = await this.executeDescribeDefinition(assetId, assetName);
    } else if (shouldPreserveDefinition && existingData?.apiResponses?.definition) {
      data.definition = existingData.apiResponses.definition.data;
    }
  }

  /**
   * Fetch describe data with proper fallback logic
   */
  private async fetchDescribeData(
    data: any,
    assetId: string,
    assetName: string,
    refreshOptions: any,
    isMetadataOnlyRefresh: boolean,
    existingData: AssetExportData | null
  ): Promise<void> {
    if (!isMetadataOnlyRefresh || refreshOptions.definitions) {
      data.describe = await this.executeDescribe(assetId, assetName);
    } else if (existingData?.apiResponses?.describe) {
      data.describe = existingData.apiResponses.describe.data;
    }
  }

  /**
   * Fetch permissions data with proper fallback logic
   */
  private async fetchPermissionsData(
    data: any,
    assetId: string,
    context: ProcessingContext,
    refreshOptions: any,
    isMetadataOnlyRefresh: boolean,
    existingData: AssetExportData | null
  ): Promise<void> {
    const shouldFetchPermissions = this.capabilities.hasPermissions && refreshOptions.permissions;
    const shouldPreservePermissions =
      this.capabilities.hasPermissions &&
      isMetadataOnlyRefresh &&
      existingData?.apiResponses?.permissions;

    if (shouldFetchPermissions) {
      if (context.bulkPermissions) {
        data.permissions = context.bulkPermissions;
      } else {
        data.permissions = await this.executeGetPermissions(assetId);
      }
    } else if (shouldPreservePermissions && existingData?.apiResponses?.permissions) {
      data.permissions = existingData.apiResponses.permissions.data;
    }
  }

  /**
   * Fetch special operations data with proper fallback logic
   */
  private async fetchSpecialOperationsData(
    data: any,
    assetId: string,
    assetName: string,
    isMetadataOnlyRefresh: boolean,
    existingData: AssetExportData | null
  ): Promise<void> {
    const shouldFetchSpecial =
      this.capabilities.hasSpecialOperations && this.executeSpecialOperations;
    const shouldPreserveSpecial =
      this.capabilities.hasSpecialOperations && isMetadataOnlyRefresh && existingData?.apiResponses;

    if (shouldFetchSpecial && this.executeSpecialOperations) {
      data.special = await this.executeSpecialOperations(assetId, assetName);
    } else if (shouldPreserveSpecial && existingData?.apiResponses) {
      const specialOps: Record<string, any> = {};
      const CORE_OPERATIONS = ['list', 'describe', 'definition', 'permissions', 'tags'];

      Object.entries(existingData.apiResponses).forEach(([key, value]) => {
        if (!CORE_OPERATIONS.includes(key)) {
          specialOps[key] = value.data;
        }
      });

      if (Object.keys(specialOps).length > 0) {
        data.special = specialOps;
      }
    }
  }

  /**
   * Fetch tags data with proper fallback logic
   */
  private async fetchTagsData(
    data: any,
    assetId: string,
    context: ProcessingContext,
    refreshOptions: any,
    isMetadataOnlyRefresh: boolean,
    existingData: AssetExportData | null
  ): Promise<void> {
    const shouldFetchTags = this.capabilities.hasTags && refreshOptions.tags;
    const shouldPreserveTags =
      this.capabilities.hasTags && isMetadataOnlyRefresh && existingData?.apiResponses?.tags;

    if (shouldFetchTags) {
      if (context.bulkTags) {
        data.tags = Object.entries(context.bulkTags).map(([key, value]) => ({ key, value }));
      } else {
        data.tags = await this.executeGetTags(assetId);
      }
    } else if (shouldPreserveTags && existingData?.apiResponses?.tags) {
      data.tags = existingData.apiResponses.tags.data;
    }
  }

  /**
   * Finalize processing result with timing and details
   */
  private finalizeResult(
    result: EnhancedProcessingResult,
    startTime: number,
    context: ProcessingContext
  ): void {
    result.details = {
      definition: this.capabilities.hasDefinition && (context.refreshOptions?.definitions ?? true),
      permissions:
        this.capabilities.hasPermissions && (context.refreshOptions?.permissions ?? true),
      tags: this.capabilities.hasTags && (context.refreshOptions?.tags ?? true),
    };
    result.timing.endTime = Date.now();
    result.timing.duration = result.timing.endTime - startTime;
    result.processingTimeMs = result.timing.duration;
  }

  /**
   * Get refresh options with defaults
   */
  private getRefreshOptions(context: ProcessingContext): any {
    return (
      context.refreshOptions || {
        definitions: true,
        permissions: true,
        tags: true,
      }
    );
  }

  /**
   * Initialize processing result with default values
   */
  private initializeResult(
    assetId: string,
    assetName: string,
    startTime: number
  ): EnhancedProcessingResult {
    return {
      assetId,
      assetName,
      status: 'success',
      processingTimeMs: 0,
      timing: {
        startTime,
        endTime: 0,
        duration: 0,
        phases: {},
      },
      cacheHit: false,
      details: {
        definition: false,
        permissions: false,
        tags: false,
      },
    };
  }

  /**
   * Check if this is a metadata-only refresh
   */
  private isMetadataOnlyRefresh(refreshOptions: any): boolean {
    return !refreshOptions.definitions && (refreshOptions.permissions || refreshOptions.tags);
  }

  /**
   * Load existing data for metadata-only refresh
   */
  private async loadExistingData(assetId: string): Promise<AssetExportData | null> {
    try {
      const bucketName = await this.ensureBucketName();
      const cacheKey = this.getCacheKey(assetId);
      return await this.s3Service.getObject(bucketName, cacheKey);
    } catch (_error) {
      return null;
    }
  }
}
