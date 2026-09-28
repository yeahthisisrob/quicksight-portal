import { JOB_CONFIG } from '../../constants';

/** Days past retention before the table's TTL may remove a job's items; the cleanup sweep normally wins. */
const JOB_TTL_GRACE_DAYS = 7;
const SECONDS_PER_DAY = 86_400;
const MS_PER_SECOND = 1000;

/** When a job's items expire (epoch seconds), counted from `fromMs` (its start, or now). */
export function jobExpiresAt(fromMs: number = Date.now()): number {
  return (
    Math.ceil(fromMs / MS_PER_SECOND) +
    (JOB_CONFIG.DEFAULT_RETENTION_DAYS + JOB_TTL_GRACE_DAYS) * SECONDS_PER_DAY
  );
}
