import { api as apiClient } from '../client';
import { ApiResponse } from '../types';

export type JobType = 'export' | 'deploy' | 'ingestion' | 'rebuild' | 'activity-refresh';
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
  
  // Error info
  error?: string;
  errorStack?: string;
  
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

/**
 * Jobs API - unified job management for all job types
 */
export const jobsApi = {
  /**
   * List jobs with optional filtering
   */
  async listJobs(options?: JobListOptions): Promise<JobMetadata[]> {
    const response = await apiClient.get<ApiResponse<JobMetadata[]>>('/jobs', { 
      params: options 
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
    const response = await apiClient.get<ApiResponse<{ jobId: string; logs: JobLog[] }>>(`/jobs/${jobId}/logs`);
    
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

  /**
   * Clean up old jobs
   */
  async cleanupJobs(options: { daysToKeep?: number; stuckTimeoutMinutes?: number } = {}): Promise<{ deletedCount: number; failedStuckCount: number; message: string }> {
    const response = await apiClient.post<ApiResponse<{ deletedCount: number; failedStuckCount: number; message: string }>>('/jobs/cleanup', {
      daysToKeep: options.daysToKeep || 30,
      stuckTimeoutMinutes: options.stuckTimeoutMinutes || 30
    });
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cleanup jobs');
    }
    
    return response.data.data!;
  },
};