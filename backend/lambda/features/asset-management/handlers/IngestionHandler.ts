import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { successResponse, errorResponse } from '../../../shared/utils/cors';
import { countByField, resolveSourceTypeFromArns } from '../../../shared/utils/filterUtils';
import { logger } from '../../../shared/utils/logger';
import {
  applyDateFilter,
  processPaginatedData,
  type DateRange,
} from '../../../shared/utils/paginationUtils';
import { IngestionProcessor } from '../../data-export/processors/IngestionProcessor';

export class IngestionHandler {
  private readonly ingestionProcessor: IngestionProcessor;
  private readonly quickSightService: QuickSightService;

  constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.quickSightService = new QuickSightService(accountId);
    this.ingestionProcessor = new IngestionProcessor(this.quickSightService, cacheService);
  }

  /**
   * Cancel an ingestion
   */
  public async cancel(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      // Extract path parameters from the URL
      const path = event.path.replace('/api', '');
      const match = path.match(new RegExp('^/ingestions/([^/]+)/([^/]+)$'));

      if (!match) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Invalid path parameters');
      }

      const datasetId = match[1];
      const ingestionId = match[2];

      if (!datasetId || !ingestionId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Invalid path format');
      }

      // Cancel the ingestion
      await this.quickSightService.cancelIngestion(datasetId, ingestionId);

      return successResponse(event, {
        success: true,
        message: 'Ingestion cancelled successfully',
      });
    } catch (error: any) {
      logger.error('Failed to cancel ingestion', { error });

      if (error.message?.includes('NOT_FOUND')) {
        return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Ingestion not found');
      }

      if (error.message?.includes('INVALID_STATE')) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Ingestion cannot be cancelled in its current state'
        );
      }

      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to cancel ingestion');
    }
  }

  /**
   * Get ingestion details
   */
  public async getDetails(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      // Extract path parameters from the URL
      const path = event.path.replace('/api', '');
      const match = path.match(new RegExp('^/ingestions/([^/]+)/([^/]+)$'));

      if (!match) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Invalid path parameters');
      }

      const datasetId = match[1];
      const ingestionId = match[2];

      if (!datasetId || !ingestionId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Invalid path format');
      }

      // Get ingestion details from QuickSight
      const ingestion = await this.ingestionProcessor.getIngestionDetails(datasetId, ingestionId);

      if (!ingestion) {
        return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Ingestion not found');
      }

      return successResponse(event, {
        success: true,
        data: ingestion,
      });
    } catch (error) {
      logger.error('Failed to get ingestion details', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get ingestion details'
      );
    }
  }

  /**
   * List cached ingestions with pagination and filtering
   */
  public async list(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      // Get query parameters
      const queryParams = event.queryStringParameters || {};
      const search = queryParams.search || '';
      const sortBy = queryParams.sortBy || 'createdTime';
      const sortOrder = (queryParams.sortOrder || 'desc') as 'asc' | 'desc';
      const page = parseInt(queryParams.page || '1', 10);
      const pageSize = parseInt(queryParams.pageSize || '50', 10);
      const dateRange = (queryParams.dateRange || 'all') as DateRange;
      const dateField = queryParams.dateField || 'createdTime';
      const sourceTypeFilter: string[] | undefined = queryParams.sourceTypeFilter
        ? JSON.parse(queryParams.sourceTypeFilter)
        : undefined;

      // Get cached ingestions
      const cachedData = await cacheService.getIngestions();

      if (!cachedData || !cachedData.ingestions) {
        return successResponse(event, {
          success: true,
          data: {
            ingestions: [],
            availableSourceTypes: [],
            metadata: {
              totalIngestions: 0,
              runningIngestions: 0,
              failedIngestions: 0,
              lastUpdated: new Date().toISOString(),
            },
            pagination: {
              page: 1,
              pageSize,
              totalItems: 0,
              totalPages: 0,
              hasMore: false,
            },
          },
        });
      }

      // Apply date filter
      const dateFiltered = applyDateFilter(cachedData.ingestions, dateField, dateRange);

      // Enrich ALL ingestions with dataset metadata before filtering/pagination
      // sourceType is resolved at runtime from datasource ARNs, not stored in dataset metadata
      const datasourceResult = await cacheService.getAssetsByType('datasource');
      const datasourceEntries = datasourceResult.assets || [];
      const enrichedIngestions = await Promise.all(
        dateFiltered.map(async (ingestion) => {
          if (ingestion.datasourceType && ingestion.importMode && ingestion.sizeInBytes) {
            return ingestion;
          }
          try {
            const dataset = await cacheService.getAsset('dataset', ingestion.datasetId);
            if (!dataset) {
              return ingestion;
            }

            let datasourceType = ingestion.datasourceType;
            if (!datasourceType) {
              const datasourceArns: string[] = dataset.metadata?.datasourceArns || [];
              datasourceType = resolveSourceTypeFromArns(datasourceArns, datasourceEntries);
            }

            return {
              ...ingestion,
              datasourceType,
              importMode: ingestion.importMode || dataset.metadata?.importMode,
              sizeInBytes:
                ingestion.sizeInBytes ||
                dataset.metadata?.consumedSpiceCapacityInBytes ||
                dataset.metadata?.sizeInBytes,
            };
          } catch (_error) {
            return ingestion;
          }
        })
      );

      // Compute available source types from enriched data (before sourceType filter)
      const availableSourceTypes = countByField(enrichedIngestions, (i) => i.datasourceType);

      // Apply source type filter
      const filteredIngestions =
        sourceTypeFilter && sourceTypeFilter.length > 0
          ? enrichedIngestions.filter(
              (i) => i.datasourceType && sourceTypeFilter.includes(i.datasourceType)
            )
          : enrichedIngestions;

      // Define search fields
      const searchFields = [
        { getValue: (item: any) => item.datasetName || '' },
        { getValue: (item: any) => item.id || '' },
        { getValue: (item: any) => item.status || '' },
        { getValue: (item: any) => item.errorMessage || '' },
      ];

      // Define sort configurations
      const sortConfigs = {
        createdTime: {
          field: 'createdTime',
          getValue: (item: any) => new Date(item.createdTime).getTime(),
        },
        status: {
          field: 'status',
          getValue: (item: any) => item.status,
        },
        datasetName: {
          field: 'datasetName',
          getValue: (item: any) => item.datasetName || '',
        },
        ingestionTimeInSeconds: {
          field: 'ingestionTimeInSeconds',
          getValue: (item: any) => item.ingestionTimeInSeconds || 0,
        },
        rowsIngested: {
          field: 'rowsIngested',
          getValue: (item: any) => item.rowsIngested || 0,
        },
      };

      // Process data with pagination
      const result = processPaginatedData(
        filteredIngestions,
        { page, pageSize, search, sortBy, sortOrder },
        searchFields,
        sortConfigs
      );

      return successResponse(event, {
        success: true,
        data: {
          ingestions: result.items,
          availableSourceTypes,
          metadata: cachedData.metadata,
          pagination: result.pagination,
        },
      });
    } catch (error) {
      logger.error('Failed to list ingestions', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to list ingestions');
    }
  }
}
