/* global setInterval, clearInterval, setTimeout */
import { type SQSEvent, type Context } from 'aws-lambda';

import { ActivityRefreshProcessor } from './features/activity/processors/ActivityRefreshProcessor';
import { ExportOrchestrator } from './features/data-export/services/ExportOrchestrator';
import { type DeploymentConfig } from './features/deployment/services/deploy/types';
import { STORAGE_LIMITS, WORKER_CONFIG } from './shared/constants';
import { type AssetType } from './shared/models/asset.model';
import { S3Service } from './shared/services/aws/S3Service';
import { cacheService } from './shared/services/cache/CacheService';
import { JobStateService } from './shared/services/jobs/JobStateService';
import { logger } from './shared/utils/logger';

// Get AWS account ID from environment
const accountId = process.env.AWS_ACCOUNT_ID || '';
const s3Service = new S3Service(accountId);

interface DeployMessage {
  jobId: string;
  jobType: 'deploy';
  accountId: string;
  bucketName: string;
  assetType: AssetType;
  assetId: string;
  deploymentConfig: DeploymentConfig;
  userId?: string;
  initialMessage?: string;
}

interface ExportMessage {
  jobId: string;
  jobType?: 'export';
  accountId: string;
  bucketName: string;
  userId?: string;
  initialMessage?: string;
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

interface ActivityRefreshMessage {
  jobId: string;
  jobType: 'activity-refresh';
  accountId: string;
  bucketName: string;
  userId?: string;
  initialMessage?: string;
  options: {
    assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
    days?: number;
  };
}

interface BulkOperationMessage {
  jobId: string;
  jobType: 'bulk-operation';
  accountId: string;
  bucketName: string;
  userId?: string;
  initialMessage?: string;
  operationConfig: any; // BulkOperationConfig from bulkOperationTypes
  estimatedOperations: number;
  batchSize?: number;
  maxConcurrency?: number;
}

/**
 * Worker Lambda handler for processing export and deployment jobs from SQS
 */
export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  logger.info('Worker handler started', {
    recordCount: event.Records?.length,
    requestId: context.awsRequestId,
  });
  // Ensure Lambda waits for all async operations to complete
  context.callbackWaitsForEmptyEventLoop = true;

  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  let isProcessingComplete = false;

  try {
    // Start heartbeat to monitor Lambda execution
    heartbeatInterval = setInterval(() => {
      if (!isProcessingComplete) {
        logger.debug('Worker heartbeat', {
          uptime: process.uptime(),
          memoryUsage:
            Math.round(
              process.memoryUsage().heapUsed /
                STORAGE_LIMITS.CHUNK_SIZE_KB /
                STORAGE_LIMITS.CHUNK_SIZE_KB
            ) + 'MB',
        });
      }
    }, WORKER_CONFIG.HEARTBEAT_INTERVAL_MS);

    // Process all records
    const results = await Promise.allSettled(
      event.Records.map(async (record) => {
        return await processRecord(record);
      })
    );

    // Log any rejections but don't fail the entire handler
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Record processing failed', {
          recordIndex: index,
          messageId: event.Records[index]?.messageId,
          error: result.reason,
        });
      }
    });

    // Brief wait to ensure all async operations complete
    await new Promise((resolve) => setTimeout(resolve, WORKER_CONFIG.CLEANUP_DELAY_MS));
  } catch (error) {
    logger.error('Fatal error in worker handler', { error });
    throw error;
  } finally {
    isProcessingComplete = true;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  }
};

/**
 * Process a single SQS record
 */
async function processRecord(record: any): Promise<void> {
  const startTime = Date.now();
  let jobId: string | null = null;

  try {
    // Parse the message to determine job type
    const rawMessage = JSON.parse(record.body);
    jobId = rawMessage.jobId;

    if (!jobId) {
      logger.error('Message missing jobId', { messageId: record.messageId });
      return;
    }

    // Route to appropriate job processor
    if (rawMessage.jobType === 'deploy') {
      await processDeploymentJob(rawMessage as DeployMessage, record);
    } else if (rawMessage.jobType === 'activity-refresh') {
      await processActivityRefreshJob(rawMessage as ActivityRefreshMessage, record);
    } else if (rawMessage.jobType === 'bulk-operation') {
      await processBulkOperationJob(rawMessage as BulkOperationMessage, record);
    } else {
      await processExportJob(rawMessage as ExportMessage, record);
    }
  } catch (error) {
    handleJobError(error, jobId, startTime);
  }
}

/**
 * Process a deployment job from SQS message
 */
async function processDeploymentJob(message: DeployMessage, record: any): Promise<void> {
  const {
    jobId,
    accountId: msgAccountId,
    bucketName,
    assetType,
    assetId,
    deploymentConfig,
  } = message;

  logger.info('Starting deployment job from SQS', {
    jobId,
    accountId: msgAccountId,
    assetType,
    assetId,
    deploymentType: deploymentConfig.deploymentType,
    messageId: record.messageId,
  });

  const jobStateService = new JobStateService(s3Service, bucketName, 'deploy');

  try {
    await cleanupStuckJobs(jobStateService, 'deployment');

    const shouldProcess = await initializeDeploymentJob(jobStateService, jobId, message);
    if (!shouldProcess) {
      return;
    }

    await executeDeploymentJob(jobStateService, jobId, message);
  } catch (error) {
    await handleDeploymentError(jobStateService, jobId, error);
  }
}

/**
 * Process an export job from SQS message
 */
async function processExportJob(message: ExportMessage, record: any): Promise<void> {
  const { jobId, accountId: msgAccountId, bucketName, options } = message;

  logger.info('Starting export job from SQS', {
    jobId,
    accountId: msgAccountId,
    messageId: record.messageId,
    options,
  });

  const jobStateService = new JobStateService(s3Service, bucketName, 'export');
  const exportOrchestrator = new ExportOrchestrator(msgAccountId);

  try {
    await cleanupStuckJobs(jobStateService, 'export');
    await initializeExportJob(jobStateService, jobId, message);
    await executeExportJob(jobStateService, jobId, exportOrchestrator, options);
  } catch (error) {
    await handleExportError(jobStateService, jobId, error);
  }
}

/**
 * Process an activity refresh job from SQS message
 */
async function processActivityRefreshJob(
  message: ActivityRefreshMessage,
  record: any
): Promise<void> {
  const { jobId, accountId: msgAccountId, bucketName, options } = message;

  logger.info('Processing activity refresh job', {
    jobId,
    accountId: msgAccountId,
    messageId: record.messageId,
    options,
  });

  const jobStateService = new JobStateService(s3Service, bucketName, 'activity-refresh');
  const activityProcessor = new ActivityRefreshProcessor(process.env.AWS_REGION || 'us-east-1');

  try {
    await cleanupStuckJobs(jobStateService, 'activity-refresh');
    await initializeActivityRefreshJob(jobStateService, jobId, message);

    // Set up job tracking
    activityProcessor.setJobStateService(jobStateService, jobId);

    // Process the activity refresh
    await activityProcessor.processActivityRefresh(options);

    // Mark job as completed (processor should have done this, but ensure it's done)
    await jobStateService.updateJobStatus(jobId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      message: 'Activity refresh completed successfully',
      progress: 100,
    });
  } catch (error) {
    await handleActivityRefreshError(jobStateService, jobId, error);
  }
}

/**
 * Initialize an activity refresh job
 */
async function initializeActivityRefreshJob(
  jobStateService: JobStateService,
  jobId: string,
  message: ActivityRefreshMessage
): Promise<void> {
  // Check if job already exists (created by API Lambda)
  const existingJob = await jobStateService.getJobStatus(jobId);
  if (existingJob) {
    // Job already exists, just update it to processing
    await jobStateService.updateJobStatus(jobId, {
      status: 'processing',
      message: 'Starting activity refresh',
      progress: 0,
    });
    logger.info('Updated existing activity refresh job to processing', { jobId });
  } else {
    // Fallback: create the job if it doesn't exist
    await jobStateService.createJob(jobId, {
      status: 'processing',
      message: message.initialMessage || 'Starting activity refresh',
      progress: 0,
      startTime: new Date().toISOString(),
    });
    logger.info('Created new activity refresh job (fallback)', { jobId });
  }
}

/**
 * Handle activity refresh job errors
 */
async function handleActivityRefreshError(
  jobStateService: JobStateService,
  jobId: string,
  error: any
): Promise<void> {
  logger.error('Activity refresh job failed', {
    jobId,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });

  await jobStateService.updateJobStatus(jobId, {
    status: 'failed',
    endTime: new Date().toISOString(),
    message: `Activity refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    error: error instanceof Error ? error.message : 'Unknown error',
  });
}

/**
 * Process a bulk operation job from SQS message
 */
async function processBulkOperationJob(message: BulkOperationMessage, record: any): Promise<void> {
  const {
    jobId,
    accountId: msgAccountId,
    bucketName,
    operationConfig,
    batchSize,
    maxConcurrency,
  } = message;

  logger.info('Processing bulk operation job', {
    jobId,
    accountId: msgAccountId,
    messageId: record.messageId,
    operationType: operationConfig.operationType,
    estimatedOperations: message.estimatedOperations,
  });

  const jobStateService = new JobStateService(s3Service, bucketName, 'bulk-operation');

  // Import BulkOperationsProcessor dynamically to avoid circular dependencies
  const { BulkOperationsProcessor } = await import(
    './shared/services/bulk/BulkOperationsProcessor'
  );
  const bulkProcessor = new BulkOperationsProcessor(msgAccountId);

  try {
    await cleanupStuckJobs(jobStateService, 'bulk-operation');
    await initializeBulkOperationJob(jobStateService, jobId, message);

    // Set up job tracking
    bulkProcessor.setJobStateService(jobStateService, jobId);

    // Process the bulk operation
    const result = await bulkProcessor.processBulkOperation(
      operationConfig,
      batchSize,
      maxConcurrency
    );

    // Save the result
    const { JobRepository } = await import('./shared/services/jobs/JobRepository');
    const jobRepository = new JobRepository(s3Service, bucketName);
    await jobRepository.saveJobResult(jobId, result);

    // Mark job as completed (processor should have done this, but ensure it's done)
    await jobStateService.updateJobStatus(jobId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      message: `Bulk ${operationConfig.operationType} completed: ${result.successCount}/${result.totalItems} successful`,
      progress: 100,
      stats: {
        totalAssets: result.totalItems,
        processedAssets: result.successCount + result.failureCount,
        failedAssets: result.failureCount,
        operations: {
          success: result.successCount,
          failed: result.failureCount,
        },
      },
    });
  } catch (error) {
    await handleBulkOperationError(jobStateService, jobId, error);
  }
}

/**
 * Initialize a bulk operation job
 */
async function initializeBulkOperationJob(
  jobStateService: JobStateService,
  jobId: string,
  message: BulkOperationMessage
): Promise<void> {
  // Check if job already exists (created by API Lambda)
  const existingJob = await jobStateService.getJobStatus(jobId);
  if (existingJob) {
    // Job already exists, just update it to processing
    await jobStateService.updateJobStatus(jobId, {
      status: 'processing',
      message: `Processing bulk ${message.operationConfig.operationType} operation`,
      progress: 0,
    });
    logger.info('Updated existing bulk operation job to processing', { jobId });
  } else {
    // Fallback: create the job if it doesn't exist
    await jobStateService.createJob(jobId, {
      status: 'processing',
      message:
        message.initialMessage ||
        `Processing bulk ${message.operationConfig.operationType} operation`,
      progress: 0,
      startTime: new Date().toISOString(),
    });
    logger.info('Created new bulk operation job (fallback)', { jobId });
  }
}

/**
 * Handle bulk operation job errors
 */
async function handleBulkOperationError(
  jobStateService: JobStateService,
  jobId: string,
  error: any
): Promise<void> {
  logger.error('Bulk operation job failed', {
    jobId,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });

  await jobStateService.updateJobStatus(jobId, {
    status: 'failed',
    endTime: new Date().toISOString(),
    message: `Bulk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    error: error instanceof Error ? error.message : 'Unknown error',
  });
}

/**
 * Clean up stuck jobs before processing
 */
async function cleanupStuckJobs(jobStateService: JobStateService, jobType: string): Promise<void> {
  try {
    const cleanedCount = await jobStateService.cleanupStuckJobs(
      WORKER_CONFIG.STUCK_JOB_TIMEOUT_MINUTES
    );
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} stuck ${jobType} jobs before processing`);
    }
  } catch (cleanupError) {
    logger.warn(`Failed to cleanup stuck ${jobType} jobs`, { error: cleanupError });
  }
}

/**
 * Initialize a deployment job
 */
async function initializeDeploymentJob(
  jobStateService: JobStateService,
  jobId: string,
  message: DeployMessage
): Promise<boolean> {
  const { assetType, assetId, deploymentConfig } = message;

  // Check if job already exists (created by API Lambda)
  const existingJob = await jobStateService.getJobStatus(jobId);
  if (existingJob) {
    // Job already exists, just update it to processing
    await jobStateService.updateJobStatus(jobId, {
      status: 'processing',
      message: `Starting ${deploymentConfig.deploymentType} of ${assetType} ${assetId}`,
      progress: 0,
    });
    logger.info('Updated existing deploy job to processing', { jobId });
  } else {
    // Fallback: create the job if it doesn't exist (for backwards compatibility)
    await jobStateService.createJob(jobId, {
      status: 'processing',
      message:
        message.initialMessage ||
        `Starting ${deploymentConfig.deploymentType} of ${assetType} ${assetId}`,
      progress: 0,
      startTime: new Date().toISOString(),
    });
    logger.info('Created new deploy job (fallback)', { jobId });
  }

  // Check for existing running deployment jobs (moved from API to worker)
  const existingJobs = await jobStateService.getActiveJobs();
  const runningDeployJobs = existingJobs.filter(
    (job) =>
      job.jobId !== jobId && // Don't count ourselves
      job.jobType === 'deploy' &&
      (job.status === 'processing' || job.status === 'queued')
  );

  if (runningDeployJobs.length > 0) {
    const runningJob = runningDeployJobs[0];
    if (runningJob) {
      logger.warn('Deployment job blocked - another deployment is already running', {
        blockedJobId: jobId,
        existingJobId: runningJob.jobId,
        existingJobStatus: runningJob.status,
      });

      // Update the job we just created to failed status
      await jobStateService.updateJobStatus(jobId, {
        status: 'failed',
        endTime: new Date().toISOString(),
        message: `Another deployment job is already running (${runningJob.jobId})`,
        error: 'Duplicate job blocked',
      });

      return false; // Don't process this job
    }
  }

  return true; // Process the job
}

/**
 * Execute a deployment job
 */
async function executeDeploymentJob(
  jobStateService: JobStateService,
  jobId: string,
  message: DeployMessage
): Promise<void> {
  const { accountId: msgAccountId, bucketName, assetType, assetId, deploymentConfig } = message;

  // Dynamically import DeployService to avoid circular dependencies
  const { DeployService } = await import('./features/deployment/services/deploy/DeployService');
  const deployService = new DeployService(
    s3Service,
    cacheService,
    bucketName,
    msgAccountId,
    process.env.AWS_REGION || 'us-east-1'
  );

  // Execute the deployment
  const result = await deployService.deployAsset(assetType, assetId, deploymentConfig);

  // Save the deployment result if successful
  if (result.success) {
    const { JobRepository } = await import('./shared/services/jobs/JobRepository');
    const jobRepository = new JobRepository(s3Service, bucketName);
    await jobRepository.saveJobResult(jobId, result);
  }

  // Mark job as completed or failed based on result
  await jobStateService.updateJobStatus(jobId, {
    status: 'completed',
    progress: 100,
    endTime: new Date().toISOString(),
    message: `${deploymentConfig.deploymentType} completed successfully`,
  });

  logger.info('Deployment job completed successfully', {
    jobId,
    assetType,
    assetId,
    deploymentType: deploymentConfig.deploymentType,
  });
}

/**
 * Initialize an export job
 */
async function initializeExportJob(
  jobStateService: JobStateService,
  jobId: string,
  message: ExportMessage
): Promise<void> {
  // Check if job already exists (created by API Lambda)
  const existingJob = await jobStateService.getJobStatus(jobId);

  if (existingJob) {
    // Job already exists, just update it to processing
    await jobStateService.updateJobStatus(jobId, {
      status: 'processing',
      message: 'Starting export job',
      progress: 0,
    });
    logger.info('Updated existing export job to processing', { jobId });
  } else {
    // Fallback: create the job if it doesn't exist (for backwards compatibility)
    await jobStateService.createJob(jobId, {
      status: 'processing',
      message: message.initialMessage || 'Starting export job',
      progress: 0,
      startTime: new Date().toISOString(),
    });
    logger.info('Created new export job (fallback)', { jobId });
  }
}

/**
 * Execute an export job
 */
async function executeExportJob(
  jobStateService: JobStateService,
  jobId: string,
  exportOrchestrator: ExportOrchestrator,
  options: any
): Promise<void> {
  // Set the job state service for the orchestrator
  exportOrchestrator.setJobStateService(jobStateService, jobId);

  // Prepare export options
  const exportOptions: any = {
    forceRefresh: options.forceRefresh,
    rebuildIndex: options.rebuildIndex,
    exportIngestions: options.exportIngestions,
    refreshOptions: options.refreshOptions,
  };

  // Only include assetTypes if provided (not for ingestion-only or cache-only exports)
  if (options.assetTypes) {
    exportOptions.assetTypes = options.assetTypes as AssetType[];
  }

  // Execute the export with progress tracking
  const result = await exportOrchestrator.exportAssets(exportOptions);

  // Mark job as completed with stats
  await jobStateService.updateJobStatus(jobId, {
    status: 'completed',
    progress: 100,
    endTime: new Date().toISOString(),
    message: `Export completed: ${result.totals.processed} assets processed`,
    stats: {
      totalAssets: result.totals.listed,
      processedAssets: result.totals.processed,
      failedAssets: result.totals.failed,
    },
  });

  logger.info('Export job completed successfully', {
    jobId,
    totals: result.totals,
    duration: result.duration,
  });
}

/**
 * Handle deployment job errors
 */
async function handleDeploymentError(
  jobStateService: JobStateService,
  jobId: string,
  error: any
): Promise<void> {
  logger.error('Deployment job failed', { jobId, error: error.message || error });

  await jobStateService.updateJobStatus(jobId, {
    status: 'failed',
    endTime: new Date().toISOString(),
    message: `Deployment failed: ${error.message || error}`,
    error: error.message || String(error),
  });
}

/**
 * Handle export job errors
 */
async function handleExportError(
  jobStateService: JobStateService,
  jobId: string,
  error: any
): Promise<void> {
  logger.error('Export job failed', { jobId, error: error.message || error });

  try {
    // Check if job exists before updating
    const existingJob = await jobStateService.getJobStatus(jobId);
    if (!existingJob) {
      // Create the job first if it doesn't exist (can happen in local dev)
      await jobStateService.createJob(jobId, {
        status: 'failed',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        message: `Export failed: ${error.message || error}`,
        error: error.message || String(error),
      });
    } else {
      // Update existing job
      await jobStateService.updateJobStatus(jobId, {
        status: 'failed',
        endTime: new Date().toISOString(),
        message: `Export failed: ${error.message || error}`,
        error: error.message || String(error),
      });
    }
  } catch (updateError) {
    logger.error('Failed to update job status on error', {
      jobId,
      originalError: error.message || error,
      updateError: updateError instanceof Error ? updateError.message : String(updateError),
    });
  }
}

/**
 * Handle general job processing errors
 */
function handleJobError(error: any, jobId: string | null, startTime: number): void {
  const duration = Date.now() - startTime;

  if (jobId) {
    logger.error('Job processing failed', {
      jobId,
      error: error.message || error,
      stack: error.stack,
      duration,
    });
  } else {
    logger.error('Message processing failed (no jobId)', {
      error: error.message || error,
      stack: error.stack,
      duration,
    });
  }

  // Re-throw to let SQS handle retry logic
  throw error;
}
