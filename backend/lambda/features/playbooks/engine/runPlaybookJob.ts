/**
 * One invocation of a playbook job: build the engine for the playbook it
 * names, run it over the job's rows, and say on the job record how it went.
 * Returns 'paused' when the worker should hand the job on to a fresh
 * invocation.
 */
import { batchFreshness } from '../../../shared/services/cache/assetFreshness';
import { type JobItemCounts, JobItemStore } from '../../../shared/services/jobs/JobItemStore';
import type { JobStateService } from '../../../shared/services/jobs/JobStateService';
import { findPlaybook } from '../catalog';
import type { Infer, PlaybookJobRequest } from '../types';
import { PlaybookEngine } from './PlaybookEngine';
import { type Dispatch, portalCall } from './portalCall';

const PERCENT = 100;
const RUNNING_CEILING = 99;

interface Input {
  jobId: string;
  request: PlaybookJobRequest;
  dispatch: Dispatch;
  jobs: Pick<
    JobStateService,
    'updateJobStatus' | 'logInfo' | 'logWarn' | 'logError' | 'isStopRequested'
  >;
  deadline: number | null;
  items?: JobItemStore;
  /** The run's model, for steps that infer. */
  infer?: Infer;
}

/** The job record's counters are flat numbers. */
function operationsOf(counts: JobItemCounts): Record<string, number> {
  const { verdicts, ...byStatus } = counts;
  return { ...byStatus, ...verdicts };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export async function runPlaybookJob(input: Input): Promise<'done' | 'paused'> {
  const { jobId, request, jobs } = input;
  const playbook = await findPlaybook(request?.playbookId);
  if (!playbook) {
    throw new Error(`There is no playbook '${request?.playbookId}'`);
  }
  const preview = request.mode === 'preview';
  await jobs.updateJobStatus(jobId, {
    status: 'processing',
    message: `${preview ? 'Previewing' : 'Running'} ${playbook.title}`,
  });

  const engine = new PlaybookEngine(
    playbook,
    {
      call: portalCall(input.dispatch),
      params: request.params ?? {},
      ...(input.infer ? { infer: input.infer } : {}),
    },
    {
      jobId,
      items: input.items ?? new JobItemStore(),
      deadline: input.deadline,
      stopRequested: () => jobs.isStopRequested(jobId),
      log: async (level, text) => {
        if (level === 'error') await jobs.logError(jobId, text);
        else if (level === 'warn') await jobs.logWarn(jobId, text);
        else await jobs.logInfo(jobId, text);
      },
      progress: (text, tally) =>
        jobs.updateJobStatus(jobId, {
          status: 'processing',
          message: text,
          progress: tally.total
            ? Math.min(
                RUNNING_CEILING,
                Math.round(((tally.total - tally.pending) / tally.total) * PERCENT)
              )
            : 0,
          stats: {
            totalAssets: tally.total,
            processedAssets: tally.total - tally.pending,
            failedAssets: tally.failed,
            operations: operationsOf(tally),
          },
        }),
    }
  );

  // Every write the run makes asks for a cache refresh; one refresh for the lot.
  const outcome = await batchFreshness(() => engine.execute(request));
  const { counts } = outcome;
  const stats = {
    totalAssets: counts.total,
    processedAssets: counts.total - counts.pending,
    failedAssets: counts.failed,
    operations: operationsOf(counts),
  };
  const endTime = new Date().toISOString();

  if (outcome.state === 'paused') {
    await jobs.updateJobStatus(jobId, {
      status: 'processing',
      message: `Paused before the time limit with ${counts.pending} to go; carrying on`,
      stats,
    });
    return 'paused';
  }
  if (outcome.state === 'stopped') {
    await jobs.updateJobStatus(jobId, {
      status: 'stopped',
      endTime,
      message: `Stopped with ${counts.pending} left as they were`,
      stats,
    });
    return 'done';
  }
  if (outcome.state === 'halted') {
    await jobs.updateJobStatus(jobId, {
      status: 'failed',
      endTime,
      message: outcome.reason,
      error: outcome.reason,
      stats,
    });
    return 'done';
  }

  const summary =
    (preview
      ? [
          `${counts.verdicts.change} to change`,
          counts.verdicts.review ? `${counts.verdicts.review} for review` : '',
          counts.verdicts.skip ? `${counts.verdicts.skip} skipped` : '',
          counts.failed ? `${counts.failed} could not be checked` : '',
        ]
      : [
          counts.done ? `${counts.done} changed` : '',
          counts.review ? `${counts.review} for review` : '',
          counts.skipped ? `${counts.skipped} skipped` : '',
          counts.failed ? `${counts.failed} failed` : '',
        ]
    )
      .filter(Boolean)
      .join(', ') || 'Nothing to do';
  await jobs.updateJobStatus(jobId, {
    status: 'completed',
    endTime,
    progress: PERCENT,
    message: summary,
    ...(counts.failed ? { error: `${plural(counts.failed, 'asset')} failed` } : {}),
    stats,
  });
  return 'done';
}
