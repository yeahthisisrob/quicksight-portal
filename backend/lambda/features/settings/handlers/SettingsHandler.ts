import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { DataZoneAdapter } from '../../../adapters/aws/DataZoneAdapter';
import { requireAuth, requireUser } from '../../../shared/auth';
import { getSmusConfig } from '../../../shared/config/smusConfig';
import { STATUS_CODES } from '../../../shared/constants';
import { apiKeyStore } from '../../../shared/services/auth/ApiKeyStore';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import { SmusService } from '../../../shared/services/smus/SmusService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { createResponse, errorResponse, successResponse } from '../../../shared/utils/cors';
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
        return successResponse(event, {
          success: true,
          data: { configured: false, projects: [], exportedAt: null },
        });
      }
      const service = new SmusService(CacheService.getInstance(), config);
      const { projects, diagnostics, exportedAt } = await service.projectDiscovery(
        new DataZoneAdapter(config.region)
      );
      return successResponse(event, {
        success: true,
        data: { configured: true, projects, diagnostics, exportedAt },
      });
    } catch (error: any) {
      logger.error('List SMUS projects failed', { error });
      return errorResponse(
        event,
        error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error?.message || 'Failed to list SMUS projects'
      );
    }
  }

  /**
   * GET /settings/quicksight/folders - the folders authored assets can be
   * filed in, from the export cache, with the number of people or groups
   * each is shared with.
   */
  public async listFolders(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const entries = await CacheService.getInstance().getCacheEntries({
        assetType: 'folder',
        statusFilter: AssetStatusFilter.ACTIVE,
      });
      const folders = entries
        .map((f: any) => ({
          id: String(f.assetId),
          name: String(f.assetName ?? f.assetId),
          sharedWith: Array.isArray(f.permissions) ? f.permissions.length : 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return successResponse(event, { success: true, data: { folders } });
    } catch (error: any) {
      logger.error('List folders failed', { error });
      return errorResponse(
        event,
        error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error?.message || 'Failed to list folders'
      );
    }
  }

  /** GET /settings/api-keys */
  public async listApiKeys(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireUser(event);
      return successResponse(event, { success: true, data: { keys: await apiKeyStore.list() } });
    } catch (error: any) {
      logger.error('List API keys failed', { error });
      return errorResponse(
        event,
        error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error?.message || 'Failed to list API keys'
      );
    }
  }

  /** POST /settings/api-keys  body: { label } - the secret is in this response only. */
  public async createApiKey(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const user = await requireUser(event);
      const body = JSON.parse(event.body || '{}');
      if (typeof body.label !== 'string' || !body.label.trim()) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'A label is required');
      }
      const created = await apiKeyStore.create(body.label, user.email || user.userId);
      logger.info('API key created', { id: created.key.id, label: created.key.label });
      return createResponse(event, STATUS_CODES.CREATED, { success: true, data: created });
    } catch (error: any) {
      logger.error('Create API key failed', { error });
      return errorResponse(
        event,
        error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error?.message || 'Failed to create the API key'
      );
    }
  }

  /** DELETE /settings/api-keys/{id} */
  public async revokeApiKey(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireUser(event);
      const id = event.pathParameters?.id || '';
      if (!id) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Key id is required');
      }
      await apiKeyStore.revoke(id);
      logger.info('API key revoked', { id });
      return successResponse(event, { success: true, data: { id } });
    } catch (error: any) {
      logger.error('Revoke API key failed', { error });
      return errorResponse(
        event,
        error?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR,
        error?.message || 'Failed to revoke the API key'
      );
    }
  }
}
