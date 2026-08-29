/* global setInterval, clearInterval, setTimeout */
import { type SQSEvent, type Context } from 'aws-lambda';

import { ActivityRefreshProcessor } from './features/activity/processors/ActivityRefreshProcessor';
import { warmCollectionSnapshots } from './features/asset-management/services/collectionSnapshotWarmer';
import { ExportOrchestrator } from './features/data-export/services/ExportOrchestrator';
import { type DeploymentConfig } from './features/deployment/services/deploy/types';
import { JOB_CONFIG, STORAGE_LIMITS, TIME_UNITS, WORKER_CONFIG } from './shared/constants';
import { type AssetType } from './shared/models/asset.model';
import { S3Service } from './shared/services/aws/S3Service';
import { cacheService } from './shared/services/cache/CacheService';
import { JobStateService } from './shared/services/jobs/JobStateService';
import { queueService } from './shared/services/jobs/QueueService';
import { logger } from './shared/utils/logger';

// Composition root: wire cross-slice derived-data recomputation here so
// feature slices (data-export, activity) trigger it via cacheService hooks
// instead of importing asset-management's warmer directly (import cycle)
cacheService.registerCacheRebuildHook(warmCollectionSnapshots);

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
  /** Set on messages the worker requeues to itself to resume a paused job */
  continuation?: boolean;
  /** How many continuation hops this job has taken (runaway-loop guard) */
  continuationCount?: number;
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

interface CSVExportMessage {
  jobId: string;
  jobType: 'csv-export';
  accountId: string;
  bucketName: string;
  userId?: string;
  initialMessage?: string;
  assetType: string;
  options?: {
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, any>;
  };
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
        return await processRecord(record, context);
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
async function processRecord(record: any, context: Context): Promise<void> {
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
    } else if (rawMessage.jobType === 'csv-export') {
      await processCSVExportJob(rawMessage as CSVExportMessage, record);
    } else {
      await processExportJob(rawMessage as ExportMessage, record, context);
    }
  } catch (error) {
    handleJobError(error, jobId, startTime);
  }
}

/**
 * Wall-clock deadline for this invocation: stop starting new work this far
 * before the Lambda hard timeout so the export can checkpoint + requeue a
 * continuation instead of being killed mid-write. null = no limit (local dev
 * invokes the handler with an empty context).
 */
function computeInvocationDeadline(context: Context): number | null {
  if (typeof context?.getRemainingTimeInMillis !== 'function') {
    return null;
  }
  return Date.now() + context.getRemainingTimeInMillis() - WORKER_CONFIG.EXPORT_DEADLINE_SAFETY_MS;
}

/**
 * Process a deployment job from SQS message
 */
async function processDeploymentJob(message: DeployMessage, record: any): Promise<void> {
  const { jobId, accountId: msgAccountId, assetType, assetId, deploymentConfig } = message;

  logger.info('Starting deployment job from SQS', {
    jobId,
    accountId: msgAccountId,
    assetType,
    assetId,
    deploymentType: deploymentConfig.deploymentType,
    messageId: record.messageId,
  });

  const jobStateService = new JobStateService('deploy');

  try {
    await cleanupStuckJobs(jobStateService, 'deployment');

    const shouldProcess = await initializeDeploymentJob(jobStateService, jobId, message);
    if (!shouldProcess) {
      return;
    }

    await jobStateService.updateJobStatus(jobId, {
      status: 'processing',
      message: `Executing ${message.deploymentConfig.deploymentType} for ${message.assetType} ${message.assetId}...`,
      progress: 30,
    });

    await executeDeploymentJob(jobStateService, jobId, message);
  } catch (error) {
    await handleDeploymentError(jobStateService, jobId, error);
  }
}

/**
 * Process an export job from SQS message
 */
async function processExportJob(
  message: ExportMessage,
  record: any,
  context: Context
): Promise<void> {
  const { jobId, accountId: msgAccountId, options } = message;

  logger.info('Starting export job from SQS', {
    jobId,
    accountId: msgAccountId,
    messageId: record.messageId,
    receiveCount: record.attributes?.ApproximateReceiveCount,
    continuation: message.continuation === true,
    options,
  });

  const jobStateService = new JobStateService('export');
  const exportOrchestrator = new ExportOrchestrator(msgAccountId);

  try {
    await cleanupStuckJobs(jobStateService, 'export');
    const shouldProcess = await initializeExportJob(jobStateService, jobId, message, record);
    if (!shouldProcess) {
      return; // message is deleted; a zombie/duplicate delivery dies here
    }
    await executeExportJob(
      jobStateService,
      jobId,
      exportOrchestrator,
      message,
      computeInvocationDeadline(context)
    );
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
  const { jobId, accountId: msgAccountId, options } = message;

  logger.info('Processing activity refresh job', {
    jobId,
    accountId: msgAccountId,
    messageId: record.messageId,
    options,
  });

  const jobStateService = new JobStateService('activity-refresh');
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
  const { jobId, accountId: msgAccountId, operationConfig, batchSize, maxConcurrency } = message;

  logger.info('Processing bulk operation job', {
    jobId,
    accountId: msgAccountId,
    messageId: record.messageId,
    operationType: operationConfig.operationType,
    estimatedOperations: message.estimatedOperations,
  });

  const jobStateService = new JobStateService('bulk-operation');

  // Import BulkOperationsProcessor dynamically to avoid circular dependencies
  const { BulkOperationsProcessor } =
    await import('./shared/services/bulk/BulkOperationsProcessor');
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
    const jobRepository = new JobRepository();
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

    // Bulk mutations (delete / membership / tags) change type-cache ETags,
    // invalidating the user/group list snapshots. Re-warm here so the next
    // visitor adopts a precomputed snapshot instead of paying enrichment +
    // a large S3 PUT in their request. Never throws.
    await cacheService.runCacheRebuildHooks();
  } catch (error) {
    if (error instanceof JobAlreadyCompletedError) {
      return; // redelivered message for a finished job - nothing to do
    }
    await handleBulkOperationError(jobStateService, jobId, error);
  }
}

/**
 * Initialize a bulk operation job
 */
/** Thrown to short-circuit processing of a redelivered, already-completed job */
class JobAlreadyCompletedError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} already completed`);
    this.name = 'JobAlreadyCompletedError';
  }
}

async function initializeBulkOperationJob(
  jobStateService: JobStateService,
  jobId: string,
  message: BulkOperationMessage
): Promise<void> {
  // Check if job already exists (created by API Lambda)
  const existingJob = await jobStateService.getJobStatus(jobId);
  if (existingJob) {
    // Idempotency guard: an SQS redelivery (visibility timeout while the
    // first invocation is still running, or a retry) must not reset and
    // re-run a job that already finished its mutations
    if (existingJob.status === 'completed') {
      logger.info('Bulk operation job already completed - skipping redelivered message', {
        jobId,
      });
      throw new JobAlreadyCompletedError(jobId);
    }
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
 * Process a CSV export job from SQS message
 */
async function processCSVExportJob(message: CSVExportMessage, record: any): Promise<void> {
  const { jobId, accountId: msgAccountId, assetType, options } = message;

  logger.info('Processing CSV export job', {
    jobId,
    accountId: msgAccountId,
    messageId: record.messageId,
    assetType,
    options,
  });

  const jobStateService = new JobStateService('csv-export');

  // Import CSVExportProcessor dynamically
  const { CSVExportProcessor } =
    await import('./features/asset-management/processors/CSVExportProcessor');
  const csvExportProcessor = new CSVExportProcessor(msgAccountId);

  try {
    await cleanupStuckJobs(jobStateService, 'csv-export');
    await initializeCSVExportJob(jobStateService, jobId, message);

    // Set up job tracking
    csvExportProcessor.setJobStateService(jobStateService, jobId);

    // Generate the CSV export
    const result = await csvExportProcessor.generateCSVExport(assetType, options || {});

    // Save the result (durable immediately - per-job DynamoDB item)
    const { JobRepository } = await import('./shared/services/jobs/JobRepository');
    const jobRepository = new JobRepository();
    await jobRepository.saveJobResult(jobId, result);

    // Mark job as completed
    await jobStateService.updateJobStatus(jobId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      message: `CSV export completed: ${result.count} ${assetType}(s) exported`,
      progress: 100,
      stats: {
        totalAssets: result.count,
        processedAssets: result.count,
      },
    });

    logger.info('CSV export job completed successfully', {
      jobId,
      assetType,
      count: result.count,
    });
  } catch (error) {
    await handleCSVExportError(jobStateService, jobId, error);
  }
}

/**
 * Initialize a CSV export job
 */
async function initializeCSVExportJob(
  jobStateService: JobStateService,
  jobId: string,
  message: CSVExportMessage
): Promise<void> {
  // Check if job already exists (created by API Lambda)
  const existingJob = await jobStateService.getJobStatus(jobId);
  if (existingJob) {
    // Job already exists, just update it to processing
    await jobStateService.updateJobStatus(jobId, {
      status: 'processing',
      message: `Generating CSV export for ${message.assetType}`,
      progress: 0,
    });
    logger.info('Updated existing CSV export job to processing', { jobId });
  } else {
    // Fallback: create the job if it doesn't exist
    await jobStateService.createJob(jobId, {
      status: 'processing',
      message: message.initialMessage || `Generating CSV export for ${message.assetType}`,
      progress: 0,
      startTime: new Date().toISOString(),
    });
    logger.info('Created new CSV export job (fallback)', { jobId });
  }
}

/**
 * Handle CSV export job errors
 */
async function handleCSVExportError(
  jobStateService: JobStateService,
  jobId: string,
  error: any
): Promise<void> {
  logger.error('CSV export job failed', {
    jobId,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });

  await jobStateService.updateJobStatus(jobId, {
    status: 'failed',
    endTime: new Date().toISOString(),
    message: `CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    error: error instanceof Error ? error.message : 'Unknown error',
  });
}

/**
 * Self-healing job hygiene, run before processing each job:
 * - mark dead jobs (no heartbeat) as failed
 * - prune jobs past the retention window
 * Both also happen lazily on API reads; doing them here keeps the index tidy
 * even if nobody is looking at the jobs page. Never fatal.
 */
async function cleanupStuckJobs(jobStateService: JobStateService, jobType: string): Promise<void> {
  try {
    // No explicit threshold: JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES (30) is
    // deliberately longer than any legitimate single invocation.
    const cleanedCount = await jobStateService.cleanupStuckJobs();
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} dead ${jobType} jobs before processing`);
    }
    const prunedCount = await jobStateService.cleanupOldJobs();
    if (prunedCount > 0) {
      logger.info(`Pruned ${prunedCount} jobs past retention before processing`);
    }
  } catch (cleanupError) {
    logger.warn(`Failed job hygiene sweep before ${jobType} processing`, { error: cleanupError });
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

  // Always save the result for inspection
  const { JobRepository } = await import('./shared/services/jobs/JobRepository');
  const jobRepository = new JobRepository();
  await jobRepository.saveJobResult(jobId, result);

  const verification = result.metadata?.verification;
  const finalStatus = result.success ? 'completed' : 'failed';

  let finalMessage: string;
  if (!result.success) {
    finalMessage = result.error || `${deploymentConfig.deploymentType} failed`;
  } else if (verification) {
    finalMessage = verification.verified
      ? `${deploymentConfig.deploymentType} completed and verified in QuickSight (${verification.status || 'SUCCESS'})`
      : `${deploymentConfig.deploymentType} completed (verification: ${verification.message || verification.status || 'unknown'})`;
  } else {
    finalMessage = `${deploymentConfig.deploymentType} completed successfully`;
  }

  // Mark job based on actual result + include verification info when available
  await jobStateService.updateJobStatus(jobId, {
    status: finalStatus,
    progress: 100,
    endTime: new Date().toISOString(),
    message: finalMessage,
    ...(result.success ? {} : { error: result.error }),
  });

  if (result.success) {
    logger.info('Deployment job completed successfully', {
      jobId,
      assetType,
      assetId,
      deploymentType: deploymentConfig.deploymentType,
    });
  } else {
    logger.warn('Deployment job completed with failure', {
      jobId,
      assetType,
      assetId,
      error: result.error,
    });
  }
}

/**
 * Initialize an export job. Returns false when this delivery must NOT be
 * processed - the message is then deleted (we return without throwing), which
 * is what kills zombie redelivery loops:
 *
 * - A redelivered message for a finished/stopped/failed job is dropped.
 * - A redelivery while the job's heartbeat is still fresh means another
 *   invocation is live (visibility timeout elapsed mid-run) - dropped to
 *   prevent two workers processing the same job concurrently.
 * - Excessive receive counts / continuation hops fail the job and drop.
 * - Only one export may run at a time: a fresh job that arrives while another
 *   export job is active is failed immediately with a clear message.
 */
async function initializeExportJob(
  jobStateService: JobStateService,
  jobId: string,
  message: ExportMessage,
  record: any
): Promise<boolean> {
  const receiveCount = parseInt(record.attributes?.ApproximateReceiveCount || '1', 10);
  const isContinuation = message.continuation === true;

  // Runaway-continuation guard
  if ((message.continuationCount || 0) > WORKER_CONFIG.EXPORT_MAX_CONTINUATIONS) {
    logger.error('Export exceeded max continuation hops - failing job', { jobId });
    await jobStateService.updateJobStatus(jobId, {
      status: 'failed',
      endTime: new Date().toISOString(),
      message: `Export failed: exceeded ${WORKER_CONFIG.EXPORT_MAX_CONTINUATIONS} continuation invocations`,
      error: 'Continuation limit exceeded',
    });
    return false;
  }

  // Check if job already exists (created by API Lambda)
  const existingJob = await jobStateService.getJobStatus(jobId);
  if (!existingJob) {
    // Fallback: create the job if it doesn't exist (for backwards compatibility)
    await jobStateService.createJob(jobId, {
      status: 'processing',
      message: message.initialMessage || 'Starting export job',
      progress: 0,
      startTime: new Date().toISOString(),
    });
    logger.info('Created new export job (fallback)', { jobId });
    return true;
  }

  const redeliveryOk = await guardExportRedelivery(
    jobStateService,
    jobId,
    existingJob,
    receiveCount,
    isContinuation
  );
  if (!redeliveryOk) {
    return false;
  }

  // Re-entrant, so continuation invocations re-acquire (and thereby refresh
  // the lock expiry each hop)
  if (!(await guardSingleExportSlot(jobStateService, jobId))) {
    return false;
  }

  // Job exists and is ours to run: mark processing
  await jobStateService.updateJobStatus(jobId, {
    status: 'processing',
    message: isContinuation
      ? `Resuming export (continuation ${message.continuationCount || 1})`
      : 'Starting export job',
    ...(isContinuation ? {} : { progress: 0 }),
  });
  logger.info('Updated existing export job to processing', { jobId, isContinuation });
  return true;
}

/**
 * Redelivery guards: drop zombie messages for terminal jobs, cap retries of
 * died workers, and refuse to run concurrently with a live invocation.
 * Returns false when the delivery must be dropped.
 */
async function guardExportRedelivery(
  jobStateService: JobStateService,
  jobId: string,
  existingJob: { status: string; startTime: string; lastUpdatedTime?: string },
  receiveCount: number,
  isContinuation: boolean
): Promise<boolean> {
  // Terminal job: this is a redelivered zombie message - drop it.
  if (['completed', 'stopped', 'failed'].includes(existingJob.status)) {
    logger.info('Dropping redelivered message for terminal export job', {
      jobId,
      status: existingJob.status,
      receiveCount,
    });
    return false;
  }

  if (receiveCount > WORKER_CONFIG.EXPORT_MAX_RECEIVE_COUNT) {
    logger.error('Export message redelivered too many times - failing job', {
      jobId,
      receiveCount,
    });
    await jobStateService.updateJobStatus(jobId, {
      status: 'failed',
      endTime: new Date().toISOString(),
      message: `Export failed: worker died ${receiveCount - 1} times (likely timeout/OOM). Start a new export to retry.`,
      error: 'Max redeliveries exceeded',
    });
    return false;
  }

  // Redelivery of an active job: if its heartbeat is fresh, another
  // invocation is still working on it - don't process concurrently.
  // (A stale heartbeat would already have been auto-failed by the
  // cleanupStuckJobs sweep that runs before this.)
  if (receiveCount > 1 && !isContinuation) {
    const lastHeartbeat = new Date(existingJob.lastUpdatedTime || existingJob.startTime).getTime();
    const heartbeatAge = Date.now() - lastHeartbeat;
    const freshMs = JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES * TIME_UNITS.MINUTE;
    if (heartbeatAge < freshMs) {
      logger.warn('Dropping redelivered message - job appears actively processed elsewhere', {
        jobId,
        receiveCount,
      });
      return false;
    }
    await jobStateService.logWarn(
      jobId,
      `Retrying export after a died worker (delivery attempt ${receiveCount})`
    );
  }

  return true;
}

/**
 * Only one export job may run at a time (any mode). Enforced by an atomic
 * conditional-write lock in DynamoDB - race-free, auto-expiring (stuck-job
 * timeout), re-entrant for continuations, and released on terminal status
 * writes. The API's 409 check is the friendly front door; this is the
 * authoritative gate.
 */
async function guardSingleExportSlot(
  jobStateService: JobStateService,
  jobId: string
): Promise<boolean> {
  const acquired = await jobStateService.acquireExportLock(jobId);
  if (!acquired) {
    logger.warn('Export job blocked - another export holds the export lock', {
      blockedJobId: jobId,
    });
    await jobStateService.updateJobStatus(jobId, {
      status: 'failed',
      endTime: new Date().toISOString(),
      message: 'Another export job is already running',
      error: 'Duplicate export blocked',
    });
    return false;
  }
  return true;
}

/**
 * Execute an export job. When the orchestrator pauses before the Lambda
 * timeout, requeue a continuation message for the same job - the checkpoint
 * on the job record lets the next invocation resume where this one stopped.
 */
async function executeExportJob(
  jobStateService: JobStateService,
  jobId: string,
  exportOrchestrator: ExportOrchestrator,
  message: ExportMessage,
  deadlineAt: number | null
): Promise<void> {
  const options = message.options;

  // Set the job state service for the orchestrator
  exportOrchestrator.setJobStateService(jobStateService, jobId);
  exportOrchestrator.setExecutionDeadline(deadlineAt);

  // Prepare export options
  const exportOptions: any = {
    forceRefresh: options.forceRefresh,
    rebuildIndex: options.rebuildIndex,
    refreshOptions: options.refreshOptions,
  };

  // Only include assetTypes if provided (not for cache-only exports)
  if (options.assetTypes) {
    exportOptions.assetTypes = options.assetTypes as AssetType[];
  }

  // Execute the export with progress tracking
  const result = await exportOrchestrator.exportAssets(exportOptions);

  if (result.incomplete) {
    await requeueExportContinuation(jobStateService, jobId, message, result.remainingAssetTypes);
    return; // job stays 'processing'; final status comes from the last hop
  }

  const jobAfterRun = await jobStateService.getJobStatus(jobId);
  if (jobAfterRun?.status === 'stopped') {
    logger.info('Export job was stopped by user', { jobId });
    return; // don't overwrite the stopped status
  }

  // Mark job as completed with stats. Include the per-operation counts the
  // orchestrator tracked (api.* / s3.* namespaces) — the job history's
  // "API Calls" column sums the api.* entries.
  await jobStateService.updateJobStatus(jobId, {
    status: 'completed',
    progress: 100,
    endTime: new Date().toISOString(),
    message: `Export completed: ${result.totals.processed} assets processed`,
    stats: {
      totalAssets: result.totals.listed,
      processedAssets: result.totals.processed,
      failedAssets: result.totals.failed,
      operations: exportOrchestrator.getOperationStats(),
    },
  });

  logger.info('Export job completed successfully', {
    jobId,
    totals: result.totals,
    duration: result.duration,
  });
}

/**
 * Requeue the export message so a fresh invocation (with a fresh 15-minute
 * budget) continues the same job from its checkpoint.
 */
async function requeueExportContinuation(
  jobStateService: JobStateService,
  jobId: string,
  message: ExportMessage,
  remainingAssetTypes?: string[]
): Promise<void> {
  const continuationCount = (message.continuationCount || 0) + 1;
  const continuationMessage: ExportMessage = {
    ...message,
    jobType: 'export',
    continuation: true,
    continuationCount,
  };

  await jobStateService.updateJobStatus(jobId, {
    status: 'processing',
    message: `Paused before Lambda timeout - continuing in a new invocation${
      remainingAssetTypes?.length ? ` (remaining: ${remainingAssetTypes.join(', ')})` : ''
    }`,
  });

  // Local development has no SQS loop - re-enter this worker's own handler on
  // the next event-loop tick (mirrors localDevelopment.executeJobLocallyAsync
  // without importing it, which would create a module cycle)
  const isLocalDev =
    process.env.AWS_SAM_LOCAL === 'true' ||
    process.env.IS_LOCAL === 'true' ||
    (process.env.NODE_ENV === 'development' && process.env.DIRECT_WORKER_EXECUTION === 'true');
  if (isLocalDev) {
    globalThis.setTimeout(() => {
      const mockEvent = {
        Records: [
          {
            messageId: `continuation-${jobId}-${continuationCount}`,
            body: JSON.stringify(continuationMessage),
            attributes: { ApproximateReceiveCount: '1' },
            eventSource: 'aws:sqs',
          },
        ],
      } as unknown as SQSEvent;
      handler(mockEvent, {} as Context).catch((error) => {
        logger.error('Local export continuation failed', { jobId, error });
      });
    }, 0);
  } else {
    await queueService.sendMessage(continuationMessage as any);
  }

  logger.info('Requeued export continuation', {
    jobId,
    continuationCount,
    remainingAssetTypes,
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
