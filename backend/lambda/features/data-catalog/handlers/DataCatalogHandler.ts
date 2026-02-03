import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES, PAGINATION } from '../../../shared/constants';
import { type AssetType } from '../../../shared/types/assetTypes';
import { successResponse, errorResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import {
  type PaginationParams,
  type SearchFieldConfig,
  processPaginatedData,
  type SortConfig,
} from '../../../shared/utils/paginationUtils';
import { CatalogService } from '../services/CatalogService';
import { FieldMetadataService } from '../services/FieldMetadataService';
import { type CatalogField, type DataCatalogResult } from '../types';

export class DataCatalogHandler {
  private readonly catalogService: CatalogService;
  private readonly fieldMetadataService: FieldMetadataService;

  constructor() {
    this.fieldMetadataService = new FieldMetadataService();
    this.catalogService = new CatalogService();
  }

  public async addFieldTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { sourceType, sourceId, fieldName } = event.pathParameters || {};
      const { tags } = JSON.parse(event.body || '{}');

      if (!sourceType || !sourceId || !fieldName || !Array.isArray(tags)) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Missing required parameters or tags must be an array'
        );
      }

      await this.fieldMetadataService.addFieldTags(
        sourceType as AssetType,
        sourceId,
        decodeURIComponent(fieldName),
        tags
      );

      // Get updated field metadata to return all tags
      const metadata = await this.fieldMetadataService.getFieldMetadata(
        sourceType as AssetType,
        sourceId,
        decodeURIComponent(fieldName)
      );

      return successResponse(event, {
        success: true,
        data: metadata?.tags || [],
      });
    } catch (error) {
      logger.error('Failed to add field tags', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to add field tags');
    }
  }

  public async getAvailableAssets(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const assets = await this.catalogService.getAvailableAssets();

      return successResponse(event, {
        success: true,
        data: assets,
      });
    } catch (error) {
      logger.error('Failed to get available assets', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get available assets'
      );
    }
  }

  public async getAvailableTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const tags = await this.catalogService.getAvailableTags();

      return successResponse(event, {
        success: true,
        data: tags,
      });
    } catch (error) {
      logger.error('Failed to get available tags', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get available tags'
      );
    }
  }

  public async getCatalogStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const stats = await this.catalogService.getCatalogStats();

      return successResponse(event, {
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get catalog stats', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get catalog stats'
      );
    }
  }

  public async getCatalogSummary(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const summary = await this.catalogService.getCatalogSummary();

      return successResponse(event, {
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get catalog summary', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get catalog summary'
      );
    }
  }

  public async getDataCatalogPaginated(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const params = this.extractPaginationParams(event);
      const { viewMode, forceRebuild, tagFilter, includeTags, excludeTags, assetIds } =
        this.extractFilterParams(event);

      logger.info('Getting data catalog paginated', {
        ...params,
        viewMode,
        forceRebuild,
        tagFilter,
        includeTags,
        excludeTags,
        assetIds,
      });

      const catalog = await this.catalogService.getDataCatalog(
        tagFilter,
        includeTags,
        excludeTags,
        assetIds
      );
      if (!catalog) {
        return this.createEmptyResponse(event, params);
      }

      const allFields = this.getFieldsByViewMode(catalog, viewMode);
      const searchFields = this.getSearchFields();
      const sortConfigs = this.getSortConfigs();

      const result = processPaginatedData(allFields, params, searchFields, sortConfigs);
      this.logPaginationDebugInfo(result);

      return successResponse(event, {
        success: true,
        data: {
          ...result,
          summary: catalog.summary,
        },
      });
    } catch (error) {
      logger.error('Failed to get data catalog paginated', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get data catalog paginated'
      );
    }
  }

  public async getFieldMetadata(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { sourceType, sourceId, fieldName } = event.pathParameters || {};

      if (!sourceType || !sourceId || !fieldName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Missing required parameters');
      }

      const metadata = await this.fieldMetadataService.getFieldMetadata(
        sourceType as AssetType,
        sourceId,
        decodeURIComponent(fieldName)
      );

      return successResponse(event, {
        success: true,
        data: metadata,
      });
    } catch (error) {
      logger.error('Failed to get field metadata', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get field metadata'
      );
    }
  }

  public async getFieldsPaginated(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const page = Number(event.queryStringParameters?.page) || 1;
      const pageSize =
        Number(event.queryStringParameters?.pageSize) || PAGINATION.DEFAULT_PAGE_SIZE;
      const filters = {
        assetType: event.queryStringParameters?.sourceType, // Map sourceType to assetType
        dataType: event.queryStringParameters?.dataType,
        isCalculated: event.queryStringParameters?.isCalculated === 'true',
        query: event.queryStringParameters?.searchTerm, // Map searchTerm to query
      };

      const result = await this.catalogService.getFieldsPaginated(page, pageSize, filters);

      return successResponse(event, {
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get paginated fields', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get paginated fields'
      );
    }
  }

  public async getSemanticMappings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { fieldId, status, type } = event.queryStringParameters || {};

      logger.info('Getting semantic mappings', { fieldId, status, type });

      // Stub implementation - return empty array for now
      const mappings: any[] = [];

      return successResponse(event, mappings);
    } catch (error) {
      logger.error('Failed to get semantic mappings', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get semantic mappings'
      );
    }
  }

  public async getSemanticStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication

      logger.info('Getting semantic mapping stats');

      // Stub implementation - return default stats
      const stats = {
        totalFields: 0,
        mappedFields: 0,
        unmappedFields: 0,
        manualMappedFields: 0,
        coveragePercentage: 0,
      };

      return successResponse(event, stats);
    } catch (error) {
      logger.error('Failed to get semantic stats', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get semantic stats'
      );
    }
  }

  // Semantic endpoints
  public async getSemanticTerms(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { search, category } = event.queryStringParameters || {};

      logger.info('Getting semantic terms', { search, category });

      // Stub implementation - return empty array for now
      const terms: any[] = [];

      return successResponse(event, terms);
    } catch (error) {
      logger.error('Failed to get semantic terms', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get semantic terms'
      );
    }
  }

  public async getVisualFieldsPaginated(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const queryParams = event.queryStringParameters || {};
      const {
        page = '1',
        pageSize = '50', // Keep as string since it comes from query params
        search = '',
        sortBy = 'displayName',
        sortOrder = 'asc',
      } = queryParams;

      logger.info('Getting visual field catalog', { page, pageSize, search, sortBy, sortOrder });

      const visualFieldCatalog = await this.catalogService.buildVisualFieldCatalog();

      // Check if catalog exists and has data
      if (!visualFieldCatalog || !visualFieldCatalog.visualFields) {
        logger.info('No visual field catalog data available');
        return successResponse(event, {
          success: true,
          data: {
            items: [],
            summary: {
              totalMappings: 0,
              mappingsByAssetType: { dashboards: 0, analyses: 0 },
            },
          },
        });
      }

      // Return basic data for now - more sophisticated pagination can be added later
      return successResponse(event, {
        success: true,
        data: {
          items: visualFieldCatalog.visualFields.slice(0, PAGINATION.DEFAULT_PAGE_SIZE), // Simple pagination
          summary: visualFieldCatalog.summary || {
            totalMappings: visualFieldCatalog.visualFields.length,
            mappingsByAssetType: { dashboards: 0, analyses: 0 },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get visual fields catalog', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get visual fields catalog'
      );
    }
  }

  public async rebuildVisualFieldCatalog(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      logger.info('Force rebuilding visual field catalog');

      // Rebuild the cache to refresh visual field data
      const { cacheService } = await import('../../../shared/services/cache/CacheService');
      await cacheService.rebuildCache();
      logger.info('Rebuilt cache for visual field data');

      // Clear any cached visual field catalog
      try {
        const { ClientFactory } = await import('../../../shared/services/aws/ClientFactory');
        const s3Service = ClientFactory.getS3Service();
        const bucketName = process.env.BUCKET_NAME;
        if (!bucketName) {
          throw new Error('BUCKET_NAME environment variable is not set');
        }
        await s3Service.deleteObject(bucketName, 'catalog/visual-field-catalog.json');
        logger.info('Cleared cached visual field catalog');
      } catch (error) {
        logger.warn('Failed to clear cached visual field catalog:', error);
      }

      // Force rebuild catalog from the newly rebuilt index
      const visualFieldCatalog = await this.catalogService.buildVisualFieldCatalog();

      return successResponse(event, {
        success: true,
        data: {
          message: 'Visual field catalog rebuilt successfully',
          summary: visualFieldCatalog.summary,
          totalMappings: visualFieldCatalog.visualFields?.length || 0,
        },
      });
    } catch (error) {
      logger.error('Failed to rebuild visual field catalog', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to rebuild visual field catalog'
      );
    }
  }

  public async removeFieldTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { sourceType, sourceId, fieldName } = event.pathParameters || {};
      const { tags } = JSON.parse(event.body || '{}');

      if (!sourceType || !sourceId || !fieldName || !Array.isArray(tags)) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Missing required parameters or tags must be an array'
        );
      }

      await this.fieldMetadataService.removeFieldTags(
        sourceType as AssetType,
        sourceId,
        decodeURIComponent(fieldName),
        tags
      );

      // Get updated field metadata to return remaining tags
      const metadata = await this.fieldMetadataService.getFieldMetadata(
        sourceType as AssetType,
        sourceId,
        decodeURIComponent(fieldName)
      );

      return successResponse(event, {
        success: true,
        data: metadata?.tags || [],
      });
    } catch (error) {
      logger.error('Failed to remove field tags', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to remove field tags'
      );
    }
  }

  public async searchFieldsByTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { tags } = JSON.parse(event.body || '{}');

      if (!Array.isArray(tags)) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Tags array is required');
      }

      const fields = await this.fieldMetadataService.searchFieldsByTags(tags);

      return successResponse(event, {
        success: true,
        data: fields,
      });
    } catch (error) {
      logger.error('Failed to search fields by tags', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to search fields by tags'
      );
    }
  }

  public async updateFieldMetadata(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { sourceType, sourceId, fieldName } = event.pathParameters || {};
      const metadata = JSON.parse(event.body || '{}');

      if (!sourceType || !sourceId || !fieldName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Missing required parameters');
      }

      const updatedMetadata = await this.fieldMetadataService.updateFieldMetadata(
        sourceType as AssetType,
        sourceId,
        decodeURIComponent(fieldName),
        metadata
      );

      return successResponse(event, {
        success: true,
        data: updatedMetadata,
      });
    } catch (error) {
      logger.error('Failed to update field metadata', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to update field metadata'
      );
    }
  }

  /**
   * Create empty response for when catalog is null
   */
  private createEmptyResponse(
    event: APIGatewayProxyEvent,
    params: PaginationParams
  ): APIGatewayProxyResult {
    return successResponse(event, {
      success: true,
      data: {
        items: [],
        pagination: {
          page: params.page,
          pageSize: params.pageSize,
          totalItems: 0,
          totalPages: 0,
          hasMore: false,
        },
        summary: {
          totalFields: 0,
          distinctFields: 0,
          totalCalculatedFields: 0,
          calculatedDatasetFields: 0,
          calculatedAnalysisFields: 0,
          visualFields: 0,
          fieldsByDataType: {},
          lastUpdated: new Date(),
          processingTimeMs: 0,
        },
      },
    });
  }

  /**
   * Extract catalog filter parameters
   */
  private extractFilterParams(event: APIGatewayProxyEvent): {
    viewMode: string;
    forceRebuild: boolean;
    tagFilter?: { key: string; value: string };
    includeTags?: Array<{ key: string; value: string }>;
    excludeTags?: Array<{ key: string; value: string }>;
    assetIds?: string[];
  } {
    const viewMode = event.queryStringParameters?.viewMode || 'all';
    const forceRebuild = event.queryStringParameters?.forceRebuild === 'true';

    // Legacy single tag filter (backwards compatible)
    const tagKey = event.queryStringParameters?.tagKey;
    const tagValue = event.queryStringParameters?.tagValue;
    const tagFilter = tagKey && tagValue ? { key: tagKey, value: tagValue } : undefined;

    // New multi-tag include/exclude filters and asset filter
    let includeTags: Array<{ key: string; value: string }> | undefined;
    let excludeTags: Array<{ key: string; value: string }> | undefined;
    let assetIds: string[] | undefined;

    try {
      if (event.queryStringParameters?.includeTags) {
        includeTags = JSON.parse(event.queryStringParameters.includeTags);
      }
      if (event.queryStringParameters?.excludeTags) {
        excludeTags = JSON.parse(event.queryStringParameters.excludeTags);
      }
      if (event.queryStringParameters?.assetIds) {
        assetIds = JSON.parse(event.queryStringParameters.assetIds);
      }
    } catch (error) {
      logger.warn('Failed to parse filter parameters', { error });
    }

    return { viewMode, forceRebuild, tagFilter, includeTags, excludeTags, assetIds };
  }

  /**
   * Extract pagination parameters from query string
   */
  private extractPaginationParams(event: APIGatewayProxyEvent): PaginationParams {
    return {
      page: Number(event.queryStringParameters?.page) || 1,
      pageSize: Number(event.queryStringParameters?.pageSize) || PAGINATION.DEFAULT_PAGE_SIZE,
      search: event.queryStringParameters?.search || '',
      sortBy: event.queryStringParameters?.sortBy || 'fieldName',
      sortOrder: (event.queryStringParameters?.sortOrder as 'asc' | 'desc') || 'asc',
    };
  }

  /**
   * Get fields based on view mode
   */
  private getFieldsByViewMode(catalog: DataCatalogResult, viewMode: string): CatalogField[] {
    switch (viewMode) {
      case 'calculated':
        return catalog.calculatedFields || [];
      case 'fields':
        return catalog.fields || [];
      default:
        return [...(catalog.fields || []), ...(catalog.calculatedFields || [])];
    }
  }

  /**
   * Get search field configs for catalog fields
   */
  private getSearchFields(): SearchFieldConfig<CatalogField>[] {
    return [
      { getValue: (field) => field.fieldName || '' },
      { getValue: (field) => field.description || '' },
      { getValue: (field) => field.expression || '' },
    ];
  }

  /**
   * Get sort configurations for catalog fields
   */
  private getSortConfigs(): Record<string, SortConfig<CatalogField>> {
    return {
      fieldName: {
        field: 'fieldName',
        getValue: (field) => field.fieldName || '',
      },
      dataType: {
        field: 'dataType',
        getValue: (field) => field.dataType || '',
      },
      usageCount: {
        field: 'usageCount',
        getValue: (field) => field.usageCount || 0,
      },
      expression: {
        field: 'expression',
        getValue: (field) => field.expression || '',
      },
    };
  }

  /**
   * Log debug information about pagination results
   */
  private logPaginationDebugInfo(result: any): void {
    if (result.items.length > 0) {
      const firstItem = result.items[0];
      logger.info('First paginated item structure:', {
        fieldName: firstItem.fieldName,
        hasSourcesProperty: 'sources' in firstItem,
        sourcesIsArray: Array.isArray(firstItem.sources),
        sourcesLength: firstItem.sources?.length,
        sourcesType: typeof firstItem.sources,
      });
    }
  }
}
