import { type RouteHandler } from '../../api/types';
import { JobHandler } from '../handlers/JobHandler';

const jobHandler = new JobHandler();

export const jobRoutes: RouteHandler[] = [
  // List jobs
  {
    method: 'GET',
    path: '/jobs',
    handler: (event) => jobHandler.listJobs(event),
  },

  // Clean up old jobs
  {
    method: 'POST',
    path: '/jobs/cleanup',
    handler: (event) => jobHandler.cleanupJobs(event),
  },

  // Get job details
  {
    method: 'GET',
    path: /^\/jobs\/([^/]+)$/,
    handler: (event) => jobHandler.getJob(event),
  },

  // Get job logs
  {
    method: 'GET',
    path: /^\/jobs\/([^/]+)\/logs$/,
    handler: (event) => jobHandler.getJobLogs(event),
  },

  // Get job result
  {
    method: 'GET',
    path: /^\/jobs\/([^/]+)\/result$/,
    handler: (event) => jobHandler.getJobResult(event),
  },

  // Stop a job
  {
    method: 'POST',
    path: /^\/jobs\/([^/]+)\/stop$/,
    handler: (event) => jobHandler.stopJob(event),
  },

  // Delete a job
  {
    method: 'DELETE',
    path: /^\/jobs\/([^/]+)$/,
    handler: (event) => jobHandler.deleteJob(event),
  },
];
