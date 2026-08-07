/**
 * JobHandler - Shared handler for job management endpoints
 * Used by both export and deployment features
 */

import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../auth';
import { STATUS_CODES, PAGINATION } from '../constants';
import { S3Service } from '../services/aws/S3Service';
import { JobRepository, type JobType, type JobListOptions } from '../services/jobs/JobRepository';
import { successResponse, errorResponse } from '../utils/cors';
import { logger } from '../utils/logger';

export class JobHandler {
  private readonly repository: JobRepository;

  constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    const bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`;

    const s3Service = new S3Service(accountId);

    this.repository = new JobRepository(s3Service, bucketName);
  }

  /**
   * Delete a job
   * DELETE /api/jobs/:jobId
   */
  public async deleteJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const jobId = event.pathParameters?.jobId;
      if (!jobId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Job ID is required');
      }

      await this.repository.deleteJob(jobId);

      return successResponse(event, {
        success: true,
        message: 'Job deleted',
      });
    } catch (error: any) {
      logger.error('Failed to delete job', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to delete job'
      );
    }
  }

  /**
   * Get job details
   * GET /api/jobs/:jobId
   */
  public async getJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const jobId = event.pathParameters?.jobId;
      if (!jobId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Job ID is required');
      }

      const job = await this.repository.getJob(jobId);
      if (!job) {
        return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Job not found');
      }

      // No cache-clearing side effect needed here: cache reads are ETag-
      // revalidated against S3, so completed jobs' writes are visible on the
      // next read regardless of which Lambda instance serves it.

      return successResponse(event, {
        success: true,
        data: job,
      });
    } catch (error: any) {
      logger.error('Failed to get job', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to get job'
      );
    }
  }

  /**
   * Get job logs
   * GET /api/jobs/:jobId/logs
   */
  public async getJobLogs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const jobId = event.pathParameters?.jobId;
      if (!jobId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Job ID is required');
      }

      const logs = await this.repository.getJobLogs(jobId);

      return successResponse(event, {
        success: true,
        data: {
          jobId,
          logs,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get job logs', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to get job logs'
      );
    }
  }

  /**
   * Get job result
   * GET /api/jobs/:jobId/result
   */
  public async getJobResult(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const jobId = event.pathParameters?.jobId;
      if (!jobId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Job ID is required');
      }

      const result = await this.repository.getJobResult(jobId);
      if (!result) {
        return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Job result not found');
      }

      return successResponse(event, {
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to get job result', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to get job result'
      );
    }
  }

  /**
   * List jobs with optional filtering
   * GET /api/jobs?type=export&status=completed&limit=50
   */
  public async listJobs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const params = event.queryStringParameters || {};
      const options: JobListOptions = {
        jobType: params.type as JobType | undefined,
        status: params.status as any,
        limit: params.limit ? parseInt(params.limit, 10) : PAGINATION.DEFAULT_PAGE_SIZE,
      };

      // Parse date filters if provided
      if (params.afterDate) {
        options.afterDate = new Date(params.afterDate);
      }
      if (params.beforeDate) {
        options.beforeDate = new Date(params.beforeDate);
      }

      const jobs = await this.repository.listJobs(options);

      return successResponse(event, {
        success: true,
        data: jobs,
      });
    } catch (error: any) {
      logger.error('Failed to list jobs', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to list jobs'
      );
    }
  }

  /**
   * Stop a job
   * POST /api/jobs/:jobId/stop
   */
  public async stopJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const jobId = event.pathParameters?.jobId;
      if (!jobId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Job ID is required');
      }

      await this.repository.requestStop(jobId);

      return successResponse(event, {
        success: true,
        message: 'Stop request sent',
      });
    } catch (error: any) {
      logger.error('Failed to stop job', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to stop job'
      );
    }
  }
}
