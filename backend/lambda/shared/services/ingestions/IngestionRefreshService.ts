/**
 * IngestionRefreshService — canonical fetch/cache path for dataset ingestion
 * (refresh) activity. Ingestions are fetched from QuickSight once per refresh
 * (one ListIngestions per SPICE dataset), persisted to the ingestions cache,
 * and read from there by everything else — mirroring how CloudTrail activity
 * is fetched once into the activity cache and computed on read.
 *
 * Consumers: the activity-refresh job (refresh phase) and IngestionHandler
 * (live DescribeIngestion for the detail view).
 */
import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../config/exportConfig';
import { type Ingestion, type IngestionMetadata } from '../../models/ingestion.model';
import { resolveSourceTypeFromArns } from '../../utils/filterUtils';
import { logger } from '../../utils/logger';
import { type QuickSightService } from '../aws/QuickSightService';
import { type CacheService } from '../cache/CacheService';

export interface IngestionRefreshResult {
  ingestions: Ingestion[];
  metadata: IngestionMetadata;
  processingTimeMs: number;
  errors: string[];
}

export class IngestionRefreshService {
  private readonly cacheService: CacheService;
  private readonly concurrencyLimit: pLimit.Limit;
  private readonly quickSightService: QuickSightService;

  constructor(quickSightService: QuickSightService, cacheService: CacheService) {
    this.quickSightService = quickSightService;
    this.cacheService = cacheService;
    this.concurrencyLimit = pLimit(EXPORT_CONFIG.concurrency.perProcessor);
  }

  /**
   * Get detailed ingestion information (live DescribeIngestion)
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
   * Fetch ingestions for all SPICE datasets and persist them to the
   * ingestions cache. Returns the refreshed data and per-dataset errors.
   */
  public async refreshIngestionsCache(): Promise<IngestionRefreshResult> {
    const result = await this.fetchAllIngestions();
    await this.cacheService.saveIngestions(result.ingestions, result.metadata);

    logger.info('Ingestions refreshed and cached', {
      totalIngestions: result.metadata.totalIngestions,
      runningIngestions: result.metadata.runningIngestions,
      failedIngestions: result.metadata.failedIngestions,
      processingTimeMs: result.processingTimeMs,
      errors: result.errors.length,
    });

    return result;
  }

  /**
   * Fetch ingestions for all SPICE datasets (no persistence)
   */
  private async fetchAllIngestions(): Promise<IngestionRefreshResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const allIngestions: Ingestion[] = [];

    // Get all datasets and datasources from cache
    const datasets = await this.cacheService.getAllDatasets();
    const datasourceResult = await this.cacheService.getAssetsByType('datasource');
    const datasourceEntries = datasourceResult.assets || [];
    const spiceDatasets = datasets.filter((ds) => ds.metadata?.importMode === 'SPICE');

    logger.info(`Found ${spiceDatasets.length} SPICE datasets to fetch ingestions for`);

    // Fetch each dataset's ingestions in parallel with concurrency control
    const ingestionPromises = spiceDatasets.map((dataset) =>
      this.concurrencyLimit(async () => {
        try {
          // Resolve sourceType from datasource ARNs since it's not stored in dataset metadata
          const datasourceArns: string[] = dataset.metadata?.datasourceArns || [];
          const resolvedSourceType = resolveSourceTypeFromArns(datasourceArns, datasourceEntries);

          return await this.fetchDatasetIngestions(dataset.assetId, dataset.assetName, {
            ...dataset.metadata,
            sourceType: resolvedSourceType,
          });
        } catch (error) {
          const errorMsg = `Failed to fetch ingestions for dataset ${dataset.assetId}: ${error}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
          return [];
        }
      })
    );

    const ingestionResults = await Promise.all(ingestionPromises);

    for (const ingestions of ingestionResults) {
      allIngestions.push(...ingestions);
    }

    // Sort by created time (newest first)
    allIngestions.sort(
      (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
    );

    const metadata: IngestionMetadata = {
      totalIngestions: allIngestions.length,
      runningIngestions: allIngestions.filter(
        (i) => i.status === 'RUNNING' || i.status === 'QUEUED' || i.status === 'INITIALIZED'
      ).length,
      failedIngestions: allIngestions.filter((i) => i.status === 'FAILED').length,
      lastUpdated: new Date().toISOString(),
    };

    return {
      ingestions: allIngestions,
      metadata,
      processingTimeMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Fetch ingestions for a specific dataset
   */
  private async fetchDatasetIngestions(
    datasetId: string,
    datasetName?: string,
    datasetMetadata?: any
  ): Promise<Ingestion[]> {
    try {
      const response = await this.quickSightService.listIngestions(datasetId);

      return response.ingestions.map((ingestion: any) => ({
        id: ingestion.IngestionId,
        datasetId,
        datasetName,
        datasourceType: datasetMetadata?.sourceType,
        importMode: datasetMetadata?.importMode,
        sizeInBytes: datasetMetadata?.consumedSpiceCapacityInBytes || datasetMetadata?.sizeInBytes,
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
