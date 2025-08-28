import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { successResponse, errorResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { DemoCleanupService } from '../services/DemoCleanupService';

export class ScriptsHandler {
  private readonly demoCleanupService: DemoCleanupService;

  constructor(accountId: string) {
    this.demoCleanupService = new DemoCleanupService(accountId);
  }

  /**
   * Execute demo cleanup - delete and archive all demo assets
   */
  public async executeDemoCleanup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const result = await this.demoCleanupService.executeDemoCleanup();

      return successResponse(event, {
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Execute demo cleanup failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  /**
   * Preview demo assets that would be deleted
   */
  public async previewDemoCleanup(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const demoAssets = await this.demoCleanupService.findDemoAssets();

      return successResponse(event, {
        success: true,
        data: demoAssets,
      });
    } catch (error: any) {
      logger.error('Preview demo cleanup failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }
}
