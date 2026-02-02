import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { BulkOperationsService } from '../../../shared/services/bulk/BulkOperationsService';
import { cacheService, CacheService } from '../../../shared/services/cache/CacheService';
import { type AssetType, getSingularForm } from '../../../shared/types/assetTypes';
import { createResponse, successResponse, errorResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { TagService } from '../services/TagService';

export class TagHandler {
  private readonly bulkOperationsService: BulkOperationsService;
  private readonly tagService: TagService;

  constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.tagService = new TagService(accountId);
    this.bulkOperationsService = new BulkOperationsService();
  }

  public async addTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const { assetType, assetId } = event.pathParameters || {};
      const { tags } = JSON.parse(event.body || '{}');

      if (!assetType || !assetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset type and ID are required');
      }

      if (!tags || !Array.isArray(tags)) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Tags array is required');
      }

      await this.tagService.tagResource(assetType as any, assetId, tags);

      return successResponse(event, {
        success: true,
        data: { message: 'Tags added successfully' },
      });
    } catch (error: any) {
      logger.error('Add tags failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async bulkUpdateTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const { assetType, assetIds, operation, tags, tagKeys } = JSON.parse(event.body || '{}');

      if (!assetType || !assetIds || !Array.isArray(assetIds) || !operation) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Asset type, assetIds array, and operation are required'
        );
      }

      if (operation === 'add' && (!tags || !Array.isArray(tags))) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Tags array is required for add operation'
        );
      }

      if (operation === 'remove' && (!tagKeys || !Array.isArray(tagKeys))) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Tag keys array is required for remove operation'
        );
      }

      // Use BulkOperationsService for tag updates
      const assets = assetIds.map((id: string) => ({
        type: assetType,
        id,
        name: `${assetType}-${id}`, // Placeholder name
      }));

      const result = await this.bulkOperationsService.bulkUpdateTags(
        assets,
        operation === 'add' || operation === 'update' ? tags : undefined,
        operation === 'remove' ? tagKeys : undefined,
        user.email || user.userId || 'unknown'
      );

      return createResponse(event, STATUS_CODES.ACCEPTED, {
        success: true,
        jobId: result.jobId,
        status: result.status,
        message: result.message,
        estimatedOperations: result.estimatedOperations,
      });
    } catch (error: any) {
      logger.error('Bulk update tags failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async getBatchTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { assets } = JSON.parse(event.body || '{}');

      if (!assets || !Array.isArray(assets)) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Assets array is required');
      }

      const results = [];

      for (const asset of assets) {
        try {
          const tags = await this.tagService.getResourceTags(asset.type as any, asset.id);

          results.push({
            type: asset.type,
            id: asset.id,
            tags: tags,
            success: true,
          });
        } catch (error: any) {
          logger.warn(`Failed to get tags for ${asset.type} ${asset.id}:`, error.message);
          results.push({
            type: asset.type,
            id: asset.id,
            tags: [],
            success: false,
            error: error.message,
          });
        }
      }

      return successResponse(event, { success: true, data: results });
    } catch (error: any) {
      logger.error('Get batch tags failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async getTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const { assetType, assetId } = event.pathParameters || {};

      if (!assetType || !assetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset type and ID are required');
      }

      const tags = await this.tagService.getResourceTags(assetType as any, assetId);

      return successResponse(event, { success: true, data: tags });
    } catch (error: any) {
      logger.error('Get tags failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async refreshTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const body = JSON.parse(event.body || '{}');
      const { assetType, assetIds } = body;

      if (!assetType || !assetIds || !Array.isArray(assetIds)) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'assetType and assetIds are required'
        );
      }

      logger.info('Refreshing tags for assets', {
        user: user.email,
        assetType,
        assetCount: assetIds.length,
      });

      let successful = 0;
      let failed = 0;

      // Normalize to singular form (e.g., "dashboards" to "dashboard")
      const singularType = getSingularForm(assetType) || assetType;

      // Process each asset
      for (const assetId of assetIds) {
        try {
          // Get current tags from QuickSight to refresh cache
          await this.tagService.getResourceTags(singularType as any, assetId);
          successful++;
        } catch (error) {
          logger.error(`Failed to refresh tags for ${assetType} ${assetId}:`, error);
          failed++;
        }
      }

      // Update cache if successful
      if (successful > 0) {
        try {
          const cacheServiceInstance = CacheService.getInstance();
          await cacheServiceInstance.clearMemoryCache();
        } catch (error) {
          logger.warn('Failed to update cache after tag refresh:', error);
        }
      }

      return successResponse(event, {
        success: true,
        data: {
          successful,
          failed,
          total: assetIds.length,
        },
      });
    } catch (error: any) {
      logger.error('Failed to refresh tags', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to refresh tags'
      );
    }
  }

  public async removeTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const { assetType, assetId } = event.pathParameters || {};
      const { tagKeys } = JSON.parse(event.body || '{}');

      if (!assetType || !assetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset type and ID are required');
      }

      if (!tagKeys || !Array.isArray(tagKeys)) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Tag keys array is required');
      }

      await this.tagService.removeResourceTags(assetType as any, assetId, tagKeys);

      return successResponse(event, {
        success: true,
        data: { message: 'Tags removed successfully' },
      });
    } catch (error: any) {
      logger.error('Remove tags failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  public async updateTags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const { assetType, assetId } = event.pathParameters || {};
      const { tags } = JSON.parse(event.body || '{}');

      if (!assetType || !assetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Asset type and ID are required');
      }

      if (!tags || !Array.isArray(tags)) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Tags array is required');
      }

      const convertedTags = tags.map((tag) => ({
        key: tag.Key || tag.key,
        value: tag.Value || tag.value,
      }));

      await this.tagService.updateResourceTags(assetType as AssetType, assetId, convertedTags);

      await cacheService.updateAssetTags(assetType as AssetType, assetId, convertedTags);

      logger.info(`Updated tags for ${assetType} ${assetId} in both QuickSight and cache`);

      return successResponse(event, {
        success: true,
        data: { message: 'Tags updated successfully' },
      });
    } catch (error: any) {
      logger.error('Update tags failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }
}
