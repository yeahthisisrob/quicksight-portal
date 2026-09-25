import { v4 as uuidv4 } from 'uuid';

import type { SmusConfig } from '../../config/smusConfig';
import type { AssetType } from '../../models/asset.model';
import { executeJobLocallyAsync, isLocalDevelopment } from '../../utils/localDevelopment';
import { logger } from '../../utils/logger';
import { JobRepository } from './JobRepository';
import { type QueueMessage, queueService } from './QueueService';

// Job factory constants
const JOB_FACTORY_CONSTANTS = {
  UUID_SHORT_LENGTH: 8, // Length of UUID substring for job IDs
} as const;

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

export interface SmusExportJobConfig extends BaseJobConfig {
  jobType: 'smus-export';
  /** The SMUS config as the API resolved it (stored settings win over env). */
  options: { smus: SmusConfig };
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

/**
 * A planner call (a model asked to propose rebinds or visuals) as a job: a
 * long think would otherwise hit the API gateway's 30-second limit. The
 * result is the proposal, read back from the job.
 */
export interface PlannerJobConfig extends BaseJobConfig {
  jobType: 'planner';
  /** A catalog model key; omitted means the stack's configured planner. */
  model?: string;
  request:
    | {
        kind: 'propose';
        assetType: 'dashboard' | 'analysis';
        assetId: string;
        ask: string;
        candidateDataSetIds?: string[];
      }
    | { kind: 'new-visuals'; newAsset: Record<string, unknown> };
}

/** One message to the assistant; the result is its answer. */
export interface AssistantJobConfig extends BaseJobConfig {
  jobType: 'assistant';
  model: string;
  authoringModel?: string;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  /** The identity the assistant's own calls run as. */
  auth: {
    userId: string;
    accountId: string;
    email?: string;
    groups?: string[];
    apiKey?: { id: string; label: string };
  };
}

export type JobConfig =
  | ExportJobConfig
  | DeployJobConfig
  | ActivityRefreshJobConfig
  | BulkOperationJobConfig
  | CSVExportJobConfig
  | SmusExportJobConfig
  | PlannerJobConfig
  | AssistantJobConfig;

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
    const jobRepository = new JobRepository();
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
        ...(config.jobType === 'planner' &&
          config.request.kind === 'propose' && {
            assetType: config.request.assetType,
            assetId: config.request.assetId,
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
      // The job record was already created as 'queued' - fail it so it
      // doesn't linger as a phantom active job (which would also hold the
      // single-export 409 guard) until the stuck-job sweep catches it.
      logger.error('Failed to queue job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      try {
        await jobRepository.updateJob(jobId, {
          status: 'failed',
          endTime: new Date().toISOString(),
          message: 'Failed to enqueue job for processing',
          error: error instanceof Error ? error.message : 'Enqueue failed',
        });
      } catch (updateError) {
        logger.error('Failed to mark unqueued job as failed', { jobId, updateError });
      }
      throw error;
    }
  }

  private generateJobId(jobType: string): string {
    return `${jobType}-${Date.now()}-${uuidv4().substring(0, JOB_FACTORY_CONSTANTS.UUID_SHORT_LENGTH)}`;
  }

  private getInitialJobMessage(config: JobConfig): string {
    if (config.jobType === 'export') {
      if (config.options.rebuildIndex) {
        return 'Cache rebuild job queued';
      }
      return 'Export job queued';
    } else if (config.jobType === 'deploy') {
      return `Deployment job for ${config.assetType} ${config.assetId}`;
    } else if (config.jobType === 'activity-refresh') {
      return 'Activity refresh job queued';
    } else if (config.jobType === 'smus-export') {
      return 'SMUS export queued';
    } else if (config.jobType === 'bulk-operation') {
      const opType = config.operationConfig?.operationType || 'bulk';
      return `Bulk ${opType} operation queued (${config.estimatedOperations} items)`;
    } else if (config.jobType === 'csv-export') {
      return `CSV export job for ${config.assetType} queued`;
    } else if (config.jobType === 'assistant') {
      return 'Assistant thinking';
    } else if (config.jobType === 'planner') {
      return config.request.kind === 'propose'
        ? `Planner asked about ${config.request.assetType} ${config.request.assetId}`
        : 'Planner asked to propose visuals';
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
    } else if (config.jobType === 'smus-export') {
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
    } else if (config.jobType === 'planner') {
      return { request: config.request, model: config.model };
    } else if (config.jobType === 'assistant') {
      return {
        model: config.model,
        authoringModel: config.authoringModel,
        messages: config.messages,
        auth: config.auth,
      };
    }
    return {};
  }
}

export const jobFactory = JobFactory.getInstance();
