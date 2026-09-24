import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../client', () => ({ api: { get: mocks.get } }));

import { jobsApi } from '../jobs';

const job = (status: string, extra: Record<string, unknown> = {}) => ({
  data: { success: true, data: { jobId: 'planner-1', jobType: 'planner', status, ...extra } },
  status: 200,
});

describe('jobsApi.awaitResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('polls until the job completes, then returns its result', async () => {
    mocks.get
      .mockResolvedValueOnce(job('queued'))
      .mockResolvedValueOnce(job('processing'))
      .mockResolvedValueOnce(job('completed'))
      .mockResolvedValueOnce({ data: { success: true, data: { answer: 42 } }, status: 200 });

    const result = await jobsApi.awaitResult<{ answer: number }>('planner-1', { intervalMs: 1 });

    expect(result).toEqual({ answer: 42 });
    expect(mocks.get.mock.calls.map((c) => c[0])).toEqual([
      '/jobs/planner-1',
      '/jobs/planner-1',
      '/jobs/planner-1',
      '/jobs/planner-1/result',
    ]);
  });

  it("fails with the job's own message when it fails", async () => {
    mocks.get.mockResolvedValueOnce(
      job('failed', { message: 'The planner could not choose a dataset', error: undefined })
    );
    await expect(jobsApi.awaitResult('planner-1', { intervalMs: 1 })).rejects.toThrow(
      'The planner could not choose a dataset'
    );
  });

  it('fails when a completed job has no result, and gives up after the timeout', async () => {
    mocks.get
      .mockResolvedValueOnce(job('completed'))
      .mockResolvedValueOnce({ data: { success: false, error: 'nope' }, status: 404 });
    await expect(jobsApi.awaitResult('planner-1', { intervalMs: 1 })).rejects.toThrow(
      'finished without a result'
    );

    mocks.get.mockResolvedValue(job('processing'));
    await expect(jobsApi.awaitResult('planner-1', { intervalMs: 1, timeoutMs: 0 })).rejects.toThrow(
      'Gave up waiting'
    );
  });
});
