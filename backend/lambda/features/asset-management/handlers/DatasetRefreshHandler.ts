/**
 * Refresh a SPICE dataset now, and its refresh schedules: read live, made,
 * changed, removed. The schedules the export carries are refreshed after
 * every write, so the list and the Studio agree with QuickSight.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { cacheService } from '../../../shared/services/cache/CacheService';
import {
  DatasetRefreshService,
  type RefreshScheduleInput,
} from '../../../shared/services/ingestions/DatasetRefreshService';
import { createResponse, errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

function fail(event: APIGatewayProxyEvent, error: any, fallback: string): APIGatewayProxyResult {
  logger.error(fallback, { error });
  return errorResponse(
    event,
    error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
    error?.message || fallback
  );
}

function parseBody(event: APIGatewayProxyEvent): Record<string, any> {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function scheduleInputOf(body: Record<string, any>): RefreshScheduleInput {
  // The service checks every value; the shape here only names the fields.
  return {
    interval: body.interval as RefreshScheduleInput['interval'],
    refreshType: body.refreshType as RefreshScheduleInput['refreshType'],
    ...(typeof body.timeOfTheDay === 'string' ? { timeOfTheDay: body.timeOfTheDay } : {}),
    ...(typeof body.timezone === 'string' ? { timezone: body.timezone } : {}),
    ...(typeof body.dayOfWeek === 'string'
      ? { dayOfWeek: body.dayOfWeek as RefreshScheduleInput['dayOfWeek'] }
      : {}),
    ...(typeof body.dayOfMonth === 'string' ? { dayOfMonth: body.dayOfMonth } : {}),
    ...(typeof body.startAfterDateTime === 'string'
      ? { startAfterDateTime: body.startAfterDateTime }
      : {}),
  };
}

export class DatasetRefreshHandler {
  private readonly service: DatasetRefreshService;

  public constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.service = new DatasetRefreshService(
      ClientFactory.getQuickSightService(accountId),
      cacheService
    );
  }

  /** POST /ingestions/{datasetId} - refresh now. */
  public async refreshNow(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const datasetId = event.pathParameters?.datasetId ?? '';
      if (!datasetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Dataset id is required');
      }
      const body = parseBody(event);
      const ingestion = await this.service.refreshNow(datasetId, body.type ?? 'FULL_REFRESH', user);
      return createResponse(event, STATUS_CODES.CREATED, { success: true, data: ingestion });
    } catch (error: any) {
      return fail(event, error, 'The refresh could not be started');
    }
  }

  /** GET /assets/dataset/{assetId}/refresh-schedules */
  public async listSchedules(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const datasetId = event.pathParameters?.assetId ?? '';
      if (!datasetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Dataset id is required');
      }
      const schedules = await this.service.schedules(datasetId);
      return successResponse(event, { success: true, data: { schedules } });
    } catch (error: any) {
      return fail(event, error, 'The refresh schedules could not be read');
    }
  }

  /** POST /assets/dataset/{assetId}/refresh-schedules */
  public async createSchedule(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const datasetId = event.pathParameters?.assetId ?? '';
      if (!datasetId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Dataset id is required');
      }
      const schedule = await this.service.createSchedule(
        datasetId,
        scheduleInputOf(parseBody(event)),
        user
      );
      return createResponse(event, STATUS_CODES.CREATED, { success: true, data: schedule });
    } catch (error: any) {
      return fail(event, error, 'The refresh schedule could not be created');
    }
  }

  /** PUT /assets/dataset/{assetId}/refresh-schedules/{scheduleId} */
  public async updateSchedule(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const datasetId = event.pathParameters?.assetId ?? '';
      const scheduleId = event.pathParameters?.scheduleId ?? '';
      if (!datasetId || !scheduleId) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Dataset and schedule ids are required'
        );
      }
      const schedule = await this.service.updateSchedule(
        datasetId,
        scheduleId,
        scheduleInputOf(parseBody(event)),
        user
      );
      return successResponse(event, { success: true, data: schedule });
    } catch (error: any) {
      return fail(event, error, 'The refresh schedule could not be changed');
    }
  }

  /** DELETE /assets/dataset/{assetId}/refresh-schedules/{scheduleId} */
  public async deleteSchedule(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const datasetId = event.pathParameters?.assetId ?? '';
      const scheduleId = event.pathParameters?.scheduleId ?? '';
      if (!datasetId || !scheduleId) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'Dataset and schedule ids are required'
        );
      }
      await this.service.deleteSchedule(datasetId, scheduleId, user);
      return successResponse(event, { success: true, data: { scheduleId } });
    } catch (error: any) {
      return fail(event, error, 'The refresh schedule could not be removed');
    }
  }
}
