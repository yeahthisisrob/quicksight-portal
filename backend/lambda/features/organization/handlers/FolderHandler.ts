import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { BulkOperationsService } from '../../../shared/services/bulk/BulkOperationsService';
import { successResponse, errorResponse, createResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { FolderService } from '../services/FolderService';

export class FolderHandler {
  private readonly bulkOperationsService: BulkOperationsService;
  private readonly folderService: FolderService;

  constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.folderService = new FolderService(accountId);
    this.bulkOperationsService = new BulkOperationsService(accountId);
  }

  public async addMember(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { id: folderId } = event.pathParameters || {};
      const body = JSON.parse(event.body || '{}');
      const { memberId, memberType, role } = body;

      logger.info('Add member request', {
        folderId,
        body,
        memberId,
        memberType,
        role,
        pathParameters: event.pathParameters,
      });

      if (!folderId || !memberId || !memberType) {
        logger.error('Missing required fields', { folderId, memberId, memberType });
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Missing required fields');
      }

      // Check if memberType is an asset type (DASHBOARD, ANALYSIS, DATASET, DATASOURCE)
      if (['DASHBOARD', 'ANALYSIS', 'DATASET', 'DATASOURCE'].includes(memberType)) {
        await this.folderService.addAssetToFolder(folderId, memberId, memberType);
      } else {
        // For USER or GROUP, require role
        if (!role) {
          return errorResponse(
            event,
            STATUS_CODES.BAD_REQUEST,
            'Missing required role for user/group'
          );
        }
        await this.folderService.addMember(folderId, memberId, memberType, role);
      }

      return successResponse(event, {
        success: true,
        data: { message: 'Member added successfully' },
      });
    } catch (error: any) {
      logger.error('Add folder member failed', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async bulkAddAssetsToFolder(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event); // Validate authentication
      const { id: folderId } = event.pathParameters || {};
      const { assets } = JSON.parse(event.body || '{}');

      if (!folderId || !assets || !Array.isArray(assets)) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Folder ID and assets array are required'
        );
      }

      // Validate asset structure
      for (const asset of assets) {
        if (!asset.type || !asset.id) {
          return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Each asset must have type and id');
        }
      }

      // Always use job queue for bulk operations
      const result = await this.bulkOperationsService.bulkAddToFolders(
        assets,
        [folderId],
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
      logger.error('Bulk add assets to folder failed', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async bulkRemoveAssetsFromFolder(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event); // Validate authentication
      const { id: folderId } = event.pathParameters || {};
      const { assets } = JSON.parse(event.body || '{}');

      if (!folderId || !assets || !Array.isArray(assets)) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Folder ID and assets array are required'
        );
      }

      // Validate asset structure
      for (const asset of assets) {
        if (!asset.type || !asset.id) {
          return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Each asset must have type and id');
        }
      }

      // Always use job queue for bulk operations
      const result = await this.bulkOperationsService.bulkRemoveFromFolders(
        assets,
        [folderId],
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
      logger.error('Bulk remove assets from folder failed', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async get(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { id: folderId } = event.pathParameters || {};

      if (!folderId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Folder ID is required');
      }

      const folder = await this.folderService.get(folderId);
      return successResponse(event, { success: true, data: folder });
    } catch (error: any) {
      logger.error('Get folder failed', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async getMembers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { id: folderId } = event.pathParameters || {};

      if (!folderId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Folder ID is required');
      }

      const members = await this.folderService.getMembers(folderId);
      return successResponse(event, { success: true, data: members });
    } catch (error: any) {
      logger.error('Get folder members failed', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async list(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const folders = await this.folderService.list();
      return successResponse(event, { success: true, data: folders });
    } catch (error: any) {
      logger.error('List folders failed', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, error.message);
    }
  }

  public async removeMember(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { id: folderId, memberId } = event.pathParameters || {};
      const memberType = event.queryStringParameters?.type;

      if (!folderId || !memberId || !memberType) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Missing required parameters');
      }

      // Check if memberType is an asset type (DASHBOARD, ANALYSIS, DATASET, DATASOURCE)
      if (['DASHBOARD', 'ANALYSIS', 'DATASET', 'DATASOURCE'].includes(memberType)) {
        await this.folderService.removeAssetFromFolder(
          folderId,
          memberId,
          memberType as 'DASHBOARD' | 'ANALYSIS' | 'DATASET' | 'DATASOURCE'
        );
      } else {
        // For USER or GROUP
        await this.folderService.removeMember(folderId, memberId, memberType as 'USER' | 'GROUP');
      }

      return successResponse(event, {
        success: true,
        data: { message: 'Member removed successfully' },
      });
    } catch (error: any) {
      logger.error('Remove folder member failed', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, error.message);
    }
  }
}
