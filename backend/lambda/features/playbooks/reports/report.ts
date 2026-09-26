/**
 * A preview's or run's report: what the playbook was, what it was given,
 * how it went, and every asset's row. Built from the job and its rows; the
 * same shape whether read live or saved.
 */
import {
  countItems,
  type JobItem,
  type JobItemCounts,
} from '../../../shared/services/jobs/JobItemStore';
import type { JobMetadata } from '../../../shared/services/jobs/JobRepository';

export interface PlaybookReport {
  jobId: string;
  playbookId: string;
  playbookTitle: string;
  mode: 'preview' | 'run';
  status: string;
  message?: string;
  startedBy?: string;
  startTime: string;
  endTime?: string;
  params: Record<string, unknown>;
  gates?: Record<string, unknown>;
  counts: JobItemCounts;
  items: JobItem[];
  savedAt?: string;
  savedBy?: string;
}

export type PlaybookReportSummary = Omit<PlaybookReport, 'items' | 'params' | 'gates'>;

export function buildReport(
  job: JobMetadata,
  rows: JobItem[],
  playbookTitle: string
): PlaybookReport {
  const info = job.playbook!;
  return {
    jobId: job.jobId,
    playbookId: info.playbookId,
    playbookTitle,
    mode: info.mode,
    status: job.status,
    ...(job.message ? { message: job.message } : {}),
    ...(job.startedBy ? { startedBy: job.startedBy } : {}),
    startTime: job.startTime,
    ...(job.endTime ? { endTime: job.endTime } : {}),
    params: (info.params ?? {}) as Record<string, unknown>,
    ...(info.gates ? { gates: info.gates as Record<string, unknown> } : {}),
    counts: countItems(rows),
    // The playbook's own plan data is for the engine, not the reader.
    items: rows.map(({ plan: _plan, ...row }) => row),
  };
}

export function summarize(report: PlaybookReport): PlaybookReportSummary {
  const { items: _items, params: _params, gates: _gates, ...summary } = report;
  return summary;
}
