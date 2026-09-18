import { describe, expect, it } from 'vitest';

import { MAX_RECORDED_FAILURES, summarizeBulkResult } from '../bulkResultSummary';

const OVER_CAP = 5;

const item = (label: string, error?: string) =>
  error ? { success: false, item: label, error } : { success: true, item: label, message: 'ok' };

describe('summarizeBulkResult', () => {
  it('reports a clean run with no error or failures', () => {
    const summary = summarizeBulkResult({
      operationType: 'group-add',
      totalItems: 2,
      successCount: 2,
      failureCount: 0,
      results: [item('alice → analysts'), item('bob → analysts')],
    });

    expect(summary).toEqual({
      message: 'Bulk group-add completed: 2/2 successful',
      failures: [],
    });
  });

  it('lifts per-item failures and their reasons onto the summary', () => {
    const sdkError = 'No value provided for HTTP label: MemberName.';
    const summary = summarizeBulkResult({
      operationType: 'group-add',
      totalItems: 3,
      successCount: 1,
      failureCount: 2,
      results: [
        item('alice → analysts'),
        item('null → analysts', sdkError),
        item('null → analysts', sdkError),
      ],
    });

    expect(summary.message).toBe('Bulk group-add completed: 1/3 successful (2 failed)');
    expect(summary.error).toBe(`2× ${sdkError}`);
    expect(summary.failures).toEqual([
      { item: 'null → analysts', error: sdkError },
      { item: 'null → analysts', error: sdkError },
    ]);
  });

  it('lists distinct reasons most common first and defaults missing reasons', () => {
    const summary = summarizeBulkResult({
      operationType: 'group-remove',
      totalItems: 4,
      successCount: 0,
      failureCount: 4,
      results: [
        item('a → g', 'User not found'),
        item('b → g', 'Throttled'),
        item('c → g', 'Throttled'),
        { success: false, item: 'd → g' },
      ],
    });

    expect(summary.error).toBe('2× Throttled; User not found; Unknown error');
    expect(summary.failures.map((f) => f.error)).toEqual([
      'User not found',
      'Throttled',
      'Throttled',
      'Unknown error',
    ]);
  });

  it('caps the failures kept on the job record', () => {
    const results = Array.from({ length: MAX_RECORDED_FAILURES + OVER_CAP }, (_, i) =>
      item(`user${i} → g`, 'boom')
    );
    const summary = summarizeBulkResult({
      operationType: 'group-add',
      totalItems: results.length,
      successCount: 0,
      failureCount: results.length,
      results,
    });

    expect(summary.failures).toHaveLength(MAX_RECORDED_FAILURES);
    expect(summary.message).toContain(`(${results.length} failed)`);
  });
});
