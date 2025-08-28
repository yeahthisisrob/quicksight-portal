import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { JobHandler } from '../../../shared/handlers/JobHandler';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { jobFactory, type ExportJobConfig } from '../../../shared/services/jobs/JobFactory';
import { createResponse, successResponse, errorResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

export class ExportHandler {
  private readonly bucketName: string;
  private readonly jobHandler: JobHandler;

  constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`;

    this.jobHandler = new JobHandler();
  }

  public async exportAssets(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const auth = await requireAuth(event);
      const {
        forceRefresh = false,
        rebuildIndex = false,
        exportIngestions = false,
        assetTypes,
        exportOrganizational = false,
        refreshOptions,
      } = JSON.parse(event.body || '{}');

      const accountId = process.env.AWS_ACCOUNT_ID || '';

      // If exportOrganizational is true, set assetTypes to organizational types
      const finalAssetTypes = exportOrganizational ? ['group', 'folder', 'user'] : assetTypes;

      const jobConfig: ExportJobConfig = {
        jobType: 'export',
        accountId,
        bucketName: this.bucketName,
        userId: auth.userId,
        options: {
          forceRefresh,
          rebuildIndex,
          exportIngestions,
          assetTypes: finalAssetTypes,
          refreshOptions,
        },
      };

      const result = await jobFactory.createJob(jobConfig);

      return createResponse(event, STATUS_CODES.ACCEPTED, {
        success: true,
        data: {
          jobId: result.jobId,
          status: result.status,
          message: 'Export job queued successfully. Poll status endpoint for updates.',
        },
      });
    } catch (error: any) {
      logger.error('Asset export failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Export failed'
      );
    }
  }

  public async getExportSummary(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const exportSummary = await cacheService.getExportSummary();

      return successResponse(event, { success: true, data: exportSummary });
    } catch (error: any) {
      logger.error('Failed to get export summary', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to get export summary'
      );
    }
  }

  /**
   * Get export job logs
   * GET /export/jobs/{jobId}/logs
   */
  public getJobLogs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // Delegate to shared job handler
    return this.jobHandler.getJobLogs(event);
  }

  /**
   * Get export job status
   * GET /export/jobs/{jobId}
   */
  public getJobStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // Delegate to shared job handler
    return this.jobHandler.getJob(event);
  }

  /**
   * List recent export jobs
   * GET /export/jobs
   */
  public listJobs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    // Add type=export to query parameters for export-specific filtering
    if (!event.queryStringParameters) {
      event.queryStringParameters = {};
    }
    event.queryStringParameters.type = 'export';

    return this.jobHandler.listJobs(event);
  }

  /**
   * Stop an export job
   * POST /export/jobs/{jobId}/stop
   */
  public stopJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    return this.jobHandler.stopJob(event);
  }
}
