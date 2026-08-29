/**
 * JobRepository - Centralized job storage and retrieval
 *
 * Storage model (single DynamoDB table, composite key pk/sk):
 * - Job records: item { pk: jobId, sk: 'META' }. Per-job items make every
 *   write atomic. A GSI (gsi1pk='JOB', sort key startTime) serves
 *   newest-first listings; a TTL attribute (expiresAt) is the retention
 *   backstop.
 * - Job logs: one item per entry { pk: jobId, sk: 'LOG#<ts>#<seq>' }. Each
 *   appendLog is a single atomic put; the poller reads them back
 *   chronologically with one consistent query, and TTL cleans them up with
 *   the job.
 * - Job results live on the job item too. A result that would threaten the
 *   400KB item limit is replaced with a truncation marker (loud in the logs;
 *   in practice results are small metadata - the CSV export is the one
 *   producer that can exceed it, and rarely).
 * - The single-export mutex is a conditional-write lock item - race-free,
 *   auto-expiring, re-entrant for continuation invocations of the same job.
 */

import { JOB_CONFIG, JOB_LIMITS, TIME_UNITS } from '../../constants';
import { logger } from '../../utils/logger';
import { DynamoDBService, isConditionalCheckFailed } from '../aws/DynamoDBService';

export type JobType =
  | 'export'
  | 'deploy'
  | 'ingestion'
  | 'rebuild'
  | 'activity-refresh'
  | 'bulk-operation'
  | 'csv-export';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';

export type JobPhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * Progress checkpoint for resumable export jobs. Written only when it
 * changes (its own atomic SET - heartbeats don't carry it). Kept lean
 * anyway: it shares the job item's 400KB budget and the FE receives it on
 * every status poll, so it should stay summary-shaped (names and counts,
 * never per-asset payloads).
 */
export interface ExportCheckpoint {
  /** Asset types fully exported (and cache-upserted) in earlier invocations */
  completedAssetTypes?: string[];
  /** Types whose per-type cache was hydrated from S3 this job (cache was
   *  missing) - the catalog/lineage/field caches must be rebuilt even when
   *  zero assets were re-exported, or they stay empty after a cache wipe. */
  hydratedAssetTypes?: string[];
  /** All asset phases done; only the catalog/lineage/field rebuild remains */
  catalogPending?: boolean;
  /** Assets processed across ALL invocations of this job (drives the
   *  "does the catalog need rebuilding" decision on the final invocation) */
  totalProcessed?: number;
  updatedAt?: string;
}

/**
 * Optional step-based progress reported alongside the global percent.
 * Job types opt in by emitting a fixed-length array of phases — others
 * leave it undefined and consumers fall back to the linear progress bar.
 */
export interface JobPhase {
  key: string;
  status: JobPhaseStatus;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  counts?: {
    processed?: number;
    total?: number;
    newEvents?: number;
    truncated?: number;
    errors?: number;
  };
}

export interface JobMetadata {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  progress?: number;
  message?: string;
  startTime: string;
  /**
   * Heartbeat: stamped on every job write (status/progress updates). Dead-job
   * detection uses this rather than startTime, so long-running jobs that keep
   * reporting progress are never falsely killed.
   */
  lastUpdatedTime?: string;
  endTime?: string;
  duration?: number;
  userId?: string;
  accountId?: string;

  // Type-specific metadata
  assetType?: string; // For deploy jobs
  assetId?: string; // For deploy jobs
  deploymentType?: string; // For deploy jobs
  exportOptions?: any; // For export jobs

  // Stats
  stats?: {
    totalAssets?: number;
    processedAssets?: number;
    failedAssets?: number;
    operations?: Record<string, number>; // Generic operation tracking
  };

  // Optional step-based progress for multi-phase jobs (e.g. activity-refresh).
  phases?: JobPhase[];

  /**
   * Resumable-export progress. Written after each asset type completes so a
   * continuation invocation (the worker requeues itself before the 15-min
   * Lambda wall) can skip finished work instead of starting over.
   */
  checkpoint?: ExportCheckpoint;

  // Error info
  error?: string;
  errorStack?: string;

  // Control flags
  stopRequested?: boolean;

  // Job result data (oversized results are truncated, see saveJobResult)
  result?: any;
}

export interface JobLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: any;
}

export interface JobListOptions {
  jobType?: JobType;
  status?: JobStatus;
  userId?: string;
  limit?: number;
  afterDate?: Date;
  beforeDate?: Date;
}

/** Item shape stored in DynamoDB: the job plus key/index/TTL attributes */
type JobItem = JobMetadata & { pk?: string; sk?: string; gsi1pk?: string; expiresAt?: number };

const GSI_NAME = 'byStartTime';
const GSI_PARTITION_VALUE = 'JOB'; // constant partition: job volume is tiny
const META_SK = 'META';
const LOG_SK_PREFIX = 'LOG#';
const EXPORT_LOCK_ID = '__export-lock__';
/** DynamoDB items cap at 400KB - refuse results that would threaten it */
const RESULT_MAX_BYTES = 358400; // 350 KB
/** TTL grace beyond retention so cleanupOldJobs normally wins the race
 *  against the TTL backstop (TTL deletion can lag up to ~48h) */
const TTL_GRACE_DAYS = 7;
const QUERY_FETCH_LIMIT = 500;
const MS_PER_SECOND = 1000;
const SECONDS_PER_DAY = 86400;
/** Lock TTL backstop = 2x the lock's own expiry */
const LOCK_TTL_FACTOR = 2;
/** Sequence pad width keeps LOG# sort keys lexicographically ordered */
const LOG_SEQ_PAD = 6;

export class JobRepository {
  /** Per-process log sequence + count per job: the worker is the only log
   *  writer for its job, so this both orders same-millisecond entries and
   *  caps runaway logging per invocation. */
  private static readonly logCounters = new Map<string, number>();
  private readonly dynamo: DynamoDBService;
  private readonly tableName: string;

  constructor() {
    this.dynamo = new DynamoDBService();
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.tableName = process.env.JOBS_TABLE_NAME || `quicksight-portal-jobs-${accountId}`;
  }

  /**
   * Acquire the single-export lock via conditional write. Succeeds when the
   * lock is free, expired, or already held by this job (re-entrant, so
   * continuation invocations of the same export re-acquire it). Expires after
   * the stuck-job timeout, so a died worker can never wedge exports.
   */
  public async acquireExportLock(jobId: string): Promise<boolean> {
    await this.ensureReady();
    const now = Date.now();
    try {
      await this.dynamo.putItem(
        this.tableName,
        {
          pk: EXPORT_LOCK_ID,
          sk: META_SK,
          ownerJobId: jobId,
          acquiredAt: new Date(now).toISOString(),
          lockExpiresAt: now + JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES * TIME_UNITS.MINUTE,
          expiresAt:
            Math.ceil(now / MS_PER_SECOND) +
            ((JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES * TIME_UNITS.MINUTE) / MS_PER_SECOND) *
              LOCK_TTL_FACTOR,
        },
        'attribute_not_exists(pk) OR lockExpiresAt < :now OR ownerJobId = :owner',
        { ':now': now, ':owner': jobId }
      );
      return true;
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Append a log entry: one atomic put of one small item - no reads, no
   * race with status writes. Per-invocation cap guards against runaway
   * logging.
   */
  public async appendLog(jobId: string, log: JobLog): Promise<void> {
    const seq = (JobRepository.logCounters.get(jobId) || 0) + 1;
    JobRepository.logCounters.set(jobId, seq);
    if (seq > JOB_LIMITS.MAX_LOG_ENTRIES) {
      if (seq === JOB_LIMITS.MAX_LOG_ENTRIES + 1) {
        logger.warn('Job log cap reached - dropping further entries this invocation', { jobId });
      }
      return;
    }

    await this.ensureReady();
    await this.dynamo.putItem(this.tableName, {
      pk: jobId,
      sk: `${LOG_SK_PREFIX}${log.timestamp}#${String(seq).padStart(LOG_SEQ_PAD, '0')}`,
      ...log,
      expiresAt:
        Math.ceil(Date.now() / MS_PER_SECOND) +
        (JOB_CONFIG.DEFAULT_RETENTION_DAYS + TTL_GRACE_DAYS) * SECONDS_PER_DAY,
    });
  }

  /**
   * Clean up jobs past the retention window (meta + log items). The table's
   * TTL attribute is only the backstop - this sweep keeps listings tidy
   * without waiting on TTL's up-to-48h lag.
   */
  public async cleanupOldJobs(
    daysToKeep: number = JOB_CONFIG.DEFAULT_RETENTION_DAYS
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const oldJobs = await this.listJobs({ beforeDate: cutoffDate, limit: QUERY_FETCH_LIMIT });

    for (const job of oldJobs) {
      await this.deleteJob(job.jobId);
    }

    if (oldJobs.length > 0) {
      logger.info(`Cleaned up ${oldJobs.length} old jobs`);
    }
    return oldJobs.length;
  }

  /**
   * Mark dead jobs as failed.
   *
   * A job is dead when it is in a non-terminal status (queued / processing /
   * stopping) and its heartbeat (`lastUpdatedTime`, falling back to
   * `startTime`) is older than the timeout. Worker Lambdas cap out at 15
   * minutes and stamp the heartbeat on every progress write, so a silent
   * 30-minute gap proves the run died (crash / timeout / OOM).
   *
   * This runs automatically inside listJobs()/getJob() (self-healing on read),
   * so no manual "clear stuck jobs" action is ever needed. Kept public for the
   * worker's pre-run sweep.
   */
  public async cleanupStuckJobs(
    timeoutMinutes: number = JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES
  ): Promise<number> {
    const allJobs = await this.queryAllJobs();
    return await this.repairDeadJobs(allJobs, timeoutMinutes);
  }

  /**
   * Create a new job with metadata (immediately visible to other Lambdas -
   * per-job items need no separate persistence step)
   */
  public async createJob(metadata: JobMetadata): Promise<void> {
    await this.ensureReady();
    await this.putJob({ ...metadata, lastUpdatedTime: new Date().toISOString() });
    logger.info('Job created', { jobId: metadata.jobId, jobType: metadata.jobType });
  }

  /**
   * Delete a job and all its data (meta + log items)
   */
  public async deleteJob(jobId: string): Promise<void> {
    // The whole partition: META item plus every LOG# item
    const items = await this.dynamo.queryPartition<{ pk: string; sk: string }>(
      this.tableName,
      'pk',
      jobId
    );
    if (items.length > 0) {
      await this.dynamo.batchDelete(
        this.tableName,
        items.map(({ pk, sk }) => ({ pk, sk }))
      );
    }
    logger.info('Job deleted', { jobId, itemsDeleted: items.length });
  }

  /**
   * Get job metadata (strongly consistent read)
   */
  public async getJob(jobId: string): Promise<JobMetadata | null> {
    try {
      await this.ensureReady();
      const item = await this.dynamo.getItem<JobItem>(this.tableName, { pk: jobId, sk: META_SK });
      if (!item) {
        return null;
      }
      // Self-healing: a poller watching a job whose worker died sees it flip
      // to 'failed' instead of spinning forever. The repair pass replaces
      // array slots, so read the (possibly repaired) job back from the array.
      const jobs: JobItem[] = [item];
      await this.repairDeadJobs(jobs);
      return this.toMetadata(jobs[0] as JobItem);
    } catch (error: any) {
      logger.error('Failed to get job', { jobId, error: error.message });
      return null;
    }
  }

  /**
   * Get job logs, chronological (one consistent partition query)
   */
  public async getJobLogs(jobId: string): Promise<JobLog[]> {
    await this.ensureReady();
    const items = await this.dynamo.queryPartition<JobLog & { pk: string; sk: string }>(
      this.tableName,
      'pk',
      jobId,
      { sortKeyBeginsWith: { name: 'sk', prefix: LOG_SK_PREFIX } }
    );
    return items.map(({ pk: _pk, sk: _sk, expiresAt: _e, ...log }: any) => log as JobLog);
  }

  /**
   * Get job result data (if any)
   */
  public async getJobResult<T = any>(jobId: string): Promise<T | null> {
    try {
      await this.ensureReady();
      const item = await this.dynamo.getItem<JobItem>(this.tableName, { pk: jobId, sk: META_SK });
      return (item?.result as T) || null;
    } catch (error: any) {
      logger.error('Failed to get job result', { jobId, error: error.message });
      return null;
    }
  }

  /**
   * Check if stop has been requested for a job
   */
  public async isStopRequested(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    return job?.stopRequested === true || job?.status === 'stopping';
  }

  /**
   * List jobs with filtering (newest first via the byStartTime GSI)
   */
  public async listJobs(options: JobListOptions = {}): Promise<JobMetadata[]> {
    const { jobType, status, userId, limit = 50, afterDate, beforeDate } = options;

    try {
      const allJobs = await this.queryAllJobs(
        beforeDate ? { sortKeyBefore: beforeDate.toISOString() } : {}
      );

      // Self-healing: repair dead jobs before answering. This also unblocks
      // single-flight guards (e.g. activity refresh) that treat a stuck
      // 'processing' job as still active.
      await this.repairDeadJobs(allJobs);

      // Single declarative pass: every provided option must match
      const matchesFilters = (job: JobMetadata): boolean =>
        (!jobType || job.jobType === jobType) &&
        (!status || job.status === status) &&
        (!userId || job.userId === userId) &&
        (!afterDate || new Date(job.startTime) >= afterDate) &&
        (!beforeDate || new Date(job.startTime) <= beforeDate);
      const filtered = allJobs.filter(matchesFilters);

      // The GSI already returns newest-first; keep an explicit sort for
      // determinism (equal timestamps)
      filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      return filtered.slice(0, limit).map((job) => this.toMetadata(job as JobItem));
    } catch (error: any) {
      logger.error('Failed to list jobs', {
        error: error.message,
        errorName: error.name,
        options,
        tableName: this.tableName,
      });
      return [];
    }
  }

  /**
   * Release the single-export lock (only if this job holds it). Safe to call
   * unconditionally on terminal status writes.
   */
  public async releaseExportLock(jobId: string): Promise<void> {
    try {
      await this.dynamo.deleteItem(
        this.tableName,
        { pk: EXPORT_LOCK_ID, sk: META_SK },
        'ownerJobId = :owner',
        { ':owner': jobId }
      );
    } catch (error) {
      if (!isConditionalCheckFailed(error)) {
        logger.warn('Failed to release export lock', { jobId, error });
      }
    }
  }

  /**
   * Request job to stop
   */
  public async requestStop(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await this.updateJob(jobId, {
      stopRequested: true,
      status: 'stopping',
      message: 'Stop requested by user',
    });
  }

  /**
   * Save job result data on the job item. Results beyond the size threshold
   * are replaced with a truncation marker so the item never nears the 400KB
   * limit.
   */
  public async saveJobResult<T = any>(jobId: string, result: T): Promise<void> {
    await this.ensureReady();

    let stored: any = result;
    const sizeBytes = JSON.stringify(result).length;
    if (sizeBytes > RESULT_MAX_BYTES) {
      // Loud, not silent: consumers see a truncation marker instead of a
      // corrupt payload, and the log names the culprit
      logger.error('Job result exceeds the DynamoDB size budget - storing truncation marker', {
        jobId,
        sizeBytes,
        maxBytes: RESULT_MAX_BYTES,
      });
      stored = {
        truncated: true,
        message: `Result too large to store (${sizeBytes} bytes > ${RESULT_MAX_BYTES})`,
      };
    }

    // Atomic partial write onto the existing record (no read)
    try {
      await this.dynamo.updateItem(
        this.tableName,
        { pk: jobId, sk: META_SK },
        { set: { result: stored, lastUpdatedTime: new Date().toISOString() } },
        'attribute_exists(pk)'
      );
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        throw new Error(`Job ${jobId} not found`);
      }
      throw error;
    }
  }

  /**
   * Update job metadata as ONE atomic partial write (UpdateItem): only the
   * provided fields are touched, so concurrent writers to the same job (a
   * worker heartbeat vs. the API setting stopRequested) can never clobber
   * each other, and a routine heartbeat costs zero reads. Terminal writes
   * (endTime present) do one read to compute duration and learn the jobType.
   */
  public async updateJob(jobId: string, updates: Partial<JobMetadata>): Promise<void> {
    await this.ensureReady();
    const now = new Date().toISOString();

    const set: Record<string, any> = { ...updates, lastUpdatedTime: now };
    delete set.jobId;

    let jobType: JobType | undefined = updates.jobType;
    if (updates.endTime) {
      const current = await this.dynamo.getItem<JobItem>(this.tableName, {
        pk: jobId,
        sk: META_SK,
      });
      if (!current) {
        // Upsert rather than throw: a lost record must not turn a SUCCESSFUL
        // run into a spurious "failed" job via the caller's error handler
        logger.warn('Job missing during update - upserting minimal record', { jobId });
      }
      set.duration =
        new Date(updates.endTime).getTime() - new Date(current?.startTime || now).getTime();
      jobType = jobType || current?.jobType;
    }

    await this.dynamo.updateItem(
      this.tableName,
      { pk: jobId, sk: META_SK },
      {
        set,
        // Upsert defaults so a recreated record is valid and queryable
        setIfNotExists: {
          jobId,
          jobType: jobType || 'export',
          status: 'processing',
          startTime: now,
          gsi1pk: GSI_PARTITION_VALUE,
          expiresAt:
            Math.ceil(Date.now() / MS_PER_SECOND) +
            (JOB_CONFIG.DEFAULT_RETENTION_DAYS + TTL_GRACE_DAYS) * SECONDS_PER_DAY,
        },
        // A job completing successfully must not carry a stale auto-fail error
        // (e.g. a "no heartbeat" stamp from the stuck-job sweep) forward
        remove: updates.status === 'completed' && updates.error === undefined ? ['error'] : [],
      }
    );

    // Terminal export jobs free the single-export mutex (conditional on
    // ownership, so this is a no-op for every other job type)
    const isTerminal = updates.status
      ? ['completed', 'failed', 'stopped'].includes(updates.status)
      : false;
    if (isTerminal && (jobType || 'export') === 'export') {
      await this.releaseExportLock(jobId);
    }
  }

  /**
   * Bootstrap: make sure the table exists (one-time, guarded per process)
   */
  private async ensureReady(): Promise<void> {
    await this.dynamo.ensureJobsTableExists(this.tableName);
  }

  /** Persist one job item (stamps index + TTL attributes) */
  private async putJob(job: JobMetadata): Promise<void> {
    await this.ensureReady();
    await this.dynamo.putItem(this.tableName, this.toItem(job));
  }

  /** All real job items, newest first (marker/lock items have no gsi1pk) */
  private async queryAllJobs(options: { sortKeyBefore?: string } = {}): Promise<JobMetadata[]> {
    await this.ensureReady();
    return await this.dynamo.queryIndex<JobItem>(
      this.tableName,
      GSI_NAME,
      'gsi1pk',
      GSI_PARTITION_VALUE,
      {
        limit: QUERY_FETCH_LIMIT,
        ...(options.sortKeyBefore && {
          sortKeyBefore: { name: 'startTime', value: options.sortKeyBefore },
        }),
      }
    );
  }

  /**
   * Shared self-healing pass: mark dead jobs failed and write each
   * transitioned item back individually. Write errors are non-fatal - reads
   * must not fail because a repair couldn't be saved.
   */
  private async repairDeadJobs(
    jobs: JobMetadata[],
    timeoutMinutes: number = JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES
  ): Promise<number> {
    const cutoff = Date.now() - timeoutMinutes * TIME_UNITS.MINUTE;
    let transitioned = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (!job) {
        continue;
      }
      const isActive =
        job.status === 'queued' || job.status === 'processing' || job.status === 'stopping';
      if (!isActive) {
        continue;
      }
      const lastHeartbeat = new Date(job.lastUpdatedTime || job.startTime).getTime();
      if (lastHeartbeat >= cutoff) {
        continue;
      }

      const failed: JobMetadata = {
        ...job,
        status: 'failed',
        endTime: new Date().toISOString(),
        message: `Job auto-failed: no heartbeat for over ${timeoutMinutes} minutes (worker died or timed out)`,
        error: `No heartbeat since ${job.lastUpdatedTime || job.startTime} while in '${job.status}' status`,
        duration: Date.now() - new Date(job.startTime).getTime(),
      };
      jobs[i] = failed;
      transitioned++;

      try {
        await this.putJob(failed);
        if (failed.jobType === 'export') {
          await this.releaseExportLock(failed.jobId);
        }
      } catch (error) {
        logger.warn('Failed to persist dead-job repair (will retry on next read)', {
          jobId: job.jobId,
          error,
        });
      }

      logger.warn('Auto-failed dead job', {
        jobId: job.jobId,
        jobType: job.jobType,
        originalStatus: job.status,
        lastHeartbeat: job.lastUpdatedTime || job.startTime,
      });
    }

    if (transitioned > 0) {
      logger.info(`Marked ${transitioned} dead jobs as failed`);
    }
    return transitioned;
  }

  /** Stamp DynamoDB key + index + TTL attributes onto a job */
  private toItem(job: JobMetadata): JobItem {
    const startEpochSeconds = Math.ceil(new Date(job.startTime).getTime() / MS_PER_SECOND) || 0;
    return {
      ...job,
      pk: job.jobId,
      sk: META_SK,
      gsi1pk: GSI_PARTITION_VALUE,
      expiresAt:
        startEpochSeconds + (JOB_CONFIG.DEFAULT_RETENTION_DAYS + TTL_GRACE_DAYS) * SECONDS_PER_DAY,
    };
  }

  /** Strip storage-only attributes before handing a job to callers */
  private toMetadata(item: JobItem): JobMetadata {
    const job: JobItem = { ...item };
    delete job.pk;
    delete job.sk;
    delete job.gsi1pk;
    delete job.expiresAt;
    return job;
  }
}
