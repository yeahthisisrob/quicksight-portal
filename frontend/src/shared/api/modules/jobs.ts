import type { components, paths } from '@shared/generated/types';

import { client, unwrap } from '../typed';

type Schemas = components['schemas'];

export type BulkItemFailure = Schemas['BulkItemFailure'];
export type JobType = Schemas['JobType'];
export type JobStatus = Schemas['JobStatus'];
export type JobPhase = Schemas['JobPhase'];
export type JobMetadata = Schemas['Job'];
export type JobLog = Schemas['JobLog'];
export type JobListOptions = NonNullable<paths['/api/jobs']['get']['parameters']['query']>;

const DEFAULT_AWAIT_INTERVAL_MS = 1500;
const DEFAULT_AWAIT_TIMEOUT_MS = 10 * 60 * 1000;

interface AwaitOptions {
  intervalMs?: number;
  timeoutMs?: number;
  /** Called with every status read, so a caller can show what the job is doing. */
  onProgress?: (job: JobMetadata) => void;
}

/**
 * Jobs API - unified job management for all job types
 */
export const jobsApi = {
  async listJobs(options: JobListOptions = {}): Promise<JobMetadata[]> {
    return unwrap(
      await client.GET('/api/jobs', { params: { query: options } }),
      'Failed to list jobs'
    );
  },

  /** null when there is no such job. */
  async getJob(jobId: string): Promise<JobMetadata | null> {
    const result = await client.GET('/api/jobs/{jobId}', { params: { path: { jobId } } });
    if (result.response.status === 404) return null;
    return unwrap(result, 'Failed to get job');
  },

  async getJobLogs(jobId: string): Promise<JobLog[]> {
    const data = unwrap(
      await client.GET('/api/jobs/{jobId}/logs', { params: { path: { jobId } } }),
      'Failed to get job logs'
    );
    return data.logs ?? [];
  },

  /** What the job produced, shaped by the job; null until it completes or when it produced nothing. */
  async getJobResult<T = unknown>(jobId: string): Promise<T | null> {
    const result = await client.GET('/api/jobs/{jobId}/result', { params: { path: { jobId } } });
    if (result.response.status === 404) return null;
    return (unwrap(result, 'Failed to get job result') as T | undefined) ?? null;
  },

  /**
   * Wait for a job to end (completed, failed or stopped) and return it as it
   * ended. Throws only when it takes longer than the timeout.
   */
  async awaitJob(jobId: string, options: AwaitOptions = {}): Promise<JobMetadata> {
    const interval = options.intervalMs ?? DEFAULT_AWAIT_INTERVAL_MS;
    const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_AWAIT_TIMEOUT_MS);
    for (;;) {
      const job = await jobsApi.getJob(jobId);
      if (job) {
        options.onProgress?.(job);
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'stopped') {
          return job;
        }
      }
      if (Date.now() > deadline) {
        throw new Error('Gave up waiting for the job; it is still listed under Operations');
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  },

  /**
   * Wait for a job to finish and return its result. For calls the API runs
   * as jobs because they can outlive the gateway's limit (the planner).
   * Throws with the job's own message when it fails or is stopped.
   */
  async awaitResult<T>(jobId: string, options: AwaitOptions = {}): Promise<T> {
    const job = await jobsApi.awaitJob(jobId, options);
    if (job.status !== 'completed') {
      throw new Error(job.error || job.message || 'The job failed');
    }
    const result = await jobsApi.getJobResult<T>(jobId);
    if (result === null) {
      throw new Error('The job finished without a result');
    }
    return result;
  },

  async stopJob(jobId: string): Promise<void> {
    unwrap(
      await client.POST('/api/jobs/{jobId}/stop', { params: { path: { jobId } } }),
      'Failed to stop job'
    );
  },
};
