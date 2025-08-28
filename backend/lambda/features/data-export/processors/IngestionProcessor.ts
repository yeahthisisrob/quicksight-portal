import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../../shared/config/exportConfig';
import { type Ingestion, type IngestionMetadata } from '../../../shared/models/ingestion.model';
import { type QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { type CacheService } from '../../../shared/services/cache/CacheService';
import { logger } from '../../../shared/utils/logger';

export interface IngestionProcessingResult {
  ingestions: Ingestion[];
  metadata: IngestionMetadata;
  processingTimeMs: number;
  errors: string[];
}

export class IngestionProcessor {
  private readonly cacheService: CacheService;
  private readonly concurrencyLimit: pLimit.Limit;
  private readonly quickSightService: QuickSightService;

  constructor(quickSightService: QuickSightService, cacheService: CacheService) {
    this.quickSightService = quickSightService;
    this.cacheService = cacheService;
    this.concurrencyLimit = pLimit(EXPORT_CONFIG.concurrency.perProcessor);
  }

  /**
   * Get detailed ingestion information
   */
  public async getIngestionDetails(
    datasetId: string,
    ingestionId: string
  ): Promise<Ingestion | null> {
    try {
      const ingestion = await this.quickSightService.describeIngestion(datasetId, ingestionId);

      if (!ingestion) {
        return null;
      }

      return {
        id: ingestion.IngestionId,
        datasetId,
        ingestionArn: ingestion.Arn,
        status: ingestion.IngestionStatus,
        createdTime: ingestion.CreatedTime,
        ingestionTimeInSeconds: ingestion.IngestionTimeInSeconds,
        ingestionSizeInBytes: ingestion.IngestionSizeInBytes,
        rowsIngested: ingestion.RowInfo?.RowsIngested,
        rowsDropped: ingestion.RowInfo?.RowsDropped,
        errorType: ingestion.ErrorInfo?.Type,
        errorMessage: ingestion.ErrorInfo?.Message,
        requestType: ingestion.RequestType,
        queueInfo: ingestion.QueueInfo
          ? {
              waitingOnIngestion: ingestion.QueueInfo.WaitingOnIngestion,
              queuedIngestion: ingestion.QueueInfo.QueuedIngestion,
            }
          : undefined,
      };
    } catch (error) {
      logger.error(`Failed to describe ingestion ${ingestionId} for dataset ${datasetId}`, {
        error,
      });
      return null;
    }
  }

  /**
   * Process ingestions for all SPICE datasets
   */
  public async processIngestions(): Promise<IngestionProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const allIngestions: Ingestion[] = [];

    try {
      logger.info('Starting ingestion processing');

      // Get all datasets from cache
      const datasets = await this.cacheService.getAllDatasets();
      const spiceDatasets = datasets.filter((ds) => ds.metadata?.importMode === 'SPICE');

      logger.info(`Found ${spiceDatasets.length} SPICE datasets to process`);

      // Process each dataset's ingestions in parallel with concurrency control
      const ingestionPromises = spiceDatasets.map((dataset) =>
        this.concurrencyLimit(async () => {
          try {
            const ingestions = await this.fetchDatasetIngestions(
              dataset.assetId,
              dataset.assetName
            );
            return ingestions;
          } catch (error) {
            const errorMsg = `Failed to fetch ingestions for dataset ${dataset.assetId}: ${error}`;
            logger.error(errorMsg);
            errors.push(errorMsg);
            return [];
          }
        })
      );

      const ingestionResults = await Promise.all(ingestionPromises);

      // Flatten and deduplicate ingestions
      for (const ingestions of ingestionResults) {
        allIngestions.push(...ingestions);
      }

      // Sort by created time (newest first)
      allIngestions.sort(
        (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
      );

      // Generate metadata
      const metadata: IngestionMetadata = {
        totalIngestions: allIngestions.length,
        runningIngestions: allIngestions.filter(
          (i) => i.status === 'RUNNING' || i.status === 'QUEUED' || i.status === 'INITIALIZED'
        ).length,
        failedIngestions: allIngestions.filter((i) => i.status === 'FAILED').length,
        lastUpdated: new Date().toISOString(),
      };

      const processingTimeMs = Date.now() - startTime;

      logger.info(`Ingestion processing completed in ${processingTimeMs}ms`, {
        totalIngestions: metadata.totalIngestions,
        runningIngestions: metadata.runningIngestions,
        failedIngestions: metadata.failedIngestions,
        errors: errors.length,
      });

      return {
        ingestions: allIngestions,
        metadata,
        processingTimeMs,
        errors,
      };
    } catch (error) {
      logger.error('Failed to process ingestions', { error });
      throw error;
    }
  }

  /**
   * Fetch ingestions for a specific dataset
   */
  private async fetchDatasetIngestions(
    datasetId: string,
    datasetName?: string
  ): Promise<Ingestion[]> {
    try {
      const response = await this.quickSightService.listIngestions(datasetId);

      return response.ingestions.map((ingestion: any) => ({
        id: ingestion.IngestionId,
        datasetId,
        datasetName,
        datasetArn: ingestion.Arn,
        ingestionArn: ingestion.IngestionArn,
        status: ingestion.IngestionStatus,
        createdTime: ingestion.CreatedTime,
        ingestionTimeInSeconds: ingestion.IngestionTimeInSeconds,
        ingestionSizeInBytes: ingestion.IngestionSizeInBytes,
        rowsIngested: ingestion.RowInfo?.RowsIngested,
        rowsDropped: ingestion.RowInfo?.RowsDropped,
        errorType: ingestion.ErrorInfo?.Type,
        errorMessage: ingestion.ErrorInfo?.Message,
        requestType: ingestion.RequestType,
        queueInfo: ingestion.QueueInfo
          ? {
              waitingOnIngestion: ingestion.QueueInfo.WaitingOnIngestion,
              queuedIngestion: ingestion.QueueInfo.QueuedIngestion,
            }
          : undefined,
      }));
    } catch (error) {
      logger.error(`Failed to list ingestions for dataset ${datasetId}`, { error });
      throw error;
    }
  }
}
