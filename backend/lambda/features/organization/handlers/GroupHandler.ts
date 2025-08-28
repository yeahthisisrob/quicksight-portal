import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { successResponse, errorResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { GroupService } from '../services/GroupService';

export class GroupHandler {
  private readonly groupService: GroupService;

  constructor() {
    this.groupService = new GroupService();
  }

  public async createGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const body = JSON.parse(event.body || '{}');
      const { groupName, description } = body;

      if (!groupName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Group name is required');
      }

      logger.info(`Creating group ${groupName}`, {
        groupName,
        description,
      });

      const result = await this.groupService.createGroup(groupName, description);

      return successResponse(event, result);
    } catch (error: any) {
      logger.error('Failed to create group', { error: error.message });
      return errorResponse(
        event,
        error.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  }

  public async deleteGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const auth = await requireAuth(event); // Validate authentication
      const pathMatch = event.path.match(new RegExp('/groups/([^/]+)$'));
      const groupName = pathMatch?.[1];

      if (!groupName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Group name is required');
      }

      const body = JSON.parse(event.body || '{}');
      const { reason } = body;

      logger.info(`Deleting group ${groupName}`, {
        groupName,
        reason,
        deletedBy: auth.userId,
      });

      const result = await this.groupService.deleteGroup(groupName, reason, auth.userId);

      return successResponse(event, result);
    } catch (error: any) {
      logger.error('Failed to delete group', { error: error.message });
      return errorResponse(
        event,
        error.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  }

  public async getGroupAssets(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      // Handle both /api/groups and /groups paths
      const pathMatch = event.path.match(/\/?(api\/)?groups\/([^/]+)\/assets/);
      const groupName = pathMatch?.[2];

      if (!groupName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Group name is required');
      }

      const assetType = event.queryStringParameters?.assetType;

      logger.info(`Getting assets for group ${groupName}`, {
        groupName,
        assetType,
      });

      const result = await this.groupService.getGroupAssets(groupName, assetType);

      return successResponse(event, result);
    } catch (error: any) {
      logger.error('Failed to get group assets', { error: error.message });
      return errorResponse(
        event,
        error.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  }

  public async updateGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const auth = await requireAuth(event); // Validate authentication
      const pathMatch = event.path.match(new RegExp('/groups/([^/]+)$'));
      const groupName = pathMatch?.[1];

      if (!groupName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Group name is required');
      }

      const body = JSON.parse(event.body || '{}');
      const { description } = body;

      if (description === undefined) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Description is required');
      }

      logger.info(`Updating group ${groupName}`, {
        groupName,
        description,
        updatedBy: auth.userId,
      });

      const result = await this.groupService.updateGroup(groupName, description);

      return successResponse(event, result);
    } catch (error: any) {
      logger.error('Failed to update group', { error: error.message });
      return errorResponse(
        event,
        error.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  }
}
