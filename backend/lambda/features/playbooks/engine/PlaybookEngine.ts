/**
 * Runs a playbook over its rows. A preview scopes it and plans every asset;
 * a run takes the preview's 'change' rows (or an earlier run's failures),
 * plans each again against what QuickSight has now, and applies it. Either
 * stops starting new rows before the Lambda time limit and says so, so the
 * worker can hand the job to a fresh invocation that carries on from the
 * rows (nothing is redone: a row that is no longer pending is finished).
 */
import {
  countItems,
  type JobItem,
  type JobItemCounts,
  jobItemKey,
} from '../../../shared/services/jobs/JobItemStore';
import { errorMessage } from '../../../shared/utils/errorMessage';
import {
  DEFAULT_RUN_LIMITS,
  type ItemPlan,
  type Playbook,
  type PlaybookContext,
  type PlaybookJobRequest,
  type PlaybookTarget,
  type RunLimits,
} from '../types';
import { applyGates, type GateValues } from './gates';

/** What the engine needs from the job it runs in. */
export interface EngineJob {
  jobId: string;
  items: {
    all(jobId: string): Promise<JobItem[]>;
    putAll(jobId: string, items: JobItem[]): Promise<void>;
    put(jobId: string, item: JobItem): Promise<void>;
  };
  progress(message: string, counts: JobItemCounts): Promise<void>;
  log(level: 'info' | 'warn' | 'error', message: string): Promise<void>;
  stopRequested(): Promise<boolean>;
  /** Epoch ms to stop starting new rows by; null for no limit. */
  deadline: number | null;
  now?: () => number;
}

export type EngineOutcome =
  | { state: 'finished'; counts: JobItemCounts }
  /** Out of time: the job goes on in another invocation. */
  | { state: 'paused'; counts: JobItemCounts }
  | { state: 'stopped'; counts: JobItemCounts }
  /** Too many failed: the rest were left alone. */
  | { state: 'halted'; counts: JobItemCounts; reason: string };

const PROGRESS_EVERY_MS = 2_000;
const PERCENT = 100;
const STOP_CHECK_EVERY_MS = 5_000;

function targetOf(row: JobItem): PlaybookTarget {
  return { assetType: row.assetType, assetId: row.assetId, name: row.name };
}

export class PlaybookEngine {
  private rows: JobItem[] = [];
  private lastProgress = 0;
  private lastStopCheck = 0;
  private stopSeen = false;
  private pendingStop: Promise<boolean> | null = null;
  private readonly now: () => number;

  public constructor(
    private readonly playbook: Playbook,
    private readonly ctx: PlaybookContext,
    private readonly job: EngineJob
  ) {
    this.now = job.now ?? Date.now;
  }

  public async execute(request: PlaybookJobRequest): Promise<EngineOutcome> {
    this.rows = await this.job.items.all(this.job.jobId);
    if (request.mode === 'preview') {
      if (this.rows.length === 0) {
        await this.seedFromScope(request.gates ?? {});
      }
      // A preview changes nothing, so failures are just findings: it never halts on them.
      return await this.work('Checked', (row) => this.check(row), {
        ...DEFAULT_RUN_LIMITS,
        failureMinimum: Number.POSITIVE_INFINITY,
      });
    }
    if (this.rows.length === 0) {
      await this.seedFromEarlierJob(request);
    }
    const limits = { ...DEFAULT_RUN_LIMITS, ...(request.limits ?? {}) };
    return await this.work('Worked through', (row) => this.change(row), limits);
  }

  // --- seeding ---------------------------------------------------------------

  private async seedFromScope(gates: GateValues): Promise<void> {
    const targets = await this.playbook.scope(this.ctx);
    const held = applyGates(this.playbook, targets, gates, this.now());
    const seen = new Set<string>();
    const now = new Date(this.now()).toISOString();
    for (const target of targets) {
      const stage = this.playbook.stage?.(target) ?? 0;
      const key = jobItemKey(stage, target.assetType, target.assetId);
      if (seen.has(key)) continue;
      seen.add(key);
      const reason = held.get(target);
      this.rows.push({
        key,
        stage,
        assetType: target.assetType,
        assetId: target.assetId,
        name: target.name,
        updatedAt: now,
        ...(reason
          ? { status: 'skipped' as const, verdict: 'skip' as const, summary: reason }
          : { status: 'pending' as const }),
      });
    }
    this.rows.sort((a, b) => a.key.localeCompare(b.key));
    await this.job.items.putAll(this.job.jobId, this.rows);
    await this.job.log(
      'info',
      `${this.rows.length} asset(s) in scope${held.size ? `, ${held.size} held back by gates` : ''}`
    );
  }

  private async seedFromEarlierJob(request: Extract<PlaybookJobRequest, { mode: 'run' }>) {
    const source = request.retryOf ?? request.previewJobId;
    const earlier = await this.job.items.all(source);
    const wanted = request.keys ? new Set(request.keys) : null;
    const now = new Date(this.now()).toISOString();
    this.rows = earlier
      .filter((row) =>
        request.retryOf
          ? // Its failures, and what it never got to (it was stopped, or halted on failures).
            row.status === 'failed' || row.status === 'pending'
          : row.verdict === 'change' && (!wanted || wanted.has(row.key))
      )
      .map((row) => ({
        key: row.key,
        stage: row.stage,
        assetType: row.assetType,
        assetId: row.assetId,
        name: row.name,
        status: 'pending' as const,
        updatedAt: now,
        ...(row.changes ? { changes: row.changes } : {}),
      }));
    await this.job.items.putAll(this.job.jobId, this.rows);
    await this.job.log(
      'info',
      request.retryOf
        ? `Retrying ${this.rows.length} asset(s) that failed or were not reached in ${request.retryOf}`
        : `${this.rows.length} asset(s) to change`
    );
  }

  // --- the loop --------------------------------------------------------------

  /**
   * Work through the pending rows stage by stage, `limits.concurrency` at a
   * time. A stage's rows all finish before the next stage starts.
   */
  private async work(
    verb: string,
    handle: (row: JobItem) => Promise<JobItem>,
    limits: RunLimits
  ): Promise<EngineOutcome> {
    const stages = [...new Set(this.rows.map((r) => r.stage))].sort((a, b) => a - b);
    for (const stage of stages) {
      const queue = this.rows.filter((r) => r.stage === stage && r.status === 'pending');
      let halt: string | null = null;
      let paused = false;
      const next = async (): Promise<void> => {
        for (;;) {
          if (halt || paused || this.stopSeen) return;
          if (this.job.deadline !== null && this.now() >= this.job.deadline) {
            paused = true;
            return;
          }
          if (await this.checkStop()) return;
          const row = queue.shift();
          if (!row) return;
          const done = await handle(row);
          this.replace(done);
          await this.job.items.put(this.job.jobId, done);
          halt = halt ?? this.overThreshold(limits);
          await this.report(verb);
        }
      };
      await Promise.all(Array.from({ length: Math.max(1, limits.concurrency) }, () => next()));

      const counts = countItems(this.rows);
      if (this.stopSeen) {
        await this.report(verb, true);
        return { state: 'stopped', counts };
      }
      if (halt) {
        await this.job.log('error', halt);
        await this.report(verb, true);
        return { state: 'halted', counts, reason: halt };
      }
      if (paused) {
        await this.report(verb, true);
        return { state: 'paused', counts };
      }
    }
    await this.report(verb, true);
    return { state: 'finished', counts: countItems(this.rows) };
  }

  /** Preview: plan one asset. */
  private async check(row: JobItem): Promise<JobItem> {
    const updatedAt = new Date(this.now()).toISOString();
    try {
      const plan = await this.playbook.plan(this.ctx, targetOf(row));
      return {
        ...row,
        status: 'planned',
        verdict: plan.verdict,
        summary: plan.summary,
        ...(plan.changes?.length ? { changes: plan.changes } : {}),
        ...(plan.data === undefined ? {} : { plan: plan.data }),
        updatedAt,
      };
    } catch (error) {
      return { ...row, status: 'failed', error: errorMessage(error), updatedAt };
    }
  }

  /**
   * Run: plan it again against what is there now (the preview may be hours
   * old, or someone fixed it by hand since), then apply.
   */
  private async change(row: JobItem): Promise<JobItem> {
    const attempts = (row.attempts ?? 0) + 1;
    const stamp = () => new Date(this.now()).toISOString();
    let plan: ItemPlan;
    try {
      plan = await this.playbook.plan(this.ctx, targetOf(row));
    } catch (error) {
      return { ...row, status: 'failed', error: errorMessage(error), attempts, updatedAt: stamp() };
    }
    if (plan.verdict !== 'change') {
      return {
        ...row,
        status: plan.verdict === 'skip' ? 'skipped' : 'review',
        verdict: plan.verdict,
        summary: plan.verdict === 'skip' ? `Nothing to do now: ${plan.summary}` : plan.summary,
        ...(plan.changes?.length ? { changes: plan.changes } : {}),
        attempts,
        updatedAt: stamp(),
      };
    }
    try {
      const outcome = await this.playbook.apply(this.ctx, targetOf(row), plan);
      return {
        ...row,
        status: 'done',
        verdict: 'change',
        summary: outcome.summary,
        ...(plan.changes?.length ? { changes: plan.changes } : {}),
        ...(outcome.warnings?.length ? { warnings: outcome.warnings } : {}),
        attempts,
        updatedAt: stamp(),
      };
    } catch (error) {
      return {
        ...row,
        status: 'failed',
        verdict: 'change',
        error: errorMessage(error),
        ...(plan.changes?.length ? { changes: plan.changes } : {}),
        attempts,
        updatedAt: stamp(),
      };
    }
  }

  // --- bookkeeping -------------------------------------------------------------

  private replace(row: JobItem): void {
    const index = this.rows.findIndex((r) => r.key === row.key);
    if (index >= 0) this.rows[index] = row;
  }

  private overThreshold(limits: RunLimits): string | null {
    const counts = countItems(this.rows);
    const tried = counts.done + counts.failed;
    if (tried < limits.failureMinimum || counts.failed === 0) return null;
    const share = counts.failed / tried;
    return share > limits.failureThreshold
      ? `Stopped: ${counts.failed} of ${tried} failed (over ${Math.round(limits.failureThreshold * PERCENT)}%). The rest were left as they are; retry the failures once the cause is fixed.`
      : null;
  }

  /**
   * Asked at most every few seconds; workers that ask while a check is in
   * flight wait for that same answer, so none slips past a stop.
   */
  private async checkStop(): Promise<boolean> {
    if (this.stopSeen) return true;
    if (this.pendingStop) return await this.pendingStop;
    const now = this.now();
    if (this.lastStopCheck && now - this.lastStopCheck < STOP_CHECK_EVERY_MS) return false;
    this.lastStopCheck = now;
    this.pendingStop = this.job.stopRequested().then((stop) => {
      this.stopSeen = stop;
      this.pendingStop = null;
      return stop;
    });
    return await this.pendingStop;
  }

  private async report(verb: string, force = false): Promise<void> {
    const now = this.now();
    if (!force && now - this.lastProgress < PROGRESS_EVERY_MS) return;
    this.lastProgress = now;
    const counts = countItems(this.rows);
    const finished = counts.total - counts.pending;
    await this.job.progress(`${verb} ${finished} of ${counts.total}`, counts);
  }
}
