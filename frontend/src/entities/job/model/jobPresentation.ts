/**
 * How a job reads to a person: its type in words, its status as a tone,
 * how long it took, how much it touched. One place, so the Jobs tab, the
 * Export tab and every job card say the same thing the same way.
 */
import type { JobMetadata, JobStatus, JobType } from '@/shared/api/modules/jobs';
import type { StatusType } from '@/shared/design-system';

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  export: 'Export',
  'activity-refresh': 'Activity refresh',
  'smus-export': 'SMUS export',
  'bulk-operation': 'Bulk operation',
  'csv-export': 'CSV export',
  planner: 'Planner',
  assistant: 'Assistant',
  deploy: 'Deploy',
  ingestion: 'Ingestion',
  rebuild: 'Rebuild',
  'asset-refresh': 'Asset refresh',
};

export const JOB_STATUS_TONE: Record<JobStatus, { type: StatusType; label: string }> = {
  completed: { type: 'success', label: 'Completed' },
  failed: { type: 'error', label: 'Failed' },
  stopped: { type: 'stopped', label: 'Stopped' },
  stopping: { type: 'warning', label: 'Stopping' },
  processing: { type: 'in-progress', label: 'Running' },
  queued: { type: 'pending', label: 'Queued' },
};

const ACTIVE: readonly JobStatus[] = ['queued', 'processing', 'stopping'];

/** Still going: worth polling, and worth a Stop button. */
export function isActive(status: JobStatus | undefined): boolean {
  return status !== undefined && ACTIVE.includes(status);
}

/** Ingestion exports run as jobType 'export'; tell them apart by their options. */
export function jobTypeLabel(job: Pick<JobMetadata, 'jobType' | 'exportOptions'>): string {
  if (job.jobType === 'export' && job.exportOptions?.exportIngestions) {
    return 'Export (ingestions)';
  }
  return JOB_TYPE_LABELS[job.jobType] ?? job.jobType ?? 'Unknown';
}

const MS_PER_S = 1000;
const S_PER_MIN = 60;
const MIN_PER_H = 60;

/** "1h 4m", "3m 12s", "8s"; a dash for nothing. */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '-';
  const seconds = Math.floor(ms / MS_PER_S);
  const minutes = Math.floor(seconds / S_PER_MIN);
  const hours = Math.floor(minutes / MIN_PER_H);
  if (hours > 0) return `${hours}h ${minutes % MIN_PER_H}m`;
  if (minutes > 0) return `${minutes}m ${seconds % S_PER_MIN}s`;
  return `${seconds}s`;
}

/** How long it ran: the recorded duration, or start to end (or to now, while it runs). */
export function jobDuration(
  job: Pick<JobMetadata, 'duration' | 'startTime' | 'endTime' | 'status'>,
  now = Date.now()
): number | null {
  if (job.duration) return job.duration;
  const start = Date.parse(job.startTime);
  if (!Number.isFinite(start)) return null;
  const end = job.endTime ? Date.parse(job.endTime) : isActive(job.status) ? now : Number.NaN;
  return Number.isFinite(end) ? Math.max(0, end - start) : null;
}

/**
 * QuickSight API calls from the tracked per-operation counts. Operations are
 * namespaced ('api.dashboard.describe', 's3.get', ...); only api.* rows are
 * API calls. Null when the job tracked none.
 */
export function apiCalls(job: Pick<JobMetadata, 'stats'>): number | null {
  const ops = job.stats?.operations;
  const entries = ops ? Object.entries(ops).filter(([key]) => key.startsWith('api.')) : [];
  if (entries.length > 0) {
    return entries.reduce((sum, [, value]) => sum + value, 0);
  }
  return job.stats?.apiCalls ?? null;
}

/** "412 / 500", "3 failed" - what it worked through, when it counts items. */
export function itemsSummary(job: Pick<JobMetadata, 'stats'>): string {
  const { processedAssets, totalAssets, failedAssets } = job.stats ?? {};
  if (processedAssets === undefined && totalAssets === undefined) return '-';
  const done = `${processedAssets ?? 0} / ${totalAssets ?? 0}`;
  return failedAssets ? `${done} · ${failedAssets} failed` : done;
}
