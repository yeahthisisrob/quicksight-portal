import type { components } from '@shared/generated';

import { api as apiClient } from '../client';
import type { ApiResponse } from '../types';

export type BulkItemFailure = components['schemas']['BulkItemFailure'];

export type JobType =
  | 'export'
  | 'deploy'
  | 'ingestion'
  | 'rebuild'
  | 'activity-refresh'
  | 'smus-export'
  | 'bulk-operation'
  | 'csv-export'
  | 'planner'
  | 'assistant';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'stopping' | 'stopped';
export type JobPhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

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
  endTime?: string;
  duration?: number;
  userId?: string;
  accountId?: string;

  // Type-specific metadata
  assetType?: string;
  assetId?: string;
  deploymentType?: string;
  exportOptions?: any;

  // Stats
  stats?: {
    totalAssets?: number;
    processedAssets?: number;
    failedAssets?: number;
    operations?: Record<string, number>; // Generic operation tracking
  };

  // Optional step-based progress for multi-phase jobs (e.g. activity-refresh).
  phases?: JobPhase[];

  // Error info
  error?: string;
  errorStack?: string;
  /** Bulk jobs: which items failed and why (capped server-side) */
  failures?: BulkItemFailure[];

  // Control flags
  stopRequested?: boolean;
}

export interface JobLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: any;
}

export interface JobListOptions {
  type?: JobType;
  status?: JobStatus;
  userId?: string;
  limit?: number;
  afterDate?: string;
  beforeDate?: string;
}

const DEFAULT_AWAIT_INTERVAL_MS = 1500;
const DEFAULT_AWAIT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Jobs API - unified job management for all job types
 */
export const jobsApi = {
  /**
   * List jobs with optional filtering
   */
  async listJobs(options?: JobListOptions): Promise<JobMetadata[]> {
    const response = await apiClient.get<ApiResponse<JobMetadata[]>>('/jobs', {
      params: options,
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to list jobs');
    }

    return response.data.data || [];
  },

  /**
   * Get job details
   */
  async getJob(jobId: string): Promise<JobMetadata | null> {
    const response = await apiClient.get<ApiResponse<JobMetadata>>(`/jobs/${jobId}`);

    if (!response.data.success) {
      if (response.status === 404) return null;
      throw new Error(response.data.error || 'Failed to get job');
    }

    return response.data.data || null;
  },

  /**
   * Get job logs
   */
  async getJobLogs(jobId: string): Promise<JobLog[]> {
    const response = await apiClient.get<ApiResponse<{ jobId: string; logs: JobLog[] }>>(
      `/jobs/${jobId}/logs`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to get job logs');
    }

    return response.data.data?.logs || [];
  },

  /**
   * Get job result
   */
  async getJobResult<T = any>(jobId: string): Promise<T | null> {
    const response = await apiClient.get<ApiResponse<T>>(`/jobs/${jobId}/result`);

    if (!response.data.success) {
      if (response.status === 404) return null;
      throw new Error(response.data.error || 'Failed to get job result');
    }

    return response.data.data || null;
  },

  /**
   * Wait for a job to finish and return its result. For calls the API runs
   * as jobs because they can outlive the gateway's limit (the planner).
   * Throws with the job's own message when it fails or is stopped.
   */
  async awaitResult<T>(
    jobId: string,
    options: { intervalMs?: number; timeoutMs?: number } = {}
  ): Promise<T> {
    const interval = options.intervalMs ?? DEFAULT_AWAIT_INTERVAL_MS;
    const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_AWAIT_TIMEOUT_MS);
    for (;;) {
      const job = await jobsApi.getJob(jobId);
      if (job?.status === 'completed') {
        const result = await jobsApi.getJobResult<T>(jobId);
        if (result === null) {
          throw new Error('The job finished without a result');
        }
        return result;
      }
      if (job && (job.status === 'failed' || job.status === 'stopped')) {
        throw new Error(job.error || job.message || 'The job failed');
      }
      if (Date.now() > deadline) {
        throw new Error('Gave up waiting for the job; it is still listed under Operations');
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  },

  /**
   * Stop a job
   */
  async stopJob(jobId: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<any>>(`/jobs/${jobId}/stop`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to stop job');
    }
  },

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<any>>(`/jobs/${jobId}`);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete job');
    }
  },
};
