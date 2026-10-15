import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { cadenceHours, kindStates, nextDue, pickDue, runScheduleTick } from '../scheduleTick';

const NOW = new Date('2026-10-15T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('schedules', () => {
  it('reads a cadence, or manual', () => {
    expect(cadenceHours('4h')).toBe(4);
    expect(cadenceHours('24h')).toBe(24);
    expect(cadenceHours('manual')).toBeNull();
    expect(cadenceHours(undefined)).toBeNull();
    expect(nextDue(6, hoursAgo(4), NOW).getTime()).toBe(NOW.getTime() + 2 * 3_600_000);
    expect(nextDue(6, undefined, NOW)).toEqual(NOW);
  });

  it("finds each kind's last completed run and whether one is going", () => {
    const states = kindStates([
      { jobType: 'export', status: 'completed', startTime: hoursAgo(30), endTime: hoursAgo(29) },
      { jobType: 'export', status: 'completed', startTime: hoursAgo(5), endTime: hoursAgo(4) },
      { jobType: 'export', status: 'failed', startTime: hoursAgo(1) },
      { jobType: 'activity-refresh', status: 'processing', startTime: hoursAgo(0.1) },
      { jobType: 'planner', status: 'completed', startTime: hoursAgo(0.2) },
    ]);
    expect(states.export).toEqual({ active: false, lastCompletedAt: hoursAgo(4) });
    expect(states['activity-refresh']).toEqual({ active: true });
    expect(states['smus-export']).toEqual({ active: false });
  });

  it('starts at most one due run, in flow order, never beside an export, and SMUS only when configured', () => {
    const cadence = (kind: string) =>
      kind === 'smus-export' ? 12 : kind === 'export' ? 6 : kind === 'activity-refresh' ? 4 : null;
    const idle = { active: false };
    // All due: SMUS goes first.
    expect(
      pickDue({
        cadence,
        states: { 'smus-export': idle, export: idle, 'activity-refresh': idle },
        smusEnabled: true,
        now: NOW,
      })
    ).toEqual({ kind: 'smus-export', skipped: [] });
    // SMUS not configured: the export, then.
    expect(
      pickDue({
        cadence,
        states: { 'smus-export': idle, export: idle, 'activity-refresh': idle },
        smusEnabled: false,
        now: NOW,
      })
    ).toEqual({ kind: 'export', skipped: ['SMUS is not configured'] });
    // The export ran 2 hours ago on a 6-hour cadence: activity, due on its 4 hours.
    expect(
      pickDue({
        cadence,
        states: {
          'smus-export': { active: false, lastCompletedAt: hoursAgo(1) },
          export: { active: false, lastCompletedAt: hoursAgo(2) },
          'activity-refresh': { active: false, lastCompletedAt: hoursAgo(5) },
        },
        smusEnabled: true,
        now: NOW,
      }).kind
    ).toBe('activity-refresh');
    // Nothing while an export is going.
    expect(
      pickDue({
        cadence,
        states: { 'smus-export': idle, export: { active: true }, 'activity-refresh': idle },
        smusEnabled: true,
        now: NOW,
      })
    ).toEqual({ kind: null, skipped: ['an export is running'] });
    // Manual everywhere: nothing, ever.
    expect(
      pickDue({
        cadence: () => null,
        states: { 'smus-export': idle, export: idle, 'activity-refresh': idle },
        smusEnabled: true,
        now: NOW,
      }).kind
    ).toBeNull();
  });

  it('runs a tick end to end and never throws', async () => {
    const start = vi.fn(async (kind: string) => `${kind}-1`);
    const result = await runScheduleTick({
      listJobs: async () => [],
      setting: (key) => (key === 'schedules.export' ? '6h' : 'manual'),
      smusEnabled: () => false,
      start,
      now: () => NOW,
    });
    expect(result).toEqual({ started: 'export', jobId: 'export-1', skipped: [] });
    expect(start).toHaveBeenCalledWith('export');
    const failed = await runScheduleTick({
      listJobs: async () => {
        throw new Error('dynamo down');
      },
      setting: () => '4h',
      smusEnabled: () => false,
      start,
      now: () => NOW,
    });
    expect(failed).toEqual({ started: null, skipped: ['the tick failed'] });
  });
});
