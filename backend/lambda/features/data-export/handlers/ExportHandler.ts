import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES } from '../../../shared/constants';
import { JobHandler } from '../../../shared/handlers/JobHandler';
import { S3Service } from '../../../shared/services/aws/S3Service';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { jobFactory, type ExportJobConfig } from '../../../shared/services/jobs/JobFactory';
import { JobStateService } from '../../../shared/services/jobs/JobStateService';
import { createResponse, successResponse, errorResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';

export class ExportHandler {
  private readonly bucketName: string;
  private readonly jobHandler: JobHandler;
  private readonly jobStateService: JobStateService;

  constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`;

    this.jobHandler = new JobHandler();
    this.jobStateService = new JobStateService(new S3Service(accountId), this.bucketName, 'export');
  }

  public async exportAssets(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      const auth = await requireAuth(event);
      const {
        forceRefresh = false,
        rebuildIndex = false,
        assetTypes,
        exportOrganizational = false,
        refreshOptions,
      } = JSON.parse(event.body || '{}');

      const accountId = process.env.AWS_ACCOUNT_ID || '';

      // Only one export may run at a time (any mode - smart sync, force
      // refresh, cache rebuild, permissions, tags). Reading the job list also
      // auto-fails dead jobs (repairDeadJobs), so a crashed export can never
      // wedge this guard.
      const activeExports = await this.jobStateService.getActiveJobs();
      const running = activeExports.filter((job) => job.jobType === 'export');
      if (running.length > 0 && running[0]) {
        return createResponse(event, STATUS_CODES.CONFLICT, {
          success: false,
          error: 'An export job is already running. Wait for it to finish or stop it first.',
          data: { activeJobId: running[0].jobId },
        });
      }

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
