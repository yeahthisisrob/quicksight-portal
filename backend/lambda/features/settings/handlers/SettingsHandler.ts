import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { DataZoneAdapter } from '../../../adapters/aws/DataZoneAdapter';
import { requireAuth } from '../../../shared/auth';
import { getSmusConfig } from '../../../shared/config/smusConfig';
import { STATUS_CODES } from '../../../shared/constants';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import { errorResponse, successResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

export class SettingsHandler {
  /** GET /settings */
  public async get(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      await settingsStore.load(true);
      return successResponse(event, { success: true, data: settingsStore.snapshot() });
    } catch (error: any) {
      logger.error('Get settings failed', { error });
      return errorResponse(
        event,
        error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error?.message || 'Failed to load settings'
      );
    }
  }

  /** PUT /settings */
  public async update(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireAuth(event);
      const body = JSON.parse(event.body || '{}');
      const values = body?.values;
      if (typeof values !== 'object' || values === null || Array.isArray(values)) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'values must be an object');
      }
      const snapshot = await settingsStore.save(values, user.email ?? 'unknown');
      return successResponse(event, { success: true, data: snapshot });
    } catch (error: any) {
      logger.error('Update settings failed', { error });
      return errorResponse(
        event,
        error?.statusCode || STATUS_CODES.BAD_REQUEST,
        error?.message || 'Failed to save settings'
      );
    }
  }

  /** GET /settings/smus/projects */
  public async listSmusProjects(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const config = getSmusConfig();
      if (!config.enabled) {
        return successResponse(event, { success: true, data: { configured: false, projects: [] } });
      }
      const projects = await new DataZoneAdapter(config.region).listProjects(config.domainId);
      return successResponse(event, { success: true, data: { configured: true, projects } });
    } catch (error: any) {
      logger.error('List SMUS projects failed', { error });
      return errorResponse(
        event,
        error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error?.message || 'Failed to list SMUS projects'
      );
    }
  }
}
