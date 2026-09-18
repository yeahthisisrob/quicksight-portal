/**
 * Turns a BulkOperationResult into what the job record should say about it.
 *
 * Per-item outcomes already live in the stored job result; this lifts the
 * parts a human needs (how many failed, why) onto the job's message / error /
 * failures fields so the UI and the jobs list can show them without a second
 * fetch or a trip to the logs.
 */

import type { BulkItemFailure, BulkOperationResult } from '../../types/bulkOperationTypes';

/** Failures kept on the job record itself; the full list stays in the result */
export const MAX_RECORDED_FAILURES = 25;

export interface BulkResultSummary {
  /** One-line outcome, e.g. "Bulk group-add completed: 2/3 successful (1 failed)" */
  message: string;
  /** Set only when something failed: distinct reasons, most common first */
  error?: string;
  /** Item-level failures, capped at MAX_RECORDED_FAILURES */
  failures: BulkItemFailure[];
}

const UNKNOWN_ERROR = 'Unknown error';

export type BulkResultInput = Pick<
  BulkOperationResult,
  'operationType' | 'totalItems' | 'successCount' | 'failureCount' | 'results'
>;

export function summarizeBulkResult(
  result: BulkResultInput,
  maxFailures: number = MAX_RECORDED_FAILURES
): BulkResultSummary {
  const failures: BulkItemFailure[] = result.results
    .filter((item) => !item.success)
    .map((item) => ({ item: item.item, error: item.error || UNKNOWN_ERROR }));

  const base = `Bulk ${result.operationType} completed: ${result.successCount}/${result.totalItems} successful`;

  if (failures.length === 0) {
    return { message: base, failures: [] };
  }

  return {
    message: `${base} (${failures.length} failed)`,
    error: describeFailureReasons(failures),
    failures: failures.slice(0, maxFailures),
  };
}

/**
 * Collapse item failures into their distinct reasons with counts, e.g.
 * "2× No value provided for HTTP label: MemberName; 1× User not found"
 */
function describeFailureReasons(failures: BulkItemFailure[]): string {
  const counts = new Map<string, number>();
  for (const failure of failures) {
    counts.set(failure.error, (counts.get(failure.error) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => (count > 1 ? `${count}× ${reason}` : reason))
    .join('; ');
}
