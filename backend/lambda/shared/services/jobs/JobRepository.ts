/**
 * JobRepository - where jobs, their logs and the export lock are kept.
 *
 * - A job is one item; every status or progress write is one atomic
 *   partial update, so a worker's heartbeat and the API's stop request
 *   never overwrite each other. The byStartTime index lists jobs newest
 *   first; `expiresAt` is the retention backstop behind cleanupOldJobs.
 * - Each log line is its own item, ordered by time and a sequence, so
 *   appending never reads and a follower reads only what came after its
 *   cursor.
 * - A result that would threaten the 400 KB item limit is replaced with a
 *   truncation marker (loud in the logs).
 * - The single-export lock is a conditional write: race-free, expiring,
 *   and re-entrant for continuation invocations of the same job.
 */

import { JOB_CONFIG, JOB_LIMITS, TIME_UNITS } from '../../constants';
import type { BulkItemFailure } from '../../types/bulkOperationTypes';
import { logger } from '../../utils/logger';
import { isConditionFailed, type JobRow, portal } from '../store/portalTable';
import { jobExpiresAt } from './jobRetention';

export type JobType =
  | 'export'
  | 'deploy'
  | 'ingestion'
  | 'rebuild'
  | 'activity-refresh'
  | 'bulk-operation'
  | 'csv-export'
  | 'smus-export'
  | 'planner'
  | 'assistant'
  | 'asset-refresh'
  | 'playbook';
type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';

type JobPhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

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
  /** Who started it, in words (an email, or an API key's label). */
  startedBy?: string;
  accountId?: string;

  // Type-specific metadata
  assetType?: string; // For deploy jobs
  assetId?: string; // For deploy jobs
  deploymentType?: string; // For deploy jobs
  exportOptions?: any; // For export jobs
  /** Playbook jobs: what it was asked (the playbooks slice owns the shape). */
  playbook?: { mode: 'preview' | 'run'; playbookId: string } & Record<string, unknown>;

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
  /**
   * Bulk jobs: item-level failures (capped) so the UI can say *which* items
   * failed and why without fetching the full result.
   */
  failures?: BulkItemFailure[];

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

const EXPORT_LOCK = 'export';
/** DynamoDB items cap at 400KB - refuse results that would threaten it */
const RESULT_MAX_BYTES = 358400; // 350 KB
const QUERY_FETCH_LIMIT = 500;
const MS_PER_SECOND = 1000;
/** Lock TTL backstop = 2x the lock's own expiry */
const LOCK_TTL_FACTOR = 2;
/** Sequence pad width keeps log keys lexicographically ordered */
const LOG_SEQ_PAD = 6;
/** A log key: the entry's ISO time, then its sequence. */
const LOG_KEY = /^\d{4}-\d{2}-\d{2}T[^#]+#\d{6}$/;

/** A job as callers see it: the row without its storage attributes. */
function toMetadata(row: JobRow): JobMetadata {
  const { expiresAt: _expiresAt, ...job } = row;
  return job as JobMetadata;
}

/** A job as stored: JSON-safe (Dates as strings), with its expiry. */
function toRow(job: JobMetadata): JobRow {
  return {
    ...(JSON.parse(JSON.stringify(job)) as JobMetadata),
    expiresAt: jobExpiresAt(new Date(job.startTime).getTime() || Date.now()),
  } as JobRow;
}

export class JobRepository {
  /** Per-process log sequence + count per job: the worker is the only log
   *  writer for its job, so this both orders same-millisecond entries and
   *  caps runaway logging per invocation. */
  private static readonly logCounters = new Map<string, number>();

  /**
   * Acquire the single-export lock via conditional write. Succeeds when the
   * lock is free, expired, or already held by this job (re-entrant, so
   * continuation invocations of the same export re-acquire it). Expires after
   * the stuck-job timeout, so a died worker can never wedge exports.
   */
  public async acquireExportLock(jobId: string): Promise<boolean> {
    const now = Date.now();
    const holdMs = JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES * TIME_UNITS.MINUTE;
    try {
      await portal()
        .exportLock.put({
          lock: EXPORT_LOCK,
          ownerJobId: jobId,
          acquiredAt: new Date(now).toISOString(),
          lockExpiresAt: now + holdMs,
          expiresAt: Math.ceil((now + holdMs * LOCK_TTL_FACTOR) / MS_PER_SECOND),
        })
        .where(
          ({ lock, lockExpiresAt, ownerJobId }, { notExists, lt, eq }) =>
            `${notExists(lock)} OR ${lt(lockExpiresAt, now)} OR ${eq(ownerJobId, jobId)}`
        )
        .go();
      return true;
    } catch (error) {
      if (isConditionFailed(error)) {
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
    await portal()
      .jobLog.put({
        jobId,
        logKey: `${log.timestamp}#${String(seq).padStart(LOG_SEQ_PAD, '0')}`,
        ...JSON.parse(JSON.stringify(log)),
        expiresAt: jobExpiresAt(),
      })
      .go();
  }

  /**
   * Clean up jobs past the retention window (the job, its logs, its items).
   * The table's TTL attribute is only the backstop - this sweep keeps
   * listings tidy without waiting on TTL's up-to-48h lag.
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

  /** Create a job (immediately visible to every Lambda). */
  public async createJob(metadata: JobMetadata): Promise<void> {
    await portal()
      .job.put(toRow({ ...metadata, lastUpdatedTime: new Date().toISOString() }))
      .go();
    logger.info('Job created', { jobId: metadata.jobId, jobType: metadata.jobType });
  }

  /** Delete a job and everything under it: its logs and its items. */
  public async deleteJob(jobId: string): Promise<void> {
    const [logs, items] = await Promise.all([
      portal().jobLog.query.byJob({ jobId }).go({ pages: 'all' }),
      portal().jobItem.query.byJob({ jobId }).go({ pages: 'all' }),
    ]);
    if (logs.data.length) {
      await portal()
        .jobLog.delete(logs.data.map(({ logKey }) => ({ jobId, logKey })))
        .go();
    }
    if (items.data.length) {
      await portal()
        .jobItem.delete(items.data.map(({ itemKey }) => ({ jobId, itemKey })))
        .go();
    }
    await portal().job.delete({ jobId }).go();
    logger.info('Job deleted', {
      jobId,
      itemsDeleted: 1 + logs.data.length + items.data.length,
    });
  }

  /** Get a job (strongly consistent read). */
  public async getJob(jobId: string): Promise<JobMetadata | null> {
    try {
      const { data } = await portal().job.get({ jobId }).go({ consistent: true });
      if (!data) {
        return null;
      }
      // Self-healing: a poller watching a job whose worker died sees it flip
      // to 'failed' instead of spinning forever. The repair pass replaces
      // array slots, so read the (possibly repaired) job back from the array.
      const jobs: JobMetadata[] = [toMetadata(data)];
      await this.repairDeadJobs(jobs);
      return jobs[0] as JobMetadata;
    } catch (error: any) {
      logger.error('Failed to get job', { jobId, error: error.message });
      return null;
    }
  }

  /** Get job logs, chronological. */
  public async getJobLogs(jobId: string): Promise<JobLog[]> {
    return (await this.getJobLogPage(jobId)).logs;
  }

  /**
   * A job's log lines after `cursor` (all of them without one), and the
   * cursor to ask with next: a view that follows a running job only fetches
   * what is new. The cursor is opaque to callers (it is the last log key).
   */
  public async getJobLogPage(
    jobId: string,
    cursor?: string
  ): Promise<{ logs: JobLog[]; cursor?: string }> {
    // A cursor that is not a log key (a stale client's) reads from the start.
    const valid = cursor && LOG_KEY.test(cursor) ? cursor : undefined;
    const query = portal().jobLog.query.byJob({ jobId });
    const { data } = await (valid ? query.gt({ logKey: valid }) : query).go({
      pages: 'all',
      consistent: true,
    });
    const last = data.at(-1)?.logKey ?? valid;
    return {
      logs: data.map(
        ({ jobId: _j, logKey: _k, expiresAt: _e, ...log }) => log as unknown as JobLog
      ),
      ...(last && { cursor: last }),
    };
  }

  /** Get job result data (if any). */
  public async getJobResult<T = any>(jobId: string): Promise<T | null> {
    try {
      const { data } = await portal().job.get({ jobId }).go({ consistent: true });
      return (data?.result as T) || null;
    } catch (error: any) {
      logger.error('Failed to get job result', { jobId, error: error.message });
      return null;
    }
  }

  /** Check if stop has been requested for a job. */
  public async isStopRequested(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    return job?.stopRequested === true || job?.status === 'stopping';
  }

  /** List jobs with filtering, newest first. */
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

      const matchesFilters = (job: JobMetadata): boolean =>
        (!jobType || job.jobType === jobType) &&
        (!status || job.status === status) &&
        (!userId || job.userId === userId) &&
        (!afterDate || new Date(job.startTime) >= afterDate) &&
        (!beforeDate || new Date(job.startTime) <= beforeDate);
      const filtered = allJobs.filter(matchesFilters);

      // The index already returns newest-first; keep an explicit sort for
      // determinism (equal timestamps)
      filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      return filtered.slice(0, limit);
    } catch (error: any) {
      logger.error('Failed to list jobs', { error: error.message, errorName: error.name, options });
      return [];
    }
  }

  /**
   * Release the single-export lock (only if this job holds it). Safe to call
   * unconditionally on terminal status writes.
   */
  public async releaseExportLock(jobId: string): Promise<void> {
    try {
      await portal()
        .exportLock.delete({ lock: EXPORT_LOCK })
        .where(({ ownerJobId }, { eq }) => eq(ownerJobId, jobId))
        .go();
    } catch (error) {
      if (!isConditionFailed(error)) {
        logger.warn('Failed to release export lock', { jobId, error });
      }
    }
  }

  /** Request job to stop. */
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
   *
   * The result is stored as the JSON it is served as: Dates become ISO
   * strings and class instances plain objects. The DynamoDB marshaller
   * refuses both, and a refused result used to fail a job whose work had
   * already been done (every restore, for one).
   */
  public async saveJobResult<T = any>(jobId: string, result: T): Promise<void> {
    const json = JSON.stringify(result) ?? 'null';
    let stored: any = JSON.parse(json);
    const sizeBytes = json.length;
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

    try {
      await portal()
        .job.patch({ jobId })
        .set({ result: stored, lastUpdatedTime: new Date().toISOString() })
        .go();
    } catch (error) {
      if (isConditionFailed(error)) {
        throw new Error(`Job ${jobId} not found`);
      }
      throw error;
    }
  }

  /**
   * Update a job as ONE atomic partial write: only the provided fields are
   * touched, so concurrent writers to the same job (a worker heartbeat vs.
   * the API setting stopRequested) never clobber each other, and a routine
   * heartbeat costs no reads. Terminal writes (endTime present) do one read
   * to compute duration and learn the jobType.
   */
  public async updateJob(jobId: string, updates: Partial<JobMetadata>): Promise<void> {
    const now = new Date().toISOString();
    const set: Record<string, any> = JSON.parse(
      JSON.stringify({ ...updates, lastUpdatedTime: now })
    );
    delete set.jobId;
    delete set.startTime; // the start never moves, and it keys the byStartTime index

    let jobType: JobType | undefined = updates.jobType;
    let startTime: string | undefined;
    if (updates.endTime) {
      const { data: current } = await portal().job.get({ jobId }).go({ consistent: true });
      set.duration =
        new Date(updates.endTime).getTime() - new Date(current?.startTime || now).getTime();
      jobType = jobType || (current?.jobType as JobType | undefined);
      startTime = current?.startTime;
    }
    // A job completing successfully must not carry a stale auto-fail error
    // (e.g. a "no heartbeat" stamp from the stuck-job sweep) forward
    const remove = updates.status === 'completed' && updates.error === undefined ? ['error'] : [];

    try {
      await portal()
        .job.patch({ jobId })
        .set(set)
        .remove(remove as never[])
        .go();
    } catch (error) {
      if (!isConditionFailed(error)) throw error;
      // Upsert rather than throw: a lost record must not turn a SUCCESSFUL
      // run into a spurious "failed" job via the caller's error handler
      logger.warn('Job missing during update - recreating it', { jobId });
      await portal()
        .job.put(
          toRow({
            jobType: jobType || 'export',
            status: 'processing',
            ...set,
            jobId,
            startTime: startTime || now,
          } as JobMetadata)
        )
        .go();
    }

    // Terminal export jobs free the single-export mutex (conditional on
    // ownership, so this is a no-op for every other job type)
    const isTerminal = updates.status
      ? ['completed', 'failed', 'stopped'].includes(updates.status)
      : false;
    if (isTerminal && (jobType || 'export') === 'export') {
      await this.releaseExportLock(jobId);
    }
  }

  /** Jobs newest first, at most QUERY_FETCH_LIMIT, optionally started before a time. */
  private async queryAllJobs(options: { sortKeyBefore?: string } = {}): Promise<JobMetadata[]> {
    const query = portal().job.query.byStartTime({});
    const { data } = await (options.sortKeyBefore
      ? query.lt({ startTime: options.sortKeyBefore })
      : query
    ).go({ order: 'desc', limit: QUERY_FETCH_LIMIT });
    return data.map(toMetadata);
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
        await portal().job.put(toRow(failed)).go();
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
}
