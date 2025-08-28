/**
 * Service for handling batch processing of assets during export
 * Follows VSA architecture pattern
 */

import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import { LOGGING_CONFIG } from '../../../shared/constants';
import {
  type BatchContext,
  type BatchError,
  type BatchProcessingOptions,
  type BatchProcessingResult,
  type BatchProgressCallback,
} from '../../../shared/models/batch.model';
import { type S3Service } from '../../../shared/services/aws/S3Service';
import { type JobStateService } from '../../../shared/services/jobs/JobStateService';
import { logger } from '../../../shared/utils/logger';
import {
  BaseAssetProcessor,
  type EnhancedProcessingResult,
} from '../processors/BaseAssetProcessor';
import { type AssetType, type ProcessingContext } from '../types';

/**
 * Service for processing assets in batches with proper error handling and progress tracking
 */
export class BatchProcessingService {
  private jobId: string = '';
  private jobStateService: JobStateService | null = null;

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Create batches from a list of items
   */
  public createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process assets in batches with proper error handling
   */
  public async processAssetsInBatches(
    context: {
      assetType: AssetType;
      activeAssetsToProcess: Array<any>;
      totalAssetsCount: number;
      processor: BaseAssetProcessor;
      processingContext: ProcessingContext;
    },
    options: BatchProcessingOptions,
    progressCallback?: BatchProgressCallback
  ): Promise<BatchProcessingResult> {
    const { assetType, activeAssetsToProcess, totalAssetsCount, processor, processingContext } =
      context;
    const batches = this.createBatches(activeAssetsToProcess, options.batchSize);

    // Log start of enrichment
    await this.logEnrichmentStart(
      assetType,
      activeAssetsToProcess.length,
      totalAssetsCount,
      batches.length
    );

    const results: EnhancedProcessingResult[] = [];
    const errors: BatchError[] = [];

    let wasStopped = false;

    try {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Check for stop signal using provided callback
        if (options.shouldStop && (await options.shouldStop())) {
          logger.info(`Batch processing stopped at batch ${batchIndex + 1} for ${assetType}`);
          if (this.jobStateService) {
            await this.jobStateService.logWarn(
              this.jobId,
              `Batch processing stopped at batch ${batchIndex + 1}`,
              { assetType }
            );
          }
          wasStopped = true;
          break;
        }

        const batch = batches[batchIndex];
        if (!batch || batch.length === 0) {
          continue;
        }

        // Process single batch
        const batchResults = await this.processSingleBatch(
          {
            batch,
            batchIndex,
            totalBatches: batches.length,
            assetType,
          },
          processor,
          processingContext,
          options.maxConcurrency || EXPORT_CONFIG.concurrency.perAssetType,
          progressCallback
        );

        results.push(...batchResults);
        this.collectBatchErrors(batchResults, errors, batchIndex);

        // Log batch progress
        await this.logBatchProgress(batchIndex, batches.length, assetType, batchResults);

        // Notify progress callback
        progressCallback?.onBatchComplete?.(batchIndex + 1, batches.length, batchResults);
      }
    } finally {
      // Always flush collection batches at the end
      await this.flushCollectionBatches(processor, assetType, errors);
    }

    return { results, errors, stopped: wasStopped };
  }

  /**
   * Set the job context for logging
   */
  public setJobContext(jobStateService: JobStateService, jobId: string): void {
    this.jobStateService = jobStateService;
    this.jobId = jobId;
  }

  /**
   * Collect errors from batch results
   */
  private collectBatchErrors(
    batchResults: EnhancedProcessingResult[],
    errors: BatchError[],
    batchIndex: number
  ): void {
    batchResults
      .filter((result) => result.status === 'error')
      .forEach((result) => {
        errors.push({
          assetId: result.assetId,
          assetName: result.assetName,
          error: result.error || 'Unknown error',
          timestamp: new Date().toISOString(),
          batchIndex,
        });
      });
  }

  /**
   * Create an error result for a failed asset
   */
  private createErrorResult(asset: any, error: unknown): EnhancedProcessingResult {
    return {
      assetId: asset.id,
      assetName: asset.name,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: 0,
      timing: {
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        phases: {},
      },
      cacheHit: false,
    };
  }

  /**
   * Flush collection batches and handle errors
   */
  private async flushCollectionBatches(
    processor: BaseAssetProcessor,
    assetType: AssetType,
    errors: BatchError[]
  ): Promise<void> {
    if (processor.storageType === 'collection') {
      try {
        await BaseAssetProcessor.flushCollectionBatches(this.s3Service);
        logger.info(`Flushed collection batches for ${assetType}`);
      } catch (error) {
        logger.error(`Failed to flush collection batches for ${assetType}:`, error);
        errors.push({
          assetId: 'BATCH_FLUSH',
          assetName: `${assetType} collection flush`,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Log batch progress
   */
  private async logBatchProgress(
    batchIndex: number,
    totalBatches: number,
    assetType: string,
    batchResults: EnhancedProcessingResult[]
  ): Promise<void> {
    if (!this.jobStateService) {
      return;
    }

    const batchSuccessful = batchResults.filter((r) => r.status === 'success').length;
    const batchFailed = batchResults.filter((r) => r.status === 'error').length;

    // Log warnings for failed items
    if (batchFailed > 0) {
      await this.jobStateService.logWarn(
        this.jobId,
        `Batch ${batchIndex + 1}/${totalBatches} for ${assetType}: ${batchSuccessful} successful, ${batchFailed} failed`,
        { assetType }
      );
    }

    // Log running total periodically (every 5 batches or on last batch)
    if (
      (batchIndex + 1) % LOGGING_CONFIG.PROGRESS_LOG_INTERVAL === 0 ||
      batchIndex === totalBatches - 1
    ) {
      await this.jobStateService.logInfo(
        this.jobId,
        `Batch ${batchIndex + 1}/${totalBatches} completed`,
        { assetType }
      );
    }
  }

  /**
   * Log the start of a batch
   */
  private async logBatchStart(
    batchIndex: number,
    totalBatches: number,
    batchSize: number,
    assetType: string
  ): Promise<void> {
    if (this.jobStateService) {
      await this.jobStateService.logInfo(
        this.jobId,
        `Processing batch ${batchIndex + 1}/${totalBatches} (${batchSize} assets)`,
        { assetType }
      );
    }
  }

  /**
   * Log the start of enrichment
   */
  private async logEnrichmentStart(
    assetType: AssetType,
    activeCount: number,
    totalCount: number,
    batchCount: number
  ): Promise<void> {
    if (this.jobStateService) {
      await this.jobStateService.logInfo(
        this.jobId,
        `Starting enrichment for ${activeCount} of ${totalCount} assets (${totalCount - activeCount} unchanged) in ${batchCount} batches`,
        { assetType }
      );
    }
  }

  /**
   * Process a single batch of assets
   */
  private async processSingleBatch(
    batchContext: BatchContext,
    processor: BaseAssetProcessor,
    processingContext: ProcessingContext,
    maxConcurrency: number,
    progressCallback?: BatchProgressCallback
  ): Promise<EnhancedProcessingResult[]> {
    const { batch, batchIndex, totalBatches, assetType } = batchContext;

    // Log batch start
    await this.logBatchStart(batchIndex, totalBatches, batch.length, assetType);
    progressCallback?.onBatchStart?.(batchIndex + 1, totalBatches, batch.length);

    // Create concurrency limiter
    const assetProcessLimit = pLimit(maxConcurrency);

    // Process all assets in the batch concurrently with rate limiting
    const batchPromises = batch.map((asset) =>
      assetProcessLimit(async () => {
        try {
          const result = await processor.processAsset(asset.originalSummary, processingContext);

          // Report progress
          if (result.status === 'error') {
            progressCallback?.onItemError?.(
              new Error(result.error || 'Unknown error'),
              result.assetId
            );
          } else {
            progressCallback?.onItemComplete?.(result);
          }

          return result;
        } catch (error) {
          // Handle single asset error
          const errorResult = this.createErrorResult(asset, error);

          progressCallback?.onItemError?.(
            error instanceof Error ? error : new Error(String(error)),
            asset.id
          );

          logger.error(`Failed to process ${assetType} ${asset.id}:`, error);
          return errorResult;
        }
      })
    );

    const batchResults = await Promise.all(batchPromises);

    return batchResults;
  }
}
