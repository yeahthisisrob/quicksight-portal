import { describe, expect, it } from 'vitest';

import {
  apiCalls,
  formatDuration,
  isActive,
  itemsSummary,
  jobDuration,
  jobTypeLabel,
  startedByLabel,
} from '../jobPresentation';

describe('job presentation', () => {
  it('names every job type, and tells ingestion exports apart', () => {
    expect(jobTypeLabel({ jobType: 'smus-export' })).toBe('SMUS export');
    expect(jobTypeLabel({ jobType: 'asset-refresh' })).toBe('Asset refresh');
    expect(jobTypeLabel({ jobType: 'export', exportOptions: { exportIngestions: true } })).toBe(
      'Export (ingestions)'
    );
  });

  it('knows which statuses are still going', () => {
    expect(isActive('processing')).toBe(true);
    expect(isActive('stopping')).toBe(true);
    expect(isActive('completed')).toBe(false);
    expect(isActive(undefined)).toBe(false);
  });

  it('formats durations for people', () => {
    expect(formatDuration(8_400)).toBe('8s');
    expect(formatDuration(192_000)).toBe('3m 12s');
    expect(formatDuration(3_840_000)).toBe('1h 4m');
    expect(formatDuration(null)).toBe('-');
  });

  it('works out a duration the record does not carry, running up to now', () => {
    const start = '2026-09-26T10:00:00Z';
    const now = Date.parse('2026-09-26T10:05:00Z');
    expect(jobDuration({ startTime: start, status: 'processing' }, now)).toBe(300_000);
    expect(
      jobDuration({ startTime: start, endTime: '2026-09-26T10:01:00Z', status: 'completed' }, now)
    ).toBe(60_000);
    expect(jobDuration({ startTime: start, status: 'failed' }, now)).toBeNull();
    expect(jobDuration({ startTime: start, status: 'completed', duration: 42 }, now)).toBe(42);
  });

  it('counts only QuickSight calls, falling back to the plain total', () => {
    expect(
      apiCalls({
        stats: { operations: { 'api.dashboard.describe': 3, 'api.list': 2, 's3.get': 9 } },
      })
    ).toBe(5);
    expect(apiCalls({ stats: { apiCalls: 7 } })).toBe(7);
    expect(apiCalls({})).toBeNull();
  });

  it('names who started it, never an opaque sign-in id', () => {
    expect(startedByLabel({ startedBy: 'rob@example.com', userId: '4f1c' })).toBe(
      'rob@example.com'
    );
    expect(startedByLabel({ userId: 'analyst@example.com' })).toBe('analyst@example.com');
    expect(startedByLabel({ userId: 'api-key:claude-cli' })).toBe('claude-cli (API key)');
    expect(startedByLabel({ userId: '4f1c8a2e-9b3d-4e5f-8a6b-7c8d9e0f1a2b' })).toBe(
      'A portal user'
    );
    expect(startedByLabel({})).toBe('The portal');
  });

  it('summarises items worked through and failed', () => {
    expect(
      itemsSummary({ stats: { processedAssets: 412, totalAssets: 500, failedAssets: 3 } })
    ).toBe('412 / 500 · 3 failed');
    expect(itemsSummary({ stats: { processedAssets: 5, totalAssets: 5 } })).toBe('5 / 5');
    expect(itemsSummary({})).toBe('-');
  });
});
