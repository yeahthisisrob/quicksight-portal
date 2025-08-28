/**
 * JobStateService - Lightweight wrapper around JobRepository for backward compatibility
 * Delegates to JobRepository for actual storage
 */

import {
  JobRepository,
  type JobType,
  type JobMetadata,
  type JobLog as RepoJobLog,
} from './JobRepository';
import { type S3Service } from '../../../shared/services/aws/S3Service';
import { QUICKSIGHT_LIMITS, MATH_CONSTANTS } from '../../constants';

export interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';
  progress: number;
  message?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  stats?: {
    totalAssets?: number;
    processedAssets?: number;
    failedAssets?: number;
    operations?: Record<string, number>; // Generic operation counter
  };
  error?: string;
  stopRequested?: boolean;
}

export interface JobLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

export class JobStateService {
  private readonly defaultJobType: JobType = 'export'; // Default for backward compatibility
  private readonly repository: JobRepository;

  constructor(s3Service: S3Service, bucketName: string, jobType?: JobType) {
    this.repository = new JobRepository(s3Service, bucketName);
    if (jobType) {
      this.defaultJobType = jobType;
    }
  }

  /**
   * Append log entry
   */
  public async appendLog(jobId: string, log: JobLog): Promise<void> {
    await this.repository.appendLog(jobId, log as RepoJobLog);
  }

  /**
   * Clean up old jobs
   */
  public async cleanupOldJobs(daysToKeep: number = 7): Promise<number> {
    return await this.repository.cleanupOldJobs(daysToKeep);
  }

  /**
   * Mark stuck jobs as failed (jobs stuck in queued/processing for > 30 minutes)
   */
  public async cleanupStuckJobs(timeoutMinutes: number = 30): Promise<number> {
    return await this.repository.cleanupStuckJobs(timeoutMinutes);
  }

  /**
   * Create a new job
   */
  public async createJob(jobId: string, initialStatus: Partial<JobStatus>): Promise<void> {
    const metadata: JobMetadata = {
      jobId,
      jobType: this.defaultJobType,
      status: initialStatus.status || 'queued',
      progress: initialStatus.progress || 0,
      message: initialStatus.message,
      startTime: initialStatus.startTime || new Date().toISOString(),
      endTime: initialStatus.endTime,
      duration: initialStatus.duration,
      stats: initialStatus.stats,
      error: initialStatus.error,
      stopRequested: initialStatus.stopRequested,
    };

    await this.repository.createJob(metadata);
  }

  /**
   * Get active jobs (queued or processing)
   */
  public async getActiveJobs(): Promise<Array<{ jobId: string; jobType: string; status: string }>> {
    try {
      // Get all jobs of this type and filter for active ones
      const allJobs = await this.repository.listJobs({
        jobType: this.defaultJobType,
        limit: QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS,
      });

      // Filter for active jobs
      const activeJobs = allJobs.filter(
        (job) => job.status === 'queued' || job.status === 'processing'
      );

      return activeJobs.map((job) => ({
        jobId: job.jobId,
        jobType: job.jobType,
        status: job.status,
      }));
    } catch (_error) {
      // If there's an error getting jobs, return empty array to be safe
      return [];
    }
  }

  /**
   * Get job logs
   */
  public async getJobLogs(jobId: string): Promise<JobLog[]> {
    return (await this.repository.getJobLogs(jobId)) as JobLog[];
  }

  /**
   * Get job status
   */
  public async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const metadata = await this.repository.getJob(jobId);
    if (!metadata) {
      return null;
    }

    return {
      jobId: metadata.jobId,
      status: metadata.status,
      progress: metadata.progress || 0,
      message: metadata.message,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      duration: metadata.duration,
      stats: metadata.stats,
      error: metadata.error,
      stopRequested: metadata.stopRequested,
    };
  }

  /**
   * Increment operation counter
   */
  public async incrementOperation(
    jobId: string,
    operation: string,
    count: number = 1
  ): Promise<void> {
    const job = await this.getJobStatus(jobId);
    if (!job) {
      return;
    }

    const operations = job.stats?.operations || {};
    operations[operation] = (operations[operation] || 0) + count;

    await this.updateJobStatus(jobId, {
      stats: {
        ...job.stats,
        operations,
      },
    });
  }

  /**
   * Check if stop has been requested for a job
   */
  public async isStopRequested(jobId: string): Promise<boolean> {
    return await this.repository.isStopRequested(jobId);
  }

  /**
   * Convenience method to append an error log
   */
  public async logError(jobId: string, message: string, details?: any): Promise<void> {
    await this.appendLog(jobId, {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      details,
    });
  }

  /**
   * Convenience method to append an info log
   */
  public async logInfo(jobId: string, message: string, details?: any): Promise<void> {
    // Always include current API call count from job operations stats for frontend display
    const enhancedDetails = { ...details };
    if (!enhancedDetails.apiCalls) {
      const currentJob = await this.getJobStatus(jobId);
      enhancedDetails.apiCalls = currentJob?.stats?.operations
        ? Object.values(currentJob.stats.operations).reduce((sum, count) => sum + count, 0)
        : 0;
    }

    await this.appendLog(jobId, {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      details: enhancedDetails,
    });
  }

  /**
   * Convenience method to append a warning log
   */
  public async logWarn(jobId: string, message: string, details?: any): Promise<void> {
    await this.appendLog(jobId, {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      details,
    });
  }

  /**
   * Request job to stop
   */
  public async requestStop(jobId: string): Promise<void> {
    await this.repository.requestStop(jobId);
  }

  /**
   * Update asset progress
   */
  public async updateAssetProgress(
    jobId: string,
    assetType: string,
    processed: number,
    total: number
  ): Promise<void> {
    const progress = Math.round((processed / total) * MATH_CONSTANTS.PERCENTAGE_MULTIPLIER);
    await this.updateJobStatus(jobId, {
      progress,
      message: `Processing ${assetType}: ${processed}/${total}`,
      stats: {
        totalAssets: total,
        processedAssets: processed,
      },
    });
  }

  /**
   * Update job status
   */
  public async updateJobStatus(jobId: string, updates: Partial<JobStatus>): Promise<void> {
    await this.repository.updateJob(jobId, updates as Partial<JobMetadata>);
  }
}
