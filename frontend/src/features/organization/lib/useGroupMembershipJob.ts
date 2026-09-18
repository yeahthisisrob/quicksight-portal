import { useSnackbar } from 'notistack';
import { useCallback, useRef, useState } from 'react';

import { resolveUserNames, type UserLike } from '@/entities/user';

import { getApiErrorMessage } from '@/shared/api/errors';
import { usersApi } from '@/shared/api/modules/users';
import { useJobPolling } from '@/shared/hooks/useJobPolling';

import type { BulkItemFailure, JobMetadata } from '@/shared/api/modules/jobs';

export type MembershipAction = 'add' | 'remove';

/** What happened once the membership job reached a terminal state */
export interface MembershipOutcome {
  action: MembershipAction;
  groupName: string;
  /** Names actually sent (blank / unresolvable selections are dropped first) */
  requested: string[];
  succeeded: number;
  failed: number;
  /** Item-level failures from the job record, when the backend recorded any */
  failures: BulkItemFailure[];
  /** Job-level reason: distinct per-item reasons, or why the whole job failed */
  error?: string;
  /** True only when every requested change went through */
  ok: boolean;
}

export interface UseGroupMembershipJobOptions {
  /**
   * Called on every terminal outcome. Typical use: refresh the parent when
   * anything succeeded, close the dialog only when `outcome.ok`.
   */
  onSettled?: (outcome: MembershipOutcome) => void;
}

const VERBS: Record<MembershipAction, { present: string; past: string; preposition: string }> = {
  add: { present: 'Adding', past: 'added to', preposition: 'to' },
  remove: { present: 'Removing', past: 'removed from', preposition: 'from' },
};

const pluralUsers = (n: number): string => `${n} user${n === 1 ? '' : 's'}`;

/**
 * One place for "queue a group membership change, follow the job, tell the
 * user what actually happened". Every dialog that adds or removes group
 * members goes through here, so they all:
 *  - send resolved QuickSight user names (never `[null]`)
 *  - surface the API's validation message instead of "Request failed with 400"
 *  - report partial failures with the per-item reasons the job recorded
 */
export function useGroupMembershipJob(options: UseGroupMembershipJobOptions = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const [isRunning, setIsRunning] = useState(false);
  const [outcome, setOutcome] = useState<MembershipOutcome | null>(null);

  // What the in-flight job is about; read back when it settles
  const requestRef = useRef<{ action: MembershipAction; groupName: string; requested: string[] } | null>(null);
  const onSettledRef = useRef(options.onSettled);
  onSettledRef.current = options.onSettled;

  const settle = useCallback(
    (result: Omit<MembershipOutcome, 'action' | 'groupName' | 'requested'>) => {
      const request = requestRef.current;
      if (!request) return;
      const settled: MembershipOutcome = { ...request, ...result };
      requestRef.current = null;
      setIsRunning(false);
      setOutcome(settled);
      onSettledRef.current?.(settled);
    },
    []
  );

  const handleComplete = useCallback(
    (job: JobMetadata) => {
      const request = requestRef.current;
      if (!request) return;
      const { past } = VERBS[request.action];
      const total = request.requested.length;
      const failed = job.stats?.failedAssets ?? 0;
      const succeeded = Math.max(0, (job.stats?.processedAssets ?? total) - failed);
      const failures = job.failures ?? [];

      if (succeeded > 0) {
        enqueueSnackbar(`${pluralUsers(succeeded)} ${past} ${request.groupName}`, {
          variant: failed > 0 ? 'warning' : 'success',
        });
      }
      if (failed > 0) {
        enqueueSnackbar(
          `${pluralUsers(failed)} could not be ${past} ${request.groupName}: ${job.error || 'see details'}`,
          { variant: 'error' }
        );
      }

      settle({ succeeded, failed, failures, error: job.error, ok: failed === 0 });
    },
    [enqueueSnackbar, settle]
  );

  const handleFailed = useCallback(
    (job: JobMetadata) => {
      const request = requestRef.current;
      if (!request) return;
      const error = job.error || job.message || `Failed to ${request.action} users`;
      enqueueSnackbar(error, { variant: 'error' });
      settle({
        succeeded: 0,
        failed: request.requested.length,
        failures: job.failures ?? [],
        error,
        ok: false,
      });
    },
    [enqueueSnackbar, settle]
  );

  const { startPolling, jobStatus, reset: resetPolling } = useJobPolling({
    onComplete: handleComplete,
    onFailed: handleFailed,
  });

  /**
   * Queue the change. Resolves once the job is accepted (not finished);
   * completion arrives through `onSettled` / `outcome`.
   */
  const run = useCallback(
    async (action: MembershipAction, groupName: string, users: ReadonlyArray<UserLike>) => {
      const requested = resolveUserNames(users);
      if (requested.length === 0) {
        enqueueSnackbar('None of the selected users have a QuickSight user name', {
          variant: 'error',
        });
        return;
      }

      const { present, preposition } = VERBS[action];
      setIsRunning(true);
      setOutcome(null);
      requestRef.current = { action, groupName, requested };

      try {
        const response =
          action === 'add'
            ? await usersApi.addUsersToGroup(groupName, requested)
            : await usersApi.removeUsersFromGroup(groupName, requested);
        enqueueSnackbar(`${present} ${pluralUsers(requested.length)} ${preposition} ${groupName}…`, {
          variant: 'info',
        });
        startPolling(response.jobId);
      } catch (error) {
        const message = getApiErrorMessage(error, `Failed to ${action} users`);
        enqueueSnackbar(message, { variant: 'error' });
        settle({ succeeded: 0, failed: requested.length, failures: [], error: message, ok: false });
      }
    },
    [enqueueSnackbar, settle, startPolling]
  );

  const reset = useCallback(() => {
    requestRef.current = null;
    resetPolling();
    setIsRunning(false);
    setOutcome(null);
  }, [resetPolling]);

  return { run, reset, isRunning, jobStatus, outcome };
}
