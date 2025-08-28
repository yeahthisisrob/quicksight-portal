import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';

import { requireAuth } from '../../../shared/auth';
import { STATUS_CODES, PAGINATION } from '../../../shared/constants';
import { type AssetType } from '../../../shared/models/asset.model';
import { S3Service } from '../../../shared/services/aws/S3Service';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { jobFactory, type DeployJobConfig } from '../../../shared/services/jobs/JobFactory';
import { JobStateService } from '../../../shared/services/jobs/JobStateService';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import { successResponse, errorResponse, createResponse } from '../../../shared/utils/cors';
import { logger } from '../../../shared/utils/logger';
import { DeployService } from '../services/deploy/DeployService';
import { type DeploymentConfig } from '../services/deploy/types';

export class DeploymentHandler {
  private readonly accountId: string;
  private readonly bucketName: string;
  private readonly deployService: DeployService;
  private readonly jobStateService: JobStateService;
  private readonly s3Service: S3Service;

  constructor() {
    this.accountId = process.env.AWS_ACCOUNT_ID || '';
    this.bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${this.accountId}`;

    this.s3Service = new S3Service(this.accountId);

    const cacheService = CacheService.getInstance();
    this.deployService = new DeployService(
      this.s3Service,
      cacheService,
      this.bucketName,
      this.accountId,
      process.env.AWS_REGION || 'us-east-1'
    );

    // Pass 'deploy' as job type
    this.jobStateService = new JobStateService(this.s3Service, this.bucketName, 'deploy');
  }

  /**
   * Deploy an asset (restore from archive, etc.)
   * POST /api/deployments
   */
  public async deployAsset(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    logger.info('Starting asset deployment', {
      requestId: event.requestContext?.requestId,
    });

    try {
      const auth = await requireAuth(event);
      const user = auth;

      const body = JSON.parse(event.body || '{}');
      const { assetType, assetId, deploymentConfig } = body;

      if (!assetType || !assetId || !deploymentConfig) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'assetType, assetId, and deploymentConfig are required'
        );
      }

      if (!Object.values(ASSET_TYPES).includes(assetType)) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, `Invalid asset type: ${assetType}`);
      }

      if (!deploymentConfig.deploymentType || !deploymentConfig.source) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'deploymentType and source are required in deploymentConfig'
        );
      }

      // Always use async job processing for consistency
      const jobConfig: DeployJobConfig = {
        jobType: 'deploy',
        accountId: this.accountId,
        bucketName: this.bucketName,
        assetType,
        assetId,
        deploymentConfig: deploymentConfig as DeploymentConfig,
        userId: user.userId || user.email || 'unknown',
      };

      const result = await jobFactory.createJob(jobConfig);

      // Use createResponse for consistent CORS handling and 202 Accepted status
      return createResponse(event, STATUS_CODES.ACCEPTED, {
        success: true,
        data: {
          jobId: result.jobId,
          status: result.status,
          message: result.message,
        },
      });
    } catch (error: any) {
      logger.error('Asset deployment failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  /**
   * Get deployment history
   * GET /api/deployments/history
   */
  public async getDeploymentHistory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const params = event.queryStringParameters || {};
      const limit = params.limit ? parseInt(params.limit, 10) : PAGINATION.DEFAULT_PAGE_SIZE;
      const assetType = params.assetType as AssetType | undefined;
      const assetId = params.assetId;

      const history = this.deployService.getDeploymentHistory(limit);

      let filteredHistory = history;
      if (assetType || assetId) {
        filteredHistory = history.filter((deployment) => {
          const matchesType = !assetType || deployment.assetType === assetType;
          const matchesId =
            !assetId || deployment.sourceId === assetId || deployment.targetId === assetId;
          return matchesType && matchesId;
        });
      }

      return successResponse(event, {
        success: true,
        data: filteredHistory,
      });
    } catch (error: any) {
      logger.error('Get deployment history failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  /**
   * Get deployment job status
   * GET /api/deployments/jobs/:jobId
   */
  public async getJobStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const jobId = event.pathParameters?.jobId;

      if (!jobId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Job ID is required');
      }

      const status = await this.jobStateService.getJobStatus(jobId);

      if (!status) {
        return errorResponse(event, STATUS_CODES.NOT_FOUND, 'Job not found');
      }

      return successResponse(event, status);
    } catch (error: any) {
      logger.error('Get job status failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  /**
   * Get deployment manifest templates
   * GET /api/deployments/templates
   */
  public async getManifestTemplates(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const templates = [
        {
          name: 'dashboard-migration',
          description: 'Migrate dashboards between environments',
          manifest: {
            name: 'Dashboard Migration',
            version: '1.0.0',
            deployments: [
              {
                assetType: 'dashboard',
                assetId: '${DASHBOARD_ID}',
                config: {
                  deploymentType: 'restore',
                  source: 'archive',
                  target: {
                    environment: '${TARGET_ENV}',
                  },
                  options: {
                    updateDataSources: true,
                    preservePermissions: false,
                  },
                },
              },
            ],
            options: {
              stopOnError: true,
              parallel: false,
              rollbackOnError: true,
            },
          },
        },
        {
          name: 'full-restore',
          description: 'Restore all archived assets',
          manifest: {
            name: 'Full Restore',
            version: '1.0.0',
            deployments: [],
            options: {
              stopOnError: false,
              parallel: true,
              rollbackOnError: false,
            },
          },
        },
      ];

      return successResponse(event, {
        success: true,
        data: templates,
      });
    } catch (error: any) {
      logger.error('Get manifest templates failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  /**
   * Stop a deployment job
   * POST /api/deployments/jobs/:jobId/stop
   */
  public async stopJob(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);
      const jobId = event.pathParameters?.jobId;

      if (!jobId) {
        return errorResponse(event, STATUS_CODES.BAD_REQUEST, 'Job ID is required');
      }

      await this.jobStateService.requestStop(jobId);

      return successResponse(event, {
        success: true,
        message: 'Stop request sent',
      });
    } catch (error: any) {
      logger.error('Stop job failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }

  /**
   * Validate deployment configuration
   * POST /api/deployments/validate
   */
  public async validateDeployment(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
      await requireAuth(event);

      const body = JSON.parse(event.body || '{}');
      const { assetType, assetId, deploymentConfig } = body;

      if (!assetType || !assetId || !deploymentConfig) {
        return errorResponse(
          event,
          STATUS_CODES.BAD_REQUEST,
          'assetType, assetId, and deploymentConfig are required'
        );
      }

      const validationConfig: DeploymentConfig = {
        ...deploymentConfig,
        options: {
          ...(deploymentConfig.options || {}),
          validateOnly: true,
        },
        validation: deploymentConfig.validation,
      };

      logger.info('Starting deployment validation', {
        assetType,
        assetId,
        deploymentType: deploymentConfig.deploymentType,
      });

      const result = await this.deployService.deployAsset(assetType, assetId, validationConfig);

      logger.info('Validation result from deploy service', {
        assetType,
        assetId,
        resultSuccess: result.success,
        validationResultsCount: result.validationResults?.length || 0,
        validationResults: result.validationResults,
      });

      return successResponse(event, {
        success: true,
        data: {
          validationResults: result.validationResults || [],
          canDeploy: result.success,
        },
      });
    } catch (error: any) {
      logger.error('Deployment validation failed', { error });
      return errorResponse(
        event,
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Internal server error'
      );
    }
  }
}
