/**
 * A template library over HTTP: list, create, update, delete. One handler
 * per kind (filter bars, visuals), each with its own store and validation.
 *
 * GET    /data-catalog/templates/{kind}
 * POST   /data-catalog/templates/{kind}
 * PUT    /data-catalog/templates/{kind}/{templateId}
 * DELETE /data-catalog/templates/{kind}/{templateId}
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import type { TemplateMeta, TemplateStore } from '../../../shared/services/templates/TemplateStore';
import { errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

export class TemplateLibraryHandler<T extends TemplateMeta, Input extends { name: string }> {
  public constructor(
    private readonly store: TemplateStore<T, Input>,
    private readonly validate: (raw: unknown) => Input,
    /** For messages: "filter bar", "visual template". */
    private readonly noun: string
  ) {}

  public async list(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      return successResponse(event, {
        success: true,
        data: { templates: await this.store.list() },
      });
    } catch (error: any) {
      return this.fail(
        event,
        error,
        `Failed to list the ${this.noun}s`,
        STATUS_CODES.INTERNAL_SERVER_ERROR
      );
    }
  }

  public async create(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const input = this.validate(JSON.parse(event.body || '{}'));
      return successResponse(event, {
        success: true,
        data: await this.store.create(input, user.email ?? 'unknown'),
      });
    } catch (error: any) {
      return this.fail(event, error, `Failed to save the ${this.noun}`, STATUS_CODES.BAD_REQUEST);
    }
  }

  public async update(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const id = event.pathParameters?.templateId || '';
      if (!id) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Template id is required');
      }
      const input = this.validate(JSON.parse(event.body || '{}'));
      return successResponse(event, { success: true, data: await this.store.update(id, input) });
    } catch (error: any) {
      return this.fail(event, error, `Failed to update the ${this.noun}`, STATUS_CODES.BAD_REQUEST);
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
      return this.fail(event, error, `Failed to delete the ${this.noun}`, STATUS_CODES.BAD_REQUEST);
    }
  }

  private fail(event: APIGatewayProxyEvent, error: any, fallback: string, status: number) {
    logger.error(fallback, { error });
    return errorResponse(event, error?.statusCode || status, error?.message || fallback);
  }
}
