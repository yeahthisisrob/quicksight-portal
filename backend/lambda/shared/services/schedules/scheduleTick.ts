/**
 * The runs the portal starts by itself. One timer fires the worker every
 * hour; the tick reads the three cadences from Settings, finds when each
 * kind last completed and whether one is going, and starts at most one
 * run that is due, in the order the data flows: the SMUS export, then the
 * Smart Sync export, then the activity refresh. Nothing starts while an
 * export is in flight, since the other two read what it produces. Manual,
 * the default, means a kind never starts by itself.
 */

import { metadataBucketName } from '../../config/metadataBucket';
import { getSmusConfig } from '../../config/smusConfig';
import { logger } from '../../utils/logger';
import { jobFactory } from '../jobs/JobFactory';
import { JobRepository } from '../jobs/JobRepository';
import { settingsStore } from '../settings/SettingsStore';

export type ScheduledJobType = 'smus-export' | 'export' | 'activity-refresh';

/** The Settings key that holds each kind's cadence. */
const SCHEDULE_SETTING: Record<ScheduledJobType, string> = {
  'smus-export': 'schedules.smus',
  export: 'schedules.export',
  'activity-refresh': 'schedules.activity',
};

/** In the order the data flows: each reads what the one before produced. */
const PRIORITY: ScheduledJobType[] = ['smus-export', 'export', 'activity-refresh'];
const ACTIVE = new Set(['queued', 'processing', 'stopping']);
const SECONDS_PER_HOUR = 3_600;
const MS_PER_SECOND = 1_000;
const MS_PER_HOUR = SECONDS_PER_HOUR * MS_PER_SECOND;
/** How many recent jobs to read to find each kind's last run; the list is newest first. */
const RECENT_JOBS = 200;
/** Who started a scheduled run, on the job. */
const SCHEDULE_ACTOR = 'schedule';

/** The cadence a setting value names, in hours; null for manual or anything unknown. */
export function cadenceHours(value: string | undefined): number | null {
  const match = /^(\d+)h$/.exec(value ?? '');
  return match ? Number(match[1]) : null;
}

/** When the next run is due given a cadence and the last completed run (now, when it never ran). */
export function nextDue(cadence: number, lastCompletedAt: string | undefined, now: Date): Date {
  return lastCompletedAt
    ? new Date(new Date(lastCompletedAt).getTime() + cadence * MS_PER_HOUR)
    : now;
}

export interface KindState {
  lastCompletedAt?: string;
  active: boolean;
}

/** What each kind's recent jobs say: when it last completed and whether one is going. */
export function kindStates(
  jobs: Array<{ jobType: string; status: string; startTime: string; endTime?: string }>
): Record<ScheduledJobType, KindState> {
  const states = Object.fromEntries(
    PRIORITY.map((kind) => [kind, { active: false } as KindState])
  ) as Record<ScheduledJobType, KindState>;
  for (const job of jobs) {
    const state = states[job.jobType as ScheduledJobType];
    if (!state) continue;
    if (ACTIVE.has(job.status)) state.active = true;
    if (job.status === 'completed') {
      const at = job.endTime ?? job.startTime;
      if (!state.lastCompletedAt || at > state.lastCompletedAt) state.lastCompletedAt = at;
    }
  }
  return states;
}

/**
 * The one kind to start now, or null: the first in flow order whose
 * cadence says it is due and that is not already going. Nothing while an
 * export is going; the SMUS export only when SMUS is configured.
 */
export function pickDue(input: {
  cadence: (kind: ScheduledJobType) => number | null;
  states: Record<ScheduledJobType, KindState>;
  smusEnabled: boolean;
  now: Date;
}): { kind: ScheduledJobType | null; skipped: string[] } {
  const skipped: string[] = [];
  if (input.states.export.active) {
    return { kind: null, skipped: ['an export is running'] };
  }
  for (const kind of PRIORITY) {
    const cadence = input.cadence(kind);
    if (cadence === null) continue;
    if (kind === 'smus-export' && !input.smusEnabled) {
      skipped.push('SMUS is not configured');
      continue;
    }
    const state = input.states[kind];
    if (state.active) {
      skipped.push(`${kind} is running`);
      continue;
    }
    if (nextDue(cadence, state.lastCompletedAt, input.now) > input.now) continue;
    return { kind, skipped };
  }
  return { kind: null, skipped };
}

interface TickDeps {
  listJobs: () => Promise<
    Array<{ jobType: string; status: string; startTime: string; endTime?: string }>
  >;
  setting: (key: string) => string;
  smusEnabled: () => boolean;
  start: (kind: ScheduledJobType) => Promise<string>;
  now?: () => Date;
}

/** One tick: read, decide, start at most one run. Never throws; the timer fires again in an hour. */
export async function runScheduleTick(deps: TickDeps = defaultDeps()): Promise<{
  started: ScheduledJobType | null;
  jobId?: string;
  skipped: string[];
}> {
  try {
    const states = kindStates(await deps.listJobs());
    const { kind, skipped } = pickDue({
      cadence: (k) => cadenceHours(deps.setting(SCHEDULE_SETTING[k])),
      states,
      smusEnabled: deps.smusEnabled(),
      now: (deps.now ?? (() => new Date()))(),
    });
    if (!kind) {
      logger.info('Schedule tick: nothing due', { skipped });
      return { started: null, skipped };
    }
    const jobId = await deps.start(kind);
    logger.info('Schedule tick started a run', { kind, jobId, skipped });
    return { started: kind, jobId, skipped };
  } catch (error) {
    logger.error('Schedule tick failed', { error });
    return { started: null, skipped: ['the tick failed'] };
  }
}

function defaultDeps(): TickDeps {
  const accountId = process.env.AWS_ACCOUNT_ID || '';
  const bucketName = metadataBucketName(accountId);
  return {
    listJobs: () => new JobRepository().listJobs({ limit: RECENT_JOBS }),
    setting: (key) => settingsStore.getString(key),
    smusEnabled: () => getSmusConfig().enabled,
    start: async (kind) => {
      const base = { accountId, bucketName, startedBy: SCHEDULE_ACTOR };
      const queued =
        kind === 'export'
          ? await jobFactory.createJob({
              ...base,
              jobType: 'export',
              options: { forceRefresh: false, rebuildIndex: false },
            })
          : kind === 'activity-refresh'
            ? await jobFactory.createJob({
                ...base,
                jobType: 'activity-refresh',
                options: { assetTypes: ['all'] },
              })
            : await jobFactory.createJob({
                ...base,
                jobType: 'smus-export',
                options: { smus: getSmusConfig() },
              });
      return queued.jobId;
    },
  };
}
