import { v4 as uuidv4 } from 'uuid';

import { JobRepository } from './JobRepository';
import { queueService, type QueueMessage } from './QueueService';
import { type AssetType } from '../../models/asset.model';
import { isLocalDevelopment, executeJobLocallyAsync } from '../../utils/localDevelopment';
import { logger } from '../../utils/logger';
import { S3Service } from '../aws/S3Service';

// Job factory constants
const JOB_FACTORY_CONSTANTS = {
  UUID_SHORT_LENGTH: 8, // Length of UUID substring for job IDs
} as const;

// Create a singleton S3Service instance for job operations
const accountId = process.env.AWS_ACCOUNT_ID || '';
const s3Service = new S3Service(accountId);

export interface BaseJobConfig {
  jobId?: string;
  accountId: string;
  bucketName: string;
  userId?: string;
}

export interface ExportJobConfig extends BaseJobConfig {
  jobType: 'export';
  options: {
    forceRefresh?: boolean;
    rebuildIndex?: boolean;
    exportIngestions?: boolean;
    assetTypes?: string[];
    refreshOptions?: {
      definitions?: boolean;
      permissions?: boolean;
      tags?: boolean;
    };
  };
}

export interface DeployJobConfig extends BaseJobConfig {
  jobType: 'deploy';
  assetType: AssetType;
  assetId: string;
  deploymentConfig: {
    deploymentType: string;
    source: string;
    target?: Record<string, any>;
    options?: Record<string, any>;
  };
}

export interface ActivityRefreshJobConfig extends BaseJobConfig {
  jobType: 'activity-refresh';
  options: {
    assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
    days?: number;
  };
}

export interface BulkOperationJobConfig extends BaseJobConfig {
  jobType: 'bulk-operation';
  operationConfig: any; // Will be BulkOperationConfig from bulkOperationTypes
  estimatedOperations: number;
  batchSize?: number;
  maxConcurrency?: number;
}

export interface CSVExportJobConfig extends BaseJobConfig {
  jobType: 'csv-export';
  assetType: string;
  options?: {
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, any>;
  };
}

export type JobConfig =
  | ExportJobConfig
  | DeployJobConfig
  | ActivityRefreshJobConfig
  | BulkOperationJobConfig
  | CSVExportJobConfig;

export class JobFactory {
  private static instance: JobFactory;

  public static getInstance(): JobFactory {
    if (!JobFactory.instance) {
      JobFactory.instance = new JobFactory();
    }
    return JobFactory.instance;
  }

  private constructor() {
    // JobFactory handles job creation and queueing
  }

  public async createJob(
    config: JobConfig
  ): Promise<{ jobId: string; status: string; message: string }> {
    const startTime = Date.now();
    const jobId = config.jobId || this.generateJobId(config.jobType);

    logger.info('Creating job', {
      jobId,
      jobType: config.jobType,
    });

    // Create the job entry FIRST in the API Lambda so it's immediately visible
    const jobRepository = new JobRepository(s3Service, config.bucketName);
    const initialMessage = this.getInitialJobMessage(config);

    try {
      // Create job with queued status - this persists immediately so UI can find it
      await jobRepository.createJob({
        jobId,
        jobType: config.jobType as any,
        status: 'queued',
        message: initialMessage,
        startTime: new Date().toISOString(),
        userId: config.userId,
        accountId: config.accountId,
        ...(config.jobType === 'deploy' && {
          assetType: config.assetType,
          assetId: config.assetId,
          deploymentType: config.deploymentConfig?.deploymentType,
        }),
        ...(config.jobType === 'export' && {
          exportOptions: config.options,
        }),
        ...(config.jobType === 'activity-refresh' && {
          exportOptions: config.options,
        }),
        ...(config.jobType === 'bulk-operation' && {
          operationConfig: config.operationConfig,
          estimatedOperations: config.estimatedOperations,
        }),
        ...(config.jobType === 'csv-export' && {
          assetType: config.assetType,
          exportOptions: config.options,
        }),
      });

      logger.info('Job created in repository', {
        jobId,
        elapsed: Date.now() - startTime,
      });
    } catch (error) {
      logger.error('Failed to create job in repository', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue anyway - we'll queue the job and let worker create it
    }

    // Build the message with all job details
    const message: QueueMessage = {
      jobId,
      jobType: config.jobType,
      accountId: config.accountId,
      bucketName: config.bucketName,
      userId: config.userId,
      ...this.getJobSpecificFields(config),
      // Include initial message for the worker to use
      initialMessage,
    };

    try {
      if (isLocalDevelopment()) {
        // In local dev, simulate SQS by directly calling the worker
        executeJobLocallyAsync({
          jobId,
          jobType: config.jobType,
          message,
        });
      } else {
        // Production: Send to SQS
        await queueService.sendMessage(message);

        logger.info('Job queued successfully', {
          jobId,
          jobType: config.jobType,
          elapsed: Date.now() - startTime,
        });
      }

      return {
        jobId,
        status: 'queued',
        message: `${config.jobType} job queued successfully`,
      };
    } catch (error) {
      // In production, if SQS fails, we don't have a job entry to update
      // Just throw the error and let the API return 500
      logger.error('Failed to queue job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private generateJobId(jobType: string): string {
    return `${jobType}-${Date.now()}-${uuidv4().substring(0, JOB_FACTORY_CONSTANTS.UUID_SHORT_LENGTH)}`;
  }

  private getInitialJobMessage(config: JobConfig): string {
    if (config.jobType === 'export') {
      if (config.options.exportIngestions) {
        return 'Ingestion export job queued';
      } else if (config.options.rebuildIndex) {
        return 'Cache rebuild job queued';
      }
      return 'Export job queued';
    } else if (config.jobType === 'deploy') {
      return `Deployment job for ${config.assetType} ${config.assetId}`;
    } else if (config.jobType === 'activity-refresh') {
      return 'Activity refresh job queued';
    } else if (config.jobType === 'bulk-operation') {
      const opType = config.operationConfig?.operationType || 'bulk';
      return `Bulk ${opType} operation queued (${config.estimatedOperations} items)`;
    } else if (config.jobType === 'csv-export') {
      return `CSV export job for ${config.assetType} queued`;
    }
    return 'Job queued';
  }

  private getJobSpecificFields(config: JobConfig): Record<string, any> {
    if (config.jobType === 'export') {
      return { options: config.options };
    } else if (config.jobType === 'deploy') {
      return {
        assetType: config.assetType,
        assetId: config.assetId,
        deploymentConfig: config.deploymentConfig,
      };
    } else if (config.jobType === 'activity-refresh') {
      return { options: config.options };
    } else if (config.jobType === 'bulk-operation') {
      return {
        operationConfig: config.operationConfig,
        estimatedOperations: config.estimatedOperations,
        batchSize: config.batchSize,
        maxConcurrency: config.maxConcurrency,
      };
    } else if (config.jobType === 'csv-export') {
      return {
        assetType: config.assetType,
        options: config.options,
      };
    }
    return {};
  }
}

export const jobFactory = JobFactory.getInstance();
