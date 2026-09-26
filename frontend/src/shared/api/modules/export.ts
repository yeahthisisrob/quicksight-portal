import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';
import { type JobListOptions, jobsApi } from './jobs';

export type ExportJobRequest = components['schemas']['ExportJobRequest'];

/**
 * Export API - the full export (and its jobs), and the cache summary.
 */
export const exportApi = {
  /** Queue an export; only one runs at a time (a second is refused with 409). */
  async startExportJob(options: ExportJobRequest = {}) {
    return unwrap(
      await client.POST('/api/export', { body: options }),
      'Failed to start export job'
    );
  },

  /** Recent jobs of any type; pass `type` to filter to one. */
  async listJobs(options: JobListOptions = {}) {
    return { jobs: await jobsApi.listJobs(options) };
  },

  async getJobStatus(jobId: string) {
    const job = await jobsApi.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  },

  async getJobLogs(jobId: string) {
    return { jobId, logs: await jobsApi.getJobLogs(jobId) };
  },

  stopJob(jobId: string) {
    return jobsApi.stopJob(jobId);
  },

  async getExportSummary() {
    return unwrap(await client.GET('/api/export/summary'), 'Failed to get export summary');
  },

  /** Wake the Lambda before a long call; the summary is the cheapest read. */
  async warmUp() {
    try {
      await exportApi.getExportSummary();
      return true;
    } catch {
      return false;
    }
  },
};
