/**
 * Filter bar templates over HTTP: list, create, update, delete.
 *
 * GET    /data-catalog/templates/filter-bars
 * POST   /data-catalog/templates/filter-bars
 * PUT    /data-catalog/templates/filter-bars/{templateId}
 * DELETE /data-catalog/templates/filter-bars/{templateId}
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import {
  FilterBarTemplateStore,
  validateFilterBarInput,
} from '../../../shared/services/templates/FilterBarTemplateStore';
import { errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

function fail(event: APIGatewayProxyEvent, error: any, fallback: string, status: number) {
  logger.error(fallback, { error });
  return errorResponse(event, error?.statusCode || status, error?.message || fallback);
}

export class FilterBarTemplateHandler {
  public constructor(private readonly store = new FilterBarTemplateStore()) {}

  public async list(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      return successResponse(event, {
        success: true,
        data: { templates: await this.store.list() },
      });
    } catch (error: any) {
      return fail(
        event,
        error,
        'Failed to list filter bar templates',
        STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async create(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const input = validateFilterBarInput(JSON.parse(event.body || '{}'));
      const template = await this.store.create(input, user.email ?? 'unknown');
      return successResponse(event, { success: true, data: template });
    } catch (error: any) {
      return fail(event, error, 'Failed to save the filter bar template', STATUS_CODES.BAD_REQUEST);
    }
  }

  public async update(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const id = event.pathParameters?.templateId || '';
      if (!id) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Template id is required');
      }
      const input = validateFilterBarInput(JSON.parse(event.body || '{}'));
      return successResponse(event, { success: true, data: await this.store.update(id, input) });
    } catch (error: any) {
      return fail(
        event,
        error,
        'Failed to update the filter bar template',
        STATUS_CODES.BAD_REQUEST
      );
    }
  }

  public async remove(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const id = event.pathParameters?.templateId || '';
      if (!id) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Template id is required');
      }
      await this.store.delete(id);
      return successResponse(event, { success: true });
    } catch (error: any) {
      return fail(
        event,
        error,
        'Failed to delete the filter bar template',
        STATUS_CODES.BAD_REQUEST
      );
    }
  }
}
