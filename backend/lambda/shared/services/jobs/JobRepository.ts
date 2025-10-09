/**
 * JobRepository - Centralized job storage and retrieval
 * Handles all job types (export, deploy, etc.) with S3 persistence
 */

import { JOB_CONFIG, JOB_LIMITS, TIME_UNITS } from '../../constants';
import { logger } from '../../utils/logger';
import { type S3Service } from '../aws/S3Service';
import { CacheService } from '../cache/CacheService';

export type JobType =
  | 'export'
  | 'deploy'
  | 'ingestion'
  | 'rebuild'
  | 'activity-refresh'
  | 'bulk-operation'
  | 'csv-export';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';

export interface JobMetadata {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  progress?: number;
  message?: string;
  startTime: string;
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

  // Error info
  error?: string;
  errorStack?: string;

  // Control flags
  stopRequested?: boolean;

  // Job result data (stored in cache)
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

export class JobRepository {
  private static readonly JOBS_PREFIX = 'jobs/';
  private readonly cacheService: CacheService;

  constructor(
    private readonly s3Service: S3Service,
    private readonly bucketName: string
  ) {
    this.cacheService = CacheService.getInstance();
    // Ensure CacheService uses the same bucket name as the repository
    this.cacheService.setBucketName(bucketName);
  }

  /**
   * Append log entry to job
   */
  public async appendLog(jobId: string, log: JobLog): Promise<void> {
    const logsKey = `${JobRepository.JOBS_PREFIX}${jobId}-logs.json`;

    // Read existing logs
    let logs: JobLog[] = [];
    try {
      logs = (await this.s3Service.getObject<JobLog[]>(this.bucketName, logsKey)) || [];
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') {
        logger.warn('Failed to read existing logs', { error, jobId });
      }
    }

    // Append new log
    logs.push(log);

    // Limit logs to last entries to prevent unbounded growth
    if (logs.length > JOB_LIMITS.MAX_LOG_ENTRIES) {
      logs = logs.slice(-JOB_LIMITS.MAX_LOG_ENTRIES);
    }

    // Save back
    await this.s3Service.putObject(this.bucketName, logsKey, logs);
  }

  /**
   * Clean up old jobs
   */
  public async cleanupOldJobs(
    daysToKeep: number = JOB_CONFIG.DEFAULT_RETENTION_DAYS
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const oldJobs = await this.listJobs({ beforeDate: cutoffDate });

    for (const job of oldJobs) {
      await this.deleteJob(job.jobId);
    }

    logger.info(`Cleaned up ${oldJobs.length} old jobs`);
    return oldJobs.length;
  }

  /**
   * Mark stuck jobs as failed
   * Lambda max timeout is 15 minutes, so anything in 'queued' or 'processing'
   * for more than 30 minutes is definitely stuck
   */
  public async cleanupStuckJobs(
    timeoutMinutes: number = JOB_CONFIG.STUCK_JOB_TIMEOUT_MINUTES
  ): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - timeoutMinutes);

    // Get all jobs that might be stuck
    const allJobs = await this.listJobs({ limit: 1000 });

    const stuckJobs = allJobs.filter((job) => {
      const jobStartTime = new Date(job.startTime);
      const isStuckStatus = job.status === 'queued' || job.status === 'processing';
      const isOldEnough = jobStartTime < cutoffTime;

      return isStuckStatus && isOldEnough;
    });

    let cleanedCount = 0;

    // Update all stuck jobs in the cache index
    if (stuckJobs.length > 0) {
      try {
        // Get all jobs from cache
        const jobsFromCache = await this.cacheService.getJobIndex();

        // Update stuck jobs in the index
        for (const stuckJob of stuckJobs) {
          const jobIndex = jobsFromCache.findIndex((j: any) => j.jobId === stuckJob.jobId);
          if (jobIndex >= 0) {
            jobsFromCache[jobIndex] = {
              ...stuckJob,
              status: 'failed',
              endTime: new Date().toISOString(),
              message: `Job marked as failed - stuck in ${stuckJob.status} status for over ${timeoutMinutes} minutes`,
              error: `Lambda timeout - job was in ${stuckJob.status} status for over ${timeoutMinutes} minutes`,
              duration: new Date().getTime() - new Date(stuckJob.startTime).getTime(),
            };

            logger.warn(`Marked stuck job as failed`, {
              jobId: stuckJob.jobId,
              jobType: stuckJob.jobType,
              originalStatus: stuckJob.status,
              stuckDuration:
                Math.round(
                  (Date.now() - new Date(stuckJob.startTime).getTime()) / TIME_UNITS.MINUTE
                ) + ' minutes',
            });

            cleanedCount++;
          }
        }

        // Update the cache index once with all changes (memory only - instant!)
        await this.cacheService.updateJobIndex(jobsFromCache);

        // Persist to S3 since we marked jobs as failed
        await this.cacheService.persistJobIndex();
      } catch (error) {
        logger.error('Failed to cleanup stuck jobs', {
          error: error instanceof Error ? error.message : String(error),
          stuckJobCount: stuckJobs.length,
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Marked ${cleanedCount} stuck jobs as failed`);
    }

    return cleanedCount;
  }

  /**
   * Create a new job with metadata
   */
  public async createJob(metadata: JobMetadata): Promise<void> {
    const { jobId } = metadata;

    // Update memory cache only (instant!)
    await this.updateJobInIndex(metadata);

    // Persist immediately so the job shows up in the UI
    // For new jobs, we need immediate persistence so the API Lambda can find them
    try {
      await this.cacheService.persistJobIndex();
      logger.info('Job index persisted immediately for new job', { jobId });
    } catch (error) {
      logger.error('Failed to persist job index immediately', { error, jobId });
    }
  }

  /**
   * Delete a job and all its data
   */
  public async deleteJob(jobId: string): Promise<void> {
    // Delete logs file if it exists
    const logsKey = `${JobRepository.JOBS_PREFIX}${jobId}-logs.json`;
    try {
      await this.s3Service.deleteObject(this.bucketName, logsKey);
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') {
        logger.warn('Failed to delete logs', { jobId, error: error.message });
      }
    }

    // Remove from cache index
    await this.removeFromIndex(jobId);

    logger.info('Job deleted', { jobId });
  }

  /**
   * Force immediate persistence (call before Lambda shutdown)
   */
  public async forcePersist(): Promise<void> {
    try {
      await this.cacheService.persistJobIndex();
      logger.info('Job index force persisted to S3');
    } catch (error) {
      logger.error('Failed to force persist job index', { error });
      throw error;
    }
  }

  /**
   * Get job metadata
   */
  public async getJob(jobId: string): Promise<JobMetadata | null> {
    try {
      // For individual job queries, force refresh from S3 to get latest status
      // This ensures API Lambda gets updates made by Worker Lambda
      const allJobs = await this.cacheService.getJobIndex(true); // Force S3 fetch
      const job = allJobs.find((j: any) => j.jobId === jobId);
      return job || null;
    } catch (error: any) {
      logger.error('Failed to get job', { jobId, error: error.message });
      return null;
    }
  }

  /**
   * Get job logs
   */
  public async getJobLogs(jobId: string): Promise<JobLog[]> {
    try {
      return (
        (await this.s3Service.getObject<JobLog[]>(
          this.bucketName,
          `${JobRepository.JOBS_PREFIX}${jobId}-logs.json`
        )) || []
      );
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get job result data (if any)
   */
  public async getJobResult<T = any>(jobId: string): Promise<T | null> {
    try {
      const allJobs = await this.cacheService.getJobIndex();
      const job = allJobs.find((j: any) => j.jobId === jobId);
      return job?.result || null;
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
   * List jobs with filtering
   */
  public async listJobs(options: JobListOptions = {}): Promise<JobMetadata[]> {
    const { jobType, status, userId, limit = 50, afterDate, beforeDate } = options;

    try {
      // Get all jobs from cache service
      const allJobs = await this.cacheService.getJobIndex();

      // If no jobs in cache, just return empty
      // Jobs will be added to cache as they are created

      // Filter jobs
      let filtered = allJobs;

      if (jobType) {
        filtered = filtered.filter((job: any) => job.jobType === jobType);
      }

      if (status) {
        filtered = filtered.filter((job) => job.status === status);
      }

      if (userId) {
        filtered = filtered.filter((job) => job.userId === userId);
      }

      if (afterDate) {
        filtered = filtered.filter((job) => new Date(job.startTime) >= afterDate);
      }

      if (beforeDate) {
        filtered = filtered.filter((job) => new Date(job.startTime) <= beforeDate);
      }

      // Sort by start time descending (newest first)
      filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      // Apply limit
      return filtered.slice(0, limit);
    } catch (error: any) {
      logger.error('Failed to list jobs', {
        error: error.message,
        errorName: error.name,
        options,
        cacheServiceBucket: (this.cacheService as any).bucketName,
        repositoryBucket: this.bucketName,
      });
      return [];
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
   * Save job result data
   */
  public async saveJobResult<T = any>(jobId: string, result: T): Promise<void> {
    const current = await this.getJob(jobId);
    if (!current) {
      throw new Error(`Job ${jobId} not found`);
    }

    const updated: JobMetadata = {
      ...current,
      result,
    };

    await this.updateJobInIndex(updated);
  }

  /**
   * Update job metadata
   */
  public async updateJob(jobId: string, updates: Partial<JobMetadata>): Promise<void> {
    const current = await this.getJob(jobId);
    if (!current) {
      throw new Error(`Job ${jobId} not found`);
    }

    const updated: JobMetadata = {
      ...current,
      ...updates,
      duration: updates.endTime
        ? new Date(updates.endTime).getTime() - new Date(current.startTime).getTime()
        : current.duration,
    };

    await this.updateJobInIndex(updated);

    // Always persist immediately to S3 so the API Lambda can see updates
    try {
      await this.cacheService.persistJobIndex();
    } catch (error) {
      logger.error('Failed to persist job index', { error, jobId });
    }
  }

  /**
   * Remove job from cache index
   */
  private async removeFromIndex(jobId: string): Promise<void> {
    // Get current index from cache
    let allJobs = await this.cacheService.getJobIndex();

    // Remove job from index
    allJobs = allJobs.filter((j: any) => j.jobId !== jobId);

    // Update cache
    await this.cacheService.updateJobIndex(allJobs);
  }

  /**
   * Update job in cache index
   */
  private async updateJobInIndex(job: JobMetadata): Promise<void> {
    // Get current index from memory cache (instant!)
    let allJobs = await this.cacheService.getJobIndex();

    // Update or add job in index
    const existingIndex = allJobs.findIndex((j: any) => j.jobId === job.jobId);
    if (existingIndex >= 0) {
      allJobs[existingIndex] = job;
    } else {
      allJobs.push(job);
    }

    // Keep only last jobs total, sorted by start time
    allJobs.sort(
      (a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    allJobs = allJobs.slice(0, JOB_CONFIG.MAX_JOBS_IN_INDEX);

    // Update memory cache only (instant!)
    await this.cacheService.updateJobIndex(allJobs);
  }
}
