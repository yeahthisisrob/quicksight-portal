/* global setInterval, clearInterval, setTimeout */
import type { Context, SQSEvent } from 'aws-lambda';

import { ActivityRefreshProcessor } from './features/activity/processors/ActivityRefreshProcessor';
import { warmCollectionSnapshots } from './features/asset-management/services/collectionSnapshotWarmer';
import { ExportOrchestrator } from './features/data-export/services/ExportOrchestrator';
import { SmusExportProcessor } from './features/smus/processors/SmusExportProcessor';
import type { SmusConfig } from './shared/config/smusConfig';
import { JOB_CONFIG, STORAGE_LIMITS, TIME_UNITS, WORKER_CONFIG } from './shared/constants';
import type { AssetType } from './shared/models/asset.model';
import { summarizeBulkResult } from './shared/services/bulk/bulkResultSummary';
import { cacheService } from './shared/services/cache/CacheService';
import { JobStateService } from './shared/services/jobs/JobStateService';
import { queueService } from './shared/services/jobs/QueueService';
import { logger } from './shared/utils/logger';

// Composition root: wire cross-slice derived-data recomputation here so
// feature slices (data-export, activity) trigger it via cacheService hooks
// instead of importing asset-management's warmer directly (import cycle)
cacheService.registerCacheRebuildHook(warmCollectionSnapshots);

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

interface SmusExportMessage {
  jobId: string;
  jobType: 'smus-export';
  accountId: string;
  userId?: string;
  options?: { smus?: SmusConfig };
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

interface PlannerMessage {
  jobId: string;
  jobType: 'planner';
  accountId: string;
  userId?: string;
  initialMessage?: string;
  /** A catalog model key chosen by the caller. */
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

interface AssetRefreshMessage {
  jobId: string;
  jobType: 'asset-refresh';
  accountId: string;
  assets: Array<{ assetType: AssetType; assetId: string }>;
}

interface AssistantMessage {
  jobId: string;
  jobType: 'assistant';
  accountId: string;
  model: string;
  authoringModel?: string;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  threadId?: string;
  state?: any;
  resume?: any[];
  auth: {
    userId: string;
    accountId: string;
    email?: string;
    groups?: string[];
    apiKey?: { id: string; label: string };
  };
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
 * Worker Lambda handler for processing the portal's jobs from SQS
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
          memoryUsage: `${Math.round(
            process.memoryUsage().heapUsed /
              STORAGE_LIMITS.CHUNK_SIZE_KB /
              STORAGE_LIMITS.CHUNK_SIZE_KB
          )}MB`,
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
    if (rawMessage.jobType === 'activity-refresh') {
      await processActivityRefreshJob(rawMessage as ActivityRefreshMessage, record);
    } else if (rawMessage.jobType === 'smus-export') {
      await processSmusExportJob(rawMessage as SmusExportMessage, record);
    } else if (rawMessage.jobType === 'bulk-operation') {
      await processBulkOperationJob(rawMessage as BulkOperationMessage, record);
    } else if (rawMessage.jobType === 'csv-export') {
      await processCSVExportJob(rawMessage as CSVExportMessage, record);
    } else if (rawMessage.jobType === 'planner') {
      await processPlannerJob(rawMessage as PlannerMessage, record);
    } else if (rawMessage.jobType === 'assistant') {
      await processAssistantJob(rawMessage as AssistantMessage, record);
    } else if (rawMessage.jobType === 'asset-refresh') {
      await processAssetRefreshJob(rawMessage as AssetRefreshMessage);
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
 * Process a SMUS export job: one sweep of the DataZone domain into the
 * SMUS snapshot that Settings, Author and the catalog read.
 */
async function processSmusExportJob(message: SmusExportMessage, record: any): Promise<void> {
  const { jobId } = message;
  logger.info('Processing SMUS export job', { jobId, messageId: record.messageId });

  const jobStateService = new JobStateService('smus-export');
  try {
    await cleanupStuckJobs(jobStateService, 'smus-export');
    const existing = await jobStateService.getJobStatus(jobId);
    if (!existing) {
      await jobStateService.createJob(jobId, {
        status: 'processing',
        message: 'SMUS export started',
        startTime: new Date().toISOString(),
      });
    }
    await new SmusExportProcessor(jobStateService, jobId).run(message.options?.smus);
  } catch (error) {
    logger.error('SMUS export job failed', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    await jobStateService.updateJobStatus(jobId, {
      status: 'failed',
      endTime: new Date().toISOString(),
      message: `SMUS export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
  const { BulkOperationsProcessor } = await import(
    './shared/services/bulk/BulkOperationsProcessor'
  );
  // Deletes archive what QuickSight has now: each record is re-exported first.
  const bulkProcessor = new BulkOperationsProcessor(msgAccountId, {
    refreshAssets: (assets) => new ExportOrchestrator(msgAccountId).refreshAssets(assets),
  });

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

    // Mark job as completed (processor should have done this, but ensure it's done).
    // Partial failures ride along on the record: `error` carries the distinct
    // reasons, `failures` the offending items - so "1 failed" is actionable.
    const summary = summarizeBulkResult(result);
    await jobStateService.updateJobStatus(jobId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      message: summary.message,
      ...(summary.error && { error: summary.error, failures: summary.failures }),
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
  public constructor(jobId: string) {
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
/**
 * A planner call as a job: the model is asked, and its proposal is the
 * job's result. Nothing is written to QuickSight here; the caller reviews
 * the proposal and applies it through the authoring endpoints.
 */
async function processPlannerJob(message: PlannerMessage, record: any): Promise<void> {
  const { jobId, accountId: msgAccountId, request } = message;
  logger.info('Processing planner job', { jobId, messageId: record.messageId, kind: request.kind });
  const jobStateService = new JobStateService('planner');

  try {
    const existing = await jobStateService.getJobStatus(jobId);
    if (existing) {
      await jobStateService.updateJobStatus(jobId, {
        status: 'processing',
        message: 'Asking the planner',
        progress: 0,
      });
    } else {
      await jobStateService.createJob(jobId, {
        status: 'processing',
        message: 'Asking the planner',
        startTime: new Date().toISOString(),
      });
    }

    const [{ RebindService }, { PlannerService }, { createPlannerModel }] = await Promise.all([
      import('./features/authoring/services/RebindService'),
      import('./features/authoring/services/planner/PlannerService'),
      import('./features/authoring/services/planner/createPlannerModel'),
    ]);
    const rebind = new RebindService(msgAccountId);
    const [{ isAiModelKey }, { settingsStore }, { readAuthoringGuidance }] = await Promise.all([
      import('./shared/ai/modelCatalog'),
      import('./shared/services/settings/SettingsStore'),
      import('./shared/ai/authoringGuidance'),
    ]);
    // The organisation's authoring guidance lives in Settings.
    await settingsStore.load();
    const planner = new PlannerService(
      rebind,
      createPlannerModel(undefined, isAiModelKey(message.model) ? message.model : undefined),
      undefined,
      { guidance: readAuthoringGuidance() }
    );

    let result: unknown;
    if (request.kind === 'propose') {
      result = await planner.propose(request.assetType, request.assetId, {
        ask: request.ask,
        candidateDataSetIds: request.candidateDataSetIds,
      });
    } else {
      const { NewAssetService } = await import('./features/authoring/services/NewAssetService');
      result = await new NewAssetService(msgAccountId, rebind, planner).preview(
        request.newAsset as any
      );
    }

    const { JobRepository } = await import('./shared/services/jobs/JobRepository');
    await new JobRepository().saveJobResult(jobId, result);
    await jobStateService.updateJobStatus(jobId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      message: 'The planner answered',
      progress: 100,
    });
    logger.info('Planner job completed', { jobId, kind: request.kind });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    logger.error('Planner job failed', { jobId, error: messageText });
    await jobStateService.updateJobStatus(jobId, {
      status: 'failed',
      endTime: new Date().toISOString(),
      message: messageText,
      error: messageText,
    });
  }
}

/**
 * One message to the assistant. The worker is the composition root here:
 * it gives the assistant a way to call the portal's own routes in-process,
 * as the person who asked, through the same handler the API Lambda runs.
 */
const ASSISTANT_PROGRESS_CEILING = 95;
const ASSISTANT_MS_PER_SECOND = 1_000;

/**
 * Re-export what the portal just wrote and upsert its cache entries, so a
 * new or changed asset shows up without a full export.
 */
async function processAssetRefreshJob(message: AssetRefreshMessage): Promise<void> {
  const { jobId, accountId: refreshAccountId, assets } = message;
  const jobStateService = new JobStateService('asset-refresh');
  try {
    if (await jobStateService.getJobStatus(jobId)) {
      await jobStateService.updateJobStatus(jobId, {
        status: 'processing',
        message: 'Refreshing the cache',
        progress: 0,
      });
    } else {
      await jobStateService.createJob(jobId, {
        status: 'processing',
        message: 'Refreshing the cache',
        startTime: new Date().toISOString(),
      });
    }
    const orchestrator = new ExportOrchestrator(refreshAccountId);
    const result = await orchestrator.refreshAssets(assets ?? []);
    logger.info('Asset refresh completed', { jobId, ...result });
    await jobStateService.updateJobStatus(jobId, {
      status: result.failed.length === 0 ? 'completed' : 'failed',
      endTime: new Date().toISOString(),
      progress: 100,
      message: [
        `Refreshed ${result.refreshed.length}`,
        result.missing.length ? `not listed yet: ${result.missing.join(', ')}` : '',
        result.failed.length ? `failed: ${result.failed.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('; '),
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    logger.error('Asset refresh failed', { jobId, error: text });
    await jobStateService.updateJobStatus(jobId, {
      status: 'failed',
      endTime: new Date().toISOString(),
      message: text,
      error: text,
    });
  }
}

async function processAssistantJob(message: AssistantMessage, record: any): Promise<void> {
  const { jobId } = message;
  logger.info('Processing assistant job', {
    jobId,
    messageId: record.messageId,
    model: message.model,
  });
  const jobStateService = new JobStateService('assistant');
  try {
    if (await jobStateService.getJobStatus(jobId)) {
      await jobStateService.updateJobStatus(jobId, {
        status: 'processing',
        message: 'Assistant thinking',
        progress: 0,
      });
    } else {
      await jobStateService.createJob(jobId, {
        status: 'processing',
        message: 'Assistant thinking',
        startTime: new Date().toISOString(),
      });
    }
    const [
      { aiModel, isAiModelKey, openAiModelId },
      { BedrockAdapter },
      { getPlannerConfig },
      { BedrockChatModel, OpenAiChatModel },
      { AssistantService },
      { apiHandler },
      { withInProcessAuth },
      { settingsStore },
      { readAuthoringGuidance },
      { readCustomVocabulary },
      { getSmusConfig },
    ] = await Promise.all([
      import('./shared/ai/modelCatalog'),
      import('./adapters/aws/BedrockAdapter'),
      import('./shared/config/plannerConfig'),
      import('./features/assistant/services/ChatModel'),
      import('./features/assistant/services/AssistantService'),
      import('./api/apiHandler'),
      import('./shared/auth'),
      import('./shared/services/settings/SettingsStore'),
      import('./shared/ai/authoringGuidance'),
      import('./shared/ai/authoringVocabulary'),
      import('./shared/config/smusConfig'),
    ]);
    await settingsStore.load();
    if (!isAiModelKey(message.model)) {
      throw new Error(`Unknown model '${message.model}'`);
    }
    const model = aiModel(message.model);
    const config = getPlannerConfig();
    const chat =
      model.provider === 'openai'
        ? new OpenAiChatModel(config.openAi.baseUrl, config.openAi.apiKey, openAiModelId(), model)
        : new BedrockChatModel(new BedrockAdapter(config.region), model);
    const dispatch = async (req: { method: string; path: string; body?: unknown }) => {
      const url = new URL(req.path, 'http://portal.internal');
      const query = Object.fromEntries(url.searchParams.entries());
      const event = withInProcessAuth(
        {
          httpMethod: req.method,
          path: url.pathname,
          resource: url.pathname,
          headers: { 'Content-Type': 'application/json' },
          multiValueHeaders: {},
          queryStringParameters: Object.keys(query).length ? query : null,
          multiValueQueryStringParameters: null,
          pathParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          body: req.body === undefined ? null : JSON.stringify(req.body),
          isBase64Encoded: false,
        },
        message.auth
      );
      const response = await apiHandler(event);
      return { status: response.statusCode, body: response.body };
    };
    const started = Date.now();
    const result = await new AssistantService(chat, model, dispatch, {
      brief: true,
      smus: getSmusConfig().enabled,
      guidance: readAuthoringGuidance(),
      vocabulary: readCustomVocabulary(),
      ...(message.authoringModel && isAiModelKey(message.authoringModel)
        ? { authoringModel: message.authoringModel }
        : {}),
      // Each step lands on the job, so the page can say what it is doing.
      onProgress: (step) =>
        jobStateService.updateJobStatus(jobId, {
          status: 'processing',
          message: step,
          // Seconds elapsed, held short of done: there is no real percentage to show.
          progress: Math.min(
            ASSISTANT_PROGRESS_CEILING,
            Math.round((Date.now() - started) / ASSISTANT_MS_PER_SECOND)
          ),
        }),
    }).respond(message.messages, {
      ...(message.threadId ? { threadId: message.threadId } : {}),
      ...(message.state ? { state: message.state } : {}),
      ...(message.resume ? { resume: message.resume } : {}),
    });
    const { JobRepository } = await import('./shared/services/jobs/JobRepository');
    await new JobRepository().saveJobResult(jobId, result);
    await jobStateService.updateJobStatus(jobId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      message: `Answered in ${result.rounds} step${result.rounds === 1 ? '' : 's'}`,
      progress: 100,
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    logger.error('Assistant job failed', { jobId, error: text });
    await jobStateService.updateJobStatus(jobId, {
      status: 'failed',
      endTime: new Date().toISOString(),
      message: text,
      error: text,
    });
  }
}

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
  const { CSVExportProcessor } = await import(
    './features/asset-management/processors/CSVExportProcessor'
  );
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
