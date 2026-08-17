/**
 * Ingestion display helpers shared by the Ingestions page and dataset
 * activity UI.
 */

/** Statuses for which an ingestion is still in flight (and cancellable). */
export const INGESTION_ACTIVE_STATUSES = ['RUNNING', 'QUEUED', 'INITIALIZED'] as const;

/** Human-readable ingestion duration, e.g. "1h 4m 12s". */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
