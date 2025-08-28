import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { BulkOperationsService } from '../../../shared/services/bulk/BulkOperationsService';
import { successResponse, errorResponse, createResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { IdentityService } from '../services/IdentityService';

export class IdentityHandler {
  private readonly bulkOperationsService: BulkOperationsService;
  private readonly identityService: IdentityService;

  constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.identityService = new IdentityService(accountId);
    this.bulkOperationsService = new BulkOperationsService(accountId);
  }

  public async addUsersToGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event); // Validate authentication

      // Extract groupName from the path
      const pathMatch = event.path.match(/\/groups\/([^/]+)\/members/);
      const groupName = pathMatch ? pathMatch[1] : undefined;

      const { userNames } = JSON.parse(event.body || '{}');

      if (!groupName || !userNames || !Array.isArray(userNames)) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Group name and user names array are required'
        );
      }

      // Always use job queue for bulk operations
      const result = await this.bulkOperationsService.bulkAddUsersToGroups(
        userNames,
        [decodeURIComponent(groupName)],
        user.email || user.userId || 'unknown'
      );

      return createResponse(event, STATUS_CODES.ACCEPTED, {
        success: true,
        jobId: result.jobId,
        status: result.status,
        message: result.message,
        estimatedOperations: result.estimatedOperations,
      });
    } catch (error) {
      logger.error('Add users to group failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to add users to group'
      );
    }
  }

  public async addUserToGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { groupName } = event.pathParameters || {};
      const { userName } = JSON.parse(event.body || '{}');

      if (!groupName || !userName) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Group name and user name are required'
        );
      }

      await this.identityService.addUserToGroup(userName, decodeURIComponent(groupName));

      return successResponse(event, {
        success: true,
        message: 'User added to group successfully',
      });
    } catch (error) {
      logger.error('Add user to group failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to add user to group'
      );
    }
  }

  public async getGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { groupName } = event.pathParameters || {};

      if (!groupName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Group name is required');
      }

      const group = await this.identityService.getGroup(decodeURIComponent(groupName));

      return successResponse(event, {
        success: true,
        data: group,
      });
    } catch (error) {
      logger.error('Get group failed', { error });

      if ((error as any).name === 'ResourceNotFoundException') {
        return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Group not found');
      }

      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to get group');
    }
  }

  public async getGroupMembers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { groupName } = event.pathParameters || {};

      if (!groupName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Group name is required');
      }

      const members = await this.identityService.getGroupMembers(decodeURIComponent(groupName));

      return successResponse(event, {
        success: true,
        data: members,
      });
    } catch (error) {
      logger.error('Get group members failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to get group members'
      );
    }
  }

  public async getIdentity(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const authContext = await requireAuth(event);

      const stsClient = new STSClient({ region: process.env.AWS_REGION });
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));

      return successResponse(event, {
        success: true,
        data: {
          accountId: identity.Account,
          userId: identity.UserId,
          arn: identity.Arn,
          region: process.env.AWS_REGION,
          user: {
            id: authContext.userId,
            email: authContext.email,
            groups: authContext.groups,
          },
        },
      });
    } catch (error) {
      logger.error('Get identity failed', { error });
      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to get identity');
    }
  }

  public async getUser(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { userName } = event.pathParameters || {};

      if (!userName) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'User name is required');
      }

      const user = await this.identityService.getUser(decodeURIComponent(userName));

      return successResponse(event, {
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Get user failed', { error });

      if ((error as any).name === 'ResourceNotFoundException') {
        return errorResponse(event, STATUS_CODES.NOT_FOUND, 'User not found');
      }

      return errorResponse(event, STATUS_CODES.INTERNAL_SERVER_ERROR, 'Failed to get user');
    }
  }

  public async removeUserFromGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event); // Validate authentication
      const { groupName, userName } = event.pathParameters || {};

      if (!groupName || !userName) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Group name and user name are required'
        );
      }

      await this.identityService.removeUserFromGroup(
        decodeURIComponent(userName),
        decodeURIComponent(groupName)
      );

      return successResponse(event, {
        success: true,
        message: 'User removed from group successfully',
      });
    } catch (error) {
      logger.error('Remove user from group failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to remove user from group'
      );
    }
  }

  public async removeUsersFromGroup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event); // Validate authentication

      // Extract groupName from the path
      const pathMatch = event.path.match(/\/groups\/([^/]+)\/members/);
      const groupName = pathMatch ? pathMatch[1] : undefined;

      const { userNames } = JSON.parse(event.body || '{}');

      if (!groupName || !userNames || !Array.isArray(userNames)) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Group name and user names array are required'
        );
      }

      // Always use job queue for bulk operations
      const result = await this.bulkOperationsService.bulkRemoveUsersFromGroups(
        userNames,
        [decodeURIComponent(groupName)],
        user.email || user.userId || 'unknown'
      );

      return createResponse(event, STATUS_CODES.ACCEPTED, {
        success: true,
        jobId: result.jobId,
        status: result.status,
        message: result.message,
        estimatedOperations: result.estimatedOperations,
      });
    } catch (error) {
      logger.error('Remove users from group failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        'Failed to remove users from group'
      );
    }
  }
}
