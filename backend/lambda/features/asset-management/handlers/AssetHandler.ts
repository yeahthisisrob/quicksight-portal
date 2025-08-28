import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES, ACTIVITY_LIMITS } from '../../../shared/constants';
import { S3Service } from '../../../shared/services/aws/S3Service';
import { BulkOperationsService } from '../../../shared/services/bulk/BulkOperationsService';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { ASSET_TYPES, ASSET_TYPES_PLURAL } from '../../../shared/types/assetTypes';
import { successResponse, errorResponse, createResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { GroupService } from '../../organization/services/GroupService';
import { AssetService } from '../services/AssetService';
export class AssetHandler {
  private readonly accountId: string;
  private readonly assetService: AssetService;
  private readonly bucketName: string;
  private readonly bulkOperationsService: BulkOperationsService;
  private readonly s3Service: S3Service;

  constructor() {
    this.accountId = process.env.AWS_ACCOUNT_ID || '';
    this.assetService = new AssetService(this.accountId);
    this.bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${this.accountId}`;

    // Initialize bulk operations service for all bulk operations
    this.bulkOperationsService = new BulkOperationsService(this.accountId);

    // Initialize S3 service
    this.s3Service = new S3Service(this.accountId);
  }

  public async bulkDelete(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const { assets, reason } = JSON.parse(event.body || '{}');

      if (!assets || !Array.isArray(assets) || assets.length === 0) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Assets array is required and must not be empty'
        );
      }

      // Validate asset structure
      for (const asset of assets) {
        if (!asset.type || !asset.id) {
          return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Each asset must have type and id');
        }
      }

      logger.info('Starting bulk delete operation', {
        user: user.email,
        assetCount: assets.length,
        reason,
      });

      // Always use job queue for bulk operations
      const result = await this.bulkOperationsService.bulkDelete(
        assets,
        user.email || user.userId || 'unknown',
        reason
      );

      return createResponse(event, STATUS_CODES.ACCEPTED, {
        success: true,
        jobId: result.jobId,
        status: result.status,
        message: result.message,
        estimatedOperations: result.estimatedOperations,
      });
    } catch (error: any) {
      logger.error('Bulk delete failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async clearMemoryCache(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      logger.info('Clearing memory cache', { user: user.email });

      const { cacheService } = await import('../../../shared/services/cache/CacheService');
      await cacheService.clearMemoryCache();

      return successResponse(event, {
        success: true,
        message: 'Memory cache cleared successfully',
      });
    } catch (error) {
      logger.error('Failed to clear memory cache', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to clear memory cache'
      );
    }
  }

  /**
   * Get archived asset metadata for restore preview
   */
  public async getArchivedAssetMetadata(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const { assetType, assetId } = event.queryStringParameters || {};

      if (!assetType || !assetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset type and ID are required');
      }

      // Validate asset type
      if (!Object.values(ASSET_TYPES).includes(assetType as any)) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, `Invalid asset type: ${assetType}`);
      }

      // Determine the path based on asset type
      const archivePath = `archived/${ASSET_TYPES_PLURAL[assetType as keyof typeof ASSET_TYPES]}/${assetId}.json`;

      try {
        const archivedData = await this.s3Service.getObject(this.bucketName, archivePath);

        if (!archivedData) {
          return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Archived asset not found');
        }

        return successResponse(event, {
          success: true,
          data: archivedData,
        });
      } catch (error: any) {
        if (
          error.name === 'NoSuchKey' ||
          error.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND
        ) {
          return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Archived asset not found');
        }
        throw error;
      }
    } catch (error: any) {
      logger.error('Failed to get archived asset metadata', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async getExportedAsset(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const { assetType, assetId } = this.extractPathParams(event);

      if (!assetType || !assetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset type and ID are required');
      }

      const assetData = await this.retrieveExportedAssetData(assetType, assetId);

      return successResponse(event, {
        success: true,
        data: assetData,
      });
    } catch (error: any) {
      logger.error('Get exported asset failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async getViews(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { type: assetType, id: assetId } = event.pathParameters || {};

      if (!assetType || !assetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset type and ID are required');
      }

      // Only support dashboards and analyses now
      if (
        assetType !== ASSET_TYPES.dashboard &&
        assetType !== ASSET_TYPES.analysis &&
        assetType !== ASSET_TYPES_PLURAL.dashboard &&
        assetType !== ASSET_TYPES_PLURAL.analysis
      ) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Views tracking only available for dashboards and analyses'
        );
      }

      // Use the new activity service
      const { ActivityService } = await import('../../activity/services/ActivityService');
      const { CloudTrailAdapter } = await import('../../../adapters/aws/CloudTrailAdapter');
      const { CloudTrailClient } = await import('@aws-sdk/client-cloudtrail');

      const region = process.env.AWS_REGION || 'us-east-1';

      const cacheService = CacheService.getInstance();
      const cloudTrailClient = new CloudTrailClient({ region });
      const cloudTrailAdapter = new CloudTrailAdapter(cloudTrailClient, region);
      const groupService = new GroupService();

      const activityService = new ActivityService(cacheService, cloudTrailAdapter, groupService);

      // Map asset type to activity type
      const activityType =
        assetType === ASSET_TYPES.dashboard || assetType === ASSET_TYPES_PLURAL.dashboard
          ? 'dashboard'
          : 'analysis';

      const activityData = await activityService.getAssetActivity(
        activityType as 'dashboard' | 'analysis',
        assetId
      );

      if (!activityData) {
        return successResponse(event, {
          assetId,
          assetType: activityType,
          totalViews: 0,
          uniqueViewers: 0,
          viewsByDate: {},
          topViewers: [],
        });
      }

      return successResponse(event, activityData);
    } catch (error: any) {
      logger.error('Get asset views failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async list(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { assetType } = this.extractPathParams(event);

      logger.debug('AssetHandler.list', { assetType });

      if (!assetType) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset type is required');
      }

      const page = parseInt(event.queryStringParameters?.page || '1');
      const pageSize = parseInt(event.queryStringParameters?.pageSize || '50');

      const result = await this.assetService.list(assetType, {
        maxResults: pageSize,
        nextToken: event.queryStringParameters?.nextToken,
        sortBy: event.queryStringParameters?.sortBy,
        sortOrder: event.queryStringParameters?.sortOrder?.toUpperCase() as 'ASC' | 'DESC',
        startIndex: (page - 1) * pageSize,
        search: event.queryStringParameters?.search,
        filters: event.queryStringParameters?.filters
          ? JSON.parse(event.queryStringParameters.filters)
          : undefined,
      });

      const assetTypeKey = ASSET_TYPES_PLURAL[assetType as keyof typeof ASSET_TYPES_PLURAL];

      return successResponse(event, {
        success: true,
        data: {
          [assetTypeKey]: result.items,
          pagination: {
            page,
            pageSize,
            totalItems: result.totalCount || result.items.length,
            totalPages: Math.ceil((result.totalCount || result.items.length) / pageSize),
            hasMore: !!result.nextToken,
          },
          fromCache: true,
        },
      });
    } catch (error: any) {
      logger.error('List assets failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async listArchived(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const params = event.queryStringParameters || {};

      // Extract pagination and filtering parameters
      const page = parseInt(params.page || '1');
      const pageSize = parseInt(params.pageSize || '50');
      const search = params.search || '';
      const assetType = params.type as any;
      const sortBy = params.sortBy || 'archivedDate';
      const sortOrder = (params.sortOrder || 'desc') as 'asc' | 'desc';
      const dateRange = params.dateRange || 'all';

      const result = await this.assetService.getArchivedAssetsPaginated({
        page,
        pageSize,
        search,
        assetType,
        sortBy,
        sortOrder,
        dateRange,
      });

      return successResponse(event, {
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('List archived assets failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async rebuildIndex(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      logger.info('Rebuilding index', { user: user.email });

      // Import and rebuild cache
      const { cacheService } = await import('../../../shared/services/cache/CacheService');
      await cacheService.rebuildCache();

      // Cache service handles all cache rebuilding in one operation
      logger.info('Cache rebuilt successfully');

      return successResponse(event, {
        success: true,
        data: {
          message: 'Cache rebuilt successfully',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to rebuild index', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to rebuild index');
    }
  }

  public async refreshViewStats(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const body = JSON.parse(event.body || '{}');

      const days = body.days || ACTIVITY_LIMITS.MAX_ACTIVITY_DAYS;
      const assetTypes = body.assetTypes || [ASSET_TYPES.dashboard, ASSET_TYPES.analysis];
      const dashboardIds = body.dashboardIds;
      const analysisIds = body.analysisIds;

      logger.info('Refreshing view statistics', {
        user: user.email,
        days,
        assetTypes,
        dashboardIds: dashboardIds?.length,
        analysisIds: analysisIds?.length,
      });

      // Use the new activity service
      const { ActivityService } = await import('../../activity/services/ActivityService');
      const { CloudTrailAdapter } = await import('../../../adapters/aws/CloudTrailAdapter');
      const { CloudTrailClient } = await import('@aws-sdk/client-cloudtrail');

      const region = process.env.AWS_REGION || 'us-east-1';

      const cacheService = CacheService.getInstance();
      const cloudTrailClient = new CloudTrailClient({ region });
      const cloudTrailAdapter = new CloudTrailAdapter(cloudTrailClient, region);
      const groupService = new GroupService();

      const activityService = new ActivityService(cacheService, cloudTrailAdapter, groupService);

      // Convert asset types to activity asset types
      const activityAssetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[] = [];
      if (assetTypes.includes(ASSET_TYPES.dashboard)) {
        activityAssetTypes.push('dashboard');
      }
      if (assetTypes.includes(ASSET_TYPES.analysis)) {
        activityAssetTypes.push('analysis');
      }

      // Refresh activity data
      const result = await activityService.refreshActivity({
        assetTypes: activityAssetTypes,
        days,
      });

      logger.info('View statistics refresh completed', {
        result,
      });

      return successResponse(event, result);
    } catch (error: any) {
      logger.error('Failed to refresh view statistics', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to refresh view statistics'
      );
    }
  }

  /**
   * Validate bulk delete operation (check dependencies)
   */
  public async validateBulkDelete(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const { assets } = JSON.parse(event.body || '{}');

      if (!assets || !Array.isArray(assets) || assets.length === 0) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Assets array is required and must not be empty'
        );
      }

      // Validate asset structure
      for (const asset of assets) {
        if (!asset.type || !asset.id) {
          return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Each asset must have type and id');
        }
      }

      logger.info('Validating bulk delete operation', {
        user: user.email,
        assetCount: assets.length,
      });

      // TODO: Implement actual validation logic for dependencies
      // For now, return success indicating all assets can be deleted
      return successResponse(event, {
        success: true,
        canDelete: true,
        dependencies: [],
        message: 'All assets can be safely deleted',
      });
    } catch (error: any) {
      logger.error('Bulk delete validation failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  private extractPathParams(event: APIGatewayProxyEvent): { assetType?: string; assetId?: string } {
    const path = event.path.replace('/api', '');

    // Try different patterns
    let match = path.match(
      /^\/assets\/(dashboards?|datasets?|analyses?|datasources?|folders?|users?|groups?)\/paginated$/
    );
    if (match) {
      // Convert plural to singular by finding matching entry
      const plural = match[1];
      const entry = Object.entries(ASSET_TYPES_PLURAL).find(([_, p]) => p === plural);
      return { assetType: entry ? entry[0] : match[1] };
    }

    match = path.match(
      /^\/assets\/(dashboards?|datasets?|analyses?|datasources?|folders?|users?|groups?)\/([^/]+)(?:\/.*)?$/
    );
    if (match) {
      // Convert plural to singular by finding matching entry
      const plural = match[1];
      const entry = Object.entries(ASSET_TYPES_PLURAL).find(([_, p]) => p === plural);
      return { assetType: entry ? entry[0] : match[1], assetId: match[2] };
    }

    return {};
  }

  /**
   * Get plural form of asset type with validation
   */
  private getAssetPluralType(assetType: string): string {
    const pluralType = ASSET_TYPES_PLURAL[assetType as keyof typeof ASSET_TYPES_PLURAL];
    if (!pluralType) {
      throw new Error(`Invalid asset type: ${assetType}`);
    }
    return pluralType;
  }

  /**
   * Retrieve exported asset data from S3, checking both regular and archived locations
   */
  private async retrieveExportedAssetData(assetType: string, assetId: string): Promise<any> {
    const pluralType = this.getAssetPluralType(assetType);

    // Try regular assets path first
    const regularPath = `assets/${pluralType}/${assetId}.json`;
    const assetData = await this.tryGetAssetFromPath(regularPath);

    if (assetData) {
      return assetData;
    }

    // If not found in regular location, try archived path
    const archivedPath = `archived/${pluralType}/${assetId}.json`;
    const archivedData = await this.tryGetAssetFromPath(archivedPath);

    if (archivedData) {
      return archivedData;
    }

    throw new Error('Asset not found');
  }

  /**
   * Try to get asset data from a specific S3 path
   */
  private async tryGetAssetFromPath(s3Key: string): Promise<any | null> {
    try {
      const assetData = await this.s3Service.getObject(this.bucketName, s3Key);
      return assetData;
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND
      ) {
        return null;
      }
      throw error;
    }
  }
}
