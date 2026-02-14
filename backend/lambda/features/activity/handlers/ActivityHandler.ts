import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';
import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { CloudTrailAdapter } from '../../../adapters/aws/CloudTrailAdapter';
import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants/httpStatusCodes';
import { ACTIVITY_LIMITS } from '../../../shared/constants/limits';
import { CacheService } from '../../../shared/services/cache/CacheService';
import {
  jobFactory,
  type ActivityRefreshJobConfig,
} from '../../../shared/services/jobs/JobFactory';
import { createResponse, successResponse, errorResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { GroupService } from '../../organization/services/GroupService';
import { ActivityService } from '../services/ActivityService';
import { type ActivityRefreshRequest } from '../types';

// Initialize services
let activityService: ActivityService;

function getActivityService(): ActivityService {
  if (!activityService) {
    const region = process.env.AWS_REGION || 'us-east-1';

    const cacheService = CacheService.getInstance();
    const cloudTrailClient = new CloudTrailClient({ region });
    const cloudTrailAdapter = new CloudTrailAdapter(cloudTrailClient, region);
    const groupService = new GroupService();

    activityService = new ActivityService(cacheService, cloudTrailAdapter, groupService);
  }

  return activityService;
}

/**
 * Refresh activity data - creates a background job to avoid timeouts
 * POST /api/activity/refresh
 */
export async function refreshActivity(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Validate auth
    const authUser = await requireAuth(event);

    // Parse request body
    const body = JSON.parse(event.body || '{}') as ActivityRefreshRequest;

    if (!body.assetTypes || !Array.isArray(body.assetTypes) || body.assetTypes.length === 0) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        'Invalid request: assetTypes array is required'
      );
    }

    logger.info('Creating activity refresh job', {
      assetTypes: body.assetTypes,
      days: body.days,
      user: authUser,
    });

    const accountId = process.env.AWS_ACCOUNT_ID || '';
    const bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`;

    // Create job configuration
    const jobConfig: ActivityRefreshJobConfig = {
      jobType: 'activity-refresh',
      accountId,
      bucketName,
      userId: authUser.userId,
      options: {
        assetTypes: body.assetTypes,
        days: body.days,
      },
    };

    // Create the job
    const result = await jobFactory.createJob(jobConfig);

    // Return 202 Accepted with job details
    return createResponse(event, STATUS_CODES.ACCEPTED, {
      success: true,
      data: {
        jobId: result.jobId,
        status: result.status,
        message: 'Activity refresh job queued successfully. Poll status endpoint for updates.',
      },
    });
  } catch (error: any) {
    logger.error('Failed to create activity refresh job', { error });
    return errorResponse(
      event,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      error.message || 'Internal server error'
    );
  }
}

/**
 * Get activity data for a specific asset
 * GET /api/activity/{assetType}/{assetId}
 */
export async function getActivityData(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Validate auth
    const authUser = requireAuth(event);

    // Extract path parameters
    const assetType = event.pathParameters?.assetType as 'dashboard' | 'analysis' | 'user';
    const assetId = event.pathParameters?.assetId;

    if (!assetType || !assetId) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        'Invalid request: assetType and assetId are required'
      );
    }

    if (!['dashboard', 'analysis', 'user'].includes(assetType)) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        'Invalid assetType. Must be dashboard, analysis, or user'
      );
    }

    logger.info('Getting activity data', { assetType, assetId, user: authUser });

    const service = getActivityService();
    const data =
      assetType === 'user'
        ? await service.getUserActivity(assetId)
        : await service.getAssetActivity(assetType as 'dashboard' | 'analysis', assetId);

    if (!data) {
      return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Activity data not found');
    }

    return successResponse(event, { success: true, data });
  } catch (error: any) {
    logger.error('Failed to get activity data', { error });
    return errorResponse(
      event,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      error.message || 'Internal server error'
    );
  }
}

/**
 * Get activity summary
 * GET /api/activity/summary
 */
export async function getActivitySummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Validate auth
    const authUser = requireAuth(event);

    // Extract query parameters
    const days = parseInt(event.queryStringParameters?.days || '30');

    if (isNaN(days) || days < 1 || days > ACTIVITY_LIMITS.MAX_ACTIVITY_DAYS) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        `Invalid days parameter. Must be between 1 and ${ACTIVITY_LIMITS.MAX_ACTIVITY_DAYS}`
      );
    }

    logger.info('Getting activity summary', { days, user: authUser });

    const service = getActivityService();
    const summary = await service.getActivitySummary();

    return successResponse(event, { success: true, data: summary });
  } catch (error: any) {
    logger.error('Failed to get activity summary', { error });
    return errorResponse(
      event,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      error.message || 'Internal server error'
    );
  }
}

/**
 * Resolve asset permissions into recipient emails for mailto composition.
 * Reads permissions from cache, resolves users/groups to emails from cached data.
 * POST /api/activity/recipients
 */
export async function resolveRecipients(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAuth(event);

    const body = JSON.parse(event.body || '{}');
    const { assetType, assetId } = body;

    if (!assetType || !assetId || !['dashboard', 'analysis'].includes(assetType)) {
      return errorResponse(
        event,
        STATUS_CODES.BAD_REQUEST,
        'Invalid request: assetType (dashboard|analysis) and assetId are required'
      );
    }

    const cacheService = CacheService.getInstance();

    // Get asset from cache (includes permissions)
    const asset = await cacheService.getAsset(assetType, assetId);
    if (!asset) {
      return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Asset not found in cache');
    }

    const permissions: Array<{ principal: string; principalType: string }> =
      asset.permissions || [];

    if (permissions.length === 0) {
      return successResponse(event, { success: true, data: { users: [], groups: [] } });
    }

    const users: Array<{ userName: string; email: string }> = [];
    const groups: Array<{
      groupName: string;
      members: Array<{ userName: string; email: string }>;
    }> = [];

    // Resolve a username to email from cached user data
    const resolveUserEmail = async (
      userName: string
    ): Promise<{ userName: string; email: string } | null> => {
      try {
        const userAsset = await cacheService.getAsset('user', userName);
        if (userAsset?.metadata?.email) {
          return { userName: userAsset.name || userName, email: userAsset.metadata.email };
        }
        return null;
      } catch {
        return null;
      }
    };

    await Promise.all(
      permissions.map(async (permission) => {
        const name = permission.principal.split('/').pop();
        if (!name) {
          return;
        }

        if (permission.principalType === 'USER') {
          const resolved = await resolveUserEmail(name);
          if (resolved) {
            users.push(resolved);
          }
        } else if (permission.principalType === 'GROUP') {
          try {
            // Get group from cache — members are in metadata.members
            const groupAsset = await cacheService.getAsset('group', name);
            const memberList: Array<{ MemberName?: string; memberName?: string }> =
              groupAsset?.metadata?.members || [];

            const members: Array<{ userName: string; email: string }> = [];
            await Promise.all(
              memberList.map(async (member) => {
                const memberName = member.MemberName || member.memberName;
                if (!memberName) {
                  return;
                }
                const resolved = await resolveUserEmail(memberName);
                if (resolved) {
                  members.push(resolved);
                }
              })
            );
            groups.push({ groupName: name, members });
          } catch (error) {
            logger.warn(`Failed to resolve group ${name}`, { error });
          }
        }
      })
    );

    return successResponse(event, { success: true, data: { users, groups } });
  } catch (error: any) {
    logger.error('Failed to resolve recipients', { error });
    return errorResponse(
      event,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      error.message || 'Internal server error'
    );
  }
}
