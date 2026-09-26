import { renderHook, act, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { jobsApi } from '@/shared/api/modules/jobs';
import { usersApi } from '@/shared/api/modules/users';
import { ApiError } from '@/shared/api/typed';

import { useGroupMembershipJob } from '../useGroupMembershipJob';

const enqueueSnackbar = vi.fn();

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock('@/shared/api/modules/users', () => ({
  usersApi: {
    addUsersToGroup: vi.fn(),
    removeUsersFromGroup: vi.fn(),
  },
}));

vi.mock('@/shared/api/modules/jobs', () => ({
  jobsApi: {
    getJob: vi.fn(),
  },
}));

const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

const job = (overrides: Record<string, unknown>) => ({
  jobId: 'job-1',
  jobType: 'bulk-operation',
  status: 'completed',
  startTime: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('useGroupMembershipJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(usersApi.addUsersToGroup).mockResolvedValue({ success: true, jobId: 'job-1' } as any);
    vi.mocked(usersApi.removeUsersFromGroup).mockResolvedValue({ success: true, jobId: 'job-1' } as any);
  });

  afterEach(async () => {
    cleanup();
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it('sends resolved user names from grid rows, never null', async () => {
    vi.mocked(jobsApi.getJob).mockResolvedValue(
      job({ stats: { totalAssets: 2, processedAssets: 2, failedAssets: 0 } }) as any
    );
    const onSettled = vi.fn();
    const { result } = renderHook(() => useGroupMembershipJob({ onSettled }));

    await act(async () => {
      // Users-grid rows: name/id, no userName field
      await result.current.run('add', 'analysts', [
        { id: 'u1', name: 'alice', type: 'user' } as any,
        { id: 'u2', name: 'bob' },
      ]);
    });
    await flush();

    expect(usersApi.addUsersToGroup).toHaveBeenCalledWith('analysts', ['alice', 'bob']);
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, succeeded: 2, failed: 0, requested: ['alice', 'bob'] })
    );
    expect(result.current.isRunning).toBe(false);
    expect(enqueueSnackbar).toHaveBeenCalledWith('2 users added to analysts', { variant: 'success' });
  });

  it('refuses to call the API when no user name can be resolved', async () => {
    const { result } = renderHook(() => useGroupMembershipJob());

    await act(async () => {
      await result.current.run('add', 'analysts', [{}, { userName: '' }]);
    });

    expect(usersApi.addUsersToGroup).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      'None of the selected users have a QuickSight user name',
      { variant: 'error' }
    );
    expect(result.current.isRunning).toBe(false);
  });

  it('surfaces partial failures with the per-item reasons the job recorded', async () => {
    const failures = [{ item: 'bob → analysts', error: 'User not found' }];
    vi.mocked(jobsApi.getJob).mockResolvedValue(
      job({
        stats: { totalAssets: 2, processedAssets: 2, failedAssets: 1 },
        error: 'User not found',
        failures,
      }) as any
    );
    const onSettled = vi.fn();
    const { result } = renderHook(() => useGroupMembershipJob({ onSettled }));

    await act(async () => {
      await result.current.run('add', 'analysts', [{ userName: 'alice' }, { userName: 'bob' }]);
    });
    await flush();

    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, succeeded: 1, failed: 1, failures, error: 'User not found' })
    );
    expect(result.current.outcome?.failures).toEqual(failures);
    expect(enqueueSnackbar).toHaveBeenCalledWith('1 user added to analysts', { variant: 'warning' });
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      '1 user could not be added to analysts: User not found',
      { variant: 'error' }
    );
  });

  it("shows the API's validation message", async () => {
    vi.mocked(usersApi.removeUsersFromGroup).mockRejectedValue(
      new ApiError('Each user name must be a non-empty string', 400)
    );
    const onSettled = vi.fn();
    const { result } = renderHook(() => useGroupMembershipJob({ onSettled }));

    await act(async () => {
      await result.current.run('remove', 'analysts', [{ userName: 'alice' }]);
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith('Each user name must be a non-empty string', {
      variant: 'error',
    });
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: 'Each user name must be a non-empty string' })
    );
    expect(result.current.isRunning).toBe(false);
  });

  it('reports a failed job with its recorded error', async () => {
    vi.mocked(jobsApi.getJob).mockResolvedValue(
      job({ status: 'failed', error: 'Bulk operation failed: Group analysts not found' }) as any
    );
    const onSettled = vi.fn();
    const { result } = renderHook(() => useGroupMembershipJob({ onSettled }));

    await act(async () => {
      await result.current.run('remove', 'analysts', [{ userName: 'alice' }]);
    });
    await flush();

    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        failed: 1,
        error: 'Bulk operation failed: Group analysts not found',
      })
    );
  });
});
