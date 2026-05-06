/**
 * ActivityRefreshProcessor — drives an activity-refresh job through four
 * phases (initialize → fetch-views → fetch-mutations → merge-and-persist),
 * polls JobStateService for stop requests, and persists partial results
 * when aborted. Activity-specific knowledge is contained here; the four
 * phase keys never leak to shared services.
 */

import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';

import { CloudTrailAdapter } from '../../../adapters/aws/CloudTrailAdapter';
import { ACTIVITY_LIMITS } from '../../../shared/constants';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { type JobStateService } from '../../../shared/services/jobs/JobStateService';
import { logger } from '../../../shared/utils/logger';
import { GroupService } from '../../organization/services/GroupService';
import { ActivityService, type EventNameProgress } from '../services/ActivityService';
import { type ActivityRefreshRequest } from '../types';

export interface ActivityRefreshOptions {
  assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
  days?: number;
}

const PHASE_KEYS = ['initialize', 'fetch-views', 'fetch-mutations', 'merge-and-persist'] as const;
type PhaseKey = (typeof PHASE_KEYS)[number];
type PhaseCounters = {
  processed: number;
  total: number;
  newEvents: number;
  truncated: number;
  errors: number;
};

const PROGRESS_PER_PHASE: Record<PhaseKey, number> = {
  initialize: 5,
  'fetch-views': 25,
  'fetch-mutations': 80,
  'merge-and-persist': 95,
};

/** Flush phase counters to S3 every Nth event-name to bound writes while staying lively. */
const PHASE_COUNT_FLUSH_INTERVAL = 10;

const emptyCounters = (): PhaseCounters => ({
  processed: 0,
  total: 0,
  newEvents: 0,
  truncated: 0,
  errors: 0,
});

export class ActivityRefreshProcessor {
  private readonly activityService: ActivityService;
  private jobId: string = '';
  private jobStateService: JobStateService | null = null;

  constructor(region: string = 'us-east-1') {
    const cacheService = CacheService.getInstance();
    const cloudTrailClient = new CloudTrailClient({ region });
    const cloudTrailAdapter = new CloudTrailAdapter(cloudTrailClient, region);
    const groupService = new GroupService();

    this.activityService = new ActivityService(cacheService, cloudTrailAdapter, groupService);
  }

  public async processActivityRefresh(options: ActivityRefreshOptions): Promise<void> {
    const startTime = Date.now();
    const abortController = new AbortController();
    const stopPoll = this.startStopPolling(abortController);
    const phaseCounters: Record<PhaseKey, PhaseCounters> = {
      initialize: emptyCounters(),
      'fetch-views': emptyCounters(),
      'fetch-mutations': emptyCounters(),
      'merge-and-persist': emptyCounters(),
    };
    const phaseRef = { current: null as PhaseKey | null };

    try {
      await this.runRefresh(options, abortController, phaseCounters, phaseRef, startTime);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Activity refresh failed', { jobId: this.jobId, error: message });
      if (phaseRef.current) {
        await this.flushPhaseCounts(phaseRef.current, phaseCounters[phaseRef.current]).catch(
          () => undefined
        );
        await this.completePhase(phaseRef.current, 'failed').catch(() => undefined);
      }
      await this.markFailed(`Activity refresh failed: ${message}`);
      throw error;
    } finally {
      stopPoll();
    }
  }

  public setJobStateService(jobStateService: JobStateService, jobId: string): void {
    this.jobStateService = jobStateService;
    this.jobId = jobId;
  }

  private async completePhase(
    key: PhaseKey,
    status: 'completed' | 'failed' | 'skipped' = 'completed'
  ): Promise<void> {
    if (!this.jobStateService) {
      return;
    }
    await this.jobStateService.completePhase(this.jobId, key, status);
  }

  private async flushPhaseCounts(key: PhaseKey, counts: PhaseCounters): Promise<void> {
    if (!this.jobStateService) {
      return;
    }
    await this.jobStateService.updatePhaseCounts(this.jobId, key, {
      processed: counts.processed,
      total: counts.total,
      newEvents: counts.newEvents,
      truncated: counts.truncated,
      errors: counts.errors,
    });
  }

  private handleEventNameProgress(
    progress: EventNameProgress,
    counters: Record<PhaseKey, PhaseCounters>,
    phaseRef: { current: PhaseKey | null }
  ): void {
    const phase = phaseRef.current;
    if (!phase) {
      return;
    }
    const c = counters[phase];
    c.processed += 1;
    c.newEvents += progress.events;
    if (progress.truncated) {
      c.truncated += 1;
    }
    if (!progress.success) {
      c.errors += 1;
    }
    const shouldFlush =
      c.processed % PHASE_COUNT_FLUSH_INTERVAL === 0 || progress.truncated || !progress.success;
    if (shouldFlush) {
      void this.flushPhaseCounts(phase, c);
      void this.updateProgressFor(phase);
    }
  }

  private async handlePhaseTransition(
    phase: 'fetch-views' | 'fetch-mutations' | 'merge-and-persist',
    meta: { total?: number } | undefined,
    counters: Record<PhaseKey, PhaseCounters>,
    phaseRef: { current: PhaseKey | null }
  ): Promise<void> {
    if (phaseRef.current && phaseRef.current !== phase) {
      await this.flushPhaseCounts(phaseRef.current, counters[phaseRef.current]);
      await this.completePhase(phaseRef.current);
    }
    phaseRef.current = phase === 'merge-and-persist' ? null : phase;
    await this.startPhase(phase);
    if (phase !== 'merge-and-persist' && meta?.total !== undefined) {
      counters[phase].total = meta.total;
      await this.flushPhaseCounts(phase, counters[phase]);
    }
  }

  private async initJob(): Promise<void> {
    if (!this.jobStateService) {
      return;
    }
    await this.jobStateService.initPhases(this.jobId, [...PHASE_KEYS]);
    await this.jobStateService.updateJobStatus(this.jobId, {
      status: 'processing',
      progress: 0,
      message: 'Activity refresh starting',
    });
  }

  private async markCompleted(message: string, stats: any): Promise<void> {
    if (!this.jobStateService) {
      return;
    }
    await this.jobStateService.updateJobStatus(this.jobId, {
      status: 'completed',
      progress: 100,
      message,
      endTime: new Date().toISOString(),
      stats,
    });
    await this.jobStateService.logInfo(this.jobId, message, stats);
  }

  private async markFailed(message: string): Promise<void> {
    if (!this.jobStateService) {
      return;
    }
    await this.jobStateService.updateJobStatus(this.jobId, {
      status: 'failed',
      message,
      endTime: new Date().toISOString(),
    });
    await this.jobStateService.logError(this.jobId, message);
  }

  private async markStopped(message: string, stats: any): Promise<void> {
    if (!this.jobStateService) {
      return;
    }
    await this.jobStateService.updateJobStatus(this.jobId, {
      status: 'stopped',
      message,
      endTime: new Date().toISOString(),
      stats,
    });
    await this.jobStateService.logWarn(this.jobId, message, stats);
  }

  /**
   * The actual refresh sequence — split out so processActivityRefresh stays
   * within max-statements limits and only owns top-level error handling.
   */
  private async runRefresh(
    options: ActivityRefreshOptions,
    abortController: AbortController,
    counters: Record<PhaseKey, PhaseCounters>,
    phaseRef: { current: PhaseKey | null },
    startTime: number
  ): Promise<void> {
    await this.initJob();
    await this.startPhase('initialize', 'Loading existing cache and computing fetch plan');
    logger.info('Processing activity refresh job', {
      jobId: this.jobId,
      assetTypes: options.assetTypes,
      days: options.days,
    });
    await this.completePhase('initialize');

    const request: ActivityRefreshRequest = {
      assetTypes: options.assetTypes,
      days: options.days,
    };
    const result = await this.activityService.refreshActivity(request, {
      signal: abortController.signal,
      onEventNameProgress: (progress) => this.handleEventNameProgress(progress, counters, phaseRef),
      onPhase: (phase, meta) => {
        void this.handlePhaseTransition(phase, meta, counters, phaseRef);
      },
    });

    if (phaseRef.current) {
      await this.flushPhaseCounts(phaseRef.current, counters[phaseRef.current]);
      await this.completePhase(phaseRef.current);
      phaseRef.current = null;
    }
    await this.completePhase('merge-and-persist');

    const aborted = abortController.signal.aborted;
    const duration = Date.now() - startTime;
    logger.info('Activity refresh completed', {
      jobId: this.jobId,
      duration,
      aborted,
      success: result.success,
      refreshed: result.refreshed,
    });

    if (aborted) {
      await this.markStopped(result.message, { refreshed: result.refreshed, duration });
    } else if (!result.success) {
      await this.markFailed(result.message);
    } else {
      await this.markCompleted(result.message, { refreshed: result.refreshed, duration });
    }
  }

  private async startPhase(key: PhaseKey, message?: string): Promise<void> {
    if (!this.jobStateService) {
      return;
    }
    await this.jobStateService.startPhase(this.jobId, key, message);
    await this.jobStateService.updateJobStatus(this.jobId, {
      progress: PROGRESS_PER_PHASE[key],
      message: message || `Activity refresh: ${key}`,
    });
  }

  /**
   * Periodically check S3 for a stop request and abort the in-flight fetch.
   * Returns a stop-polling function so the caller can clear the timer.
   */
  private startStopPolling(controller: AbortController): () => void {
    if (!this.jobStateService) {
      return () => undefined;
    }
    const service = this.jobStateService;
    const jobId = this.jobId;
    let stopped = false;
    const tick = async (): Promise<void> => {
      if (stopped || controller.signal.aborted) {
        return;
      }
      try {
        if (await service.isStopRequested(jobId)) {
          logger.info('Stop requested for activity refresh; aborting fetch', { jobId });
          controller.abort();
          return;
        }
      } catch (err) {
        logger.debug('Stop-poll error (ignored)', {
          err: err instanceof Error ? err.message : err,
        });
      }
      // eslint-disable-next-line no-undef
      setTimeout(tick, ACTIVITY_LIMITS.ABORT_POLL_INTERVAL_MS);
    };
    // eslint-disable-next-line no-undef
    setTimeout(tick, ACTIVITY_LIMITS.ABORT_POLL_INTERVAL_MS);
    return () => {
      stopped = true;
    };
  }

  private async updateProgressFor(phase: PhaseKey): Promise<void> {
    if (!this.jobStateService) {
      return;
    }
    await this.jobStateService.updateJobStatus(this.jobId, {
      progress: PROGRESS_PER_PHASE[phase],
      message: `Activity refresh: ${phase}`,
    });
  }
}
