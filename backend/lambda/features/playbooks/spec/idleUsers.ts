/**
 * Deleting readers nobody uses: a seat paid for, reaching nothing, not
 * signed in for months. With an identity provider that provisions readers
 * on sign-in, one who comes back simply gets a seat again.
 *
 * The selection (role, inactiveForDays, noAccess) finds them from the list;
 * this step is the last look before a delete, and it trusts nothing it can
 * check again: the activity must cover the window and be fresh, and the
 * user's own activity is read again. The delete itself is the portal's,
 * which refuses anyone who is not a reader.
 */
import { TIME_UNITS } from '../../../shared/constants';
import { type PlaybookContext, type PlaybookTarget, PortalCallError } from '../types';
import { resolve } from './inputs';
import type { SpecSession } from './session';
import type { StepPlan } from './steps';
import type { DeleteUserStep } from './types';

const DAY_MS = TIME_UNITS.DAY;
/** Activity older than this is too stale to say anyone is idle. */
const STALE_AFTER_DAYS = 2;
const NOT_FOUND = 404;

export interface ActivityCoverage {
  start: string | null;
  end: string | null;
  lastUpdated: string | null;
  days: number;
}

/** The user's last activity, live; null when they have none on record. */
async function lastActive(ctx: PlaybookContext, userName: string): Promise<number | null> {
  try {
    const activity = await ctx.call<{ lastActive?: string | null }>(
      'GET',
      `/api/activity/user/${encodeURIComponent(userName)}`
    );
    return activity?.lastActive ? Date.parse(activity.lastActive) : null;
  } catch (error) {
    if (error instanceof PortalCallError && error.status === NOT_FOUND) return null;
    throw error;
  }
}

export async function planDeleteUser(
  ctx: PlaybookContext,
  session: SpecSession,
  target: PlaybookTarget,
  step: DeleteUserStep
): Promise<StepPlan> {
  const plan = (verdict: StepPlan['verdict'], summary: string, changes: string[] = []) => ({
    kind: step.kind,
    verdict,
    summary,
    changes,
  });
  if (target.assetType !== 'user') return plan('skip', 'Applies to users');
  const days = Number(resolve(step.inactiveDays, ctx.params));
  if (!(days > 0)) return plan('review', 'No inactivity window was given');

  const coverage = await session.activityCoverage();
  if (coverage.days < days) {
    return plan(
      'review',
      `Activity covers ${coverage.days} day${coverage.days === 1 ? '' : 's'}, so ${days} days without it cannot be told yet`
    );
  }
  const refreshed = coverage.lastUpdated ? Date.parse(coverage.lastUpdated) : Number.NaN;
  if (Number.isNaN(refreshed) || Date.now() - refreshed > STALE_AFTER_DAYS * DAY_MS) {
    return plan('review', 'Activity has not been refreshed recently; refresh it first');
  }

  const last = await lastActive(ctx, target.assetId);
  if (last !== null && Date.now() - last < days * DAY_MS) {
    return plan('skip', `Active ${Math.floor((Date.now() - last) / DAY_MS)} days ago`);
  }
  return plan(
    'change',
    last === null
      ? 'No activity on record'
      : `Last active ${new Date(last).toISOString().slice(0, 10)}`,
    [`Delete ${target.name}`]
  );
}

export async function applyDeleteUser(
  ctx: PlaybookContext,
  target: PlaybookTarget
): Promise<string> {
  const result = await ctx.call<{ message?: string }>(
    'DELETE',
    `/api/users/${encodeURIComponent(target.assetId)}`
  );
  return result?.message ?? `Deleted ${target.name}`;
}
