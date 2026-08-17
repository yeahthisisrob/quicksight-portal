/**
 * ActivityRefreshProcessor — drives an activity-refresh job through five
 * phases (initialize → fetch-views → fetch-mutations → merge-and-persist →
 * refresh-ingestions), polls JobStateService for stop requests, and persists
 * partial results when aborted. Ingestion (refresh) activity rides along with
 * every activity refresh so dataset activity stays current. Activity-specific
 * knowledge is contained here; the phase keys never leak to shared services.
 */

import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';

import { CloudTrailAdapter } from '../../../adapters/aws/CloudTrailAdapter';
import { ACTIVITY_LIMITS } from '../../../shared/constants';
import { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { IngestionRefreshService } from '../../../shared/services/ingestions/IngestionRefreshService';
import { type JobStateService } from '../../../shared/services/jobs/JobStateService';
import { logger } from '../../../shared/utils/logger';
import { warmCollectionSnapshots } from '../../asset-management/services/collectionSnapshotWarmer';
import { GroupService } from '../../organization/services/GroupService';
import { ActivityService, type EventNameProgress } from '../services/ActivityService';
import { type ActivityRefreshRequest } from '../types';

export interface ActivityRefreshOptions {
  assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
  days?: number;
}

const PHASE_KEYS = [
  'initialize',
  'fetch-views',
  'fetch-mutations',
  'merge-and-persist',
  'refresh-ingestions',
] as const;
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
  'fetch-mutations': 75,
  'merge-and-persist': 88,
  'refresh-ingestions': 95,
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
  private readonly ingestionRefreshService: IngestionRefreshService;
  private jobId: string = '';
  private jobStateService: JobStateService | null = null;

  constructor(region: string = 'us-east-1') {
    const cacheService = CacheService.getInstance();
    const cloudTrailClient = new CloudTrailClient({ region });
    const cloudTrailAdapter = new CloudTrailAdapter(cloudTrailClient, region);
    const groupService = new GroupService();
    const accountId = process.env.AWS_ACCOUNT_ID || '';

    this.activityService = new ActivityService(cacheService, cloudTrailAdapter, groupService);
    this.ingestionRefreshService = new IngestionRefreshService(
      new QuickSightService(accountId),
      cacheService
    );
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
      'refresh-ingestions': emptyCounters(),
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
   * Refresh the dataset ingestions cache as the final phase. Ingestion
   * (refresh) activity is part of the activity picture, so it rides along
   * with every activity refresh — but a failure here never fails the job:
   * CloudTrail activity was already merged and persisted.
   */
  private async refreshIngestions(aborted: boolean): Promise<void> {
    if (aborted) {
      await this.completePhase('refresh-ingestions', 'skipped');
      return;
    }
    await this.startPhase('refresh-ingestions', 'Fetching dataset ingestion history');
    try {
      const result = await this.ingestionRefreshService.refreshIngestionsCache();
      if (this.jobStateService) {
        await this.jobStateService.updatePhaseCounts(this.jobId, 'refresh-ingestions', {
          processed: result.metadata.totalIngestions,
          total: result.metadata.totalIngestions,
          errors: result.errors.length,
        });
      }
      await this.completePhase('refresh-ingestions');
    } catch (error) {
      logger.warn('Ingestion refresh failed (activity data was still persisted)', {
        jobId: this.jobId,
        error: error instanceof Error ? error.message : error,
      });
      await this.completePhase('refresh-ingestions', 'failed');
    }
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

    await this.refreshIngestions(abortController.signal.aborted);

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
      // Activity ETags are part of the user snapshot version key, so a
      // successful refresh invalidates it — precompute the replacement now.
      // warmCollectionSnapshots never throws.
      await warmCollectionSnapshots();
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
