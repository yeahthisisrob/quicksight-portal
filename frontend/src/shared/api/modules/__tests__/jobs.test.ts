import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn() }));

vi.mock('../../typed', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../typed')>()),
  client: { GET: mocks.GET },
}));

import { jobsApi } from '../jobs';

const ok = (data: unknown) => ({
  data: { success: true, data },
  response: new Response(null, { status: 200 }),
});
const job = (status: string, extra: Record<string, unknown> = {}) =>
  ok({ jobId: 'planner-1', jobType: 'planner', status, ...extra });

describe('jobsApi.awaitResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('polls until the job completes, then returns its result', async () => {
    mocks.GET.mockResolvedValueOnce(job('queued'))
      .mockResolvedValueOnce(job('processing'))
      .mockResolvedValueOnce(job('completed'))
      .mockResolvedValueOnce(ok({ answer: 42 }));

    const result = await jobsApi.awaitResult<{ answer: number }>('planner-1', { intervalMs: 1 });

    expect(result).toEqual({ answer: 42 });
    expect(mocks.GET.mock.calls.map((c) => c[0])).toEqual([
      '/api/jobs/{jobId}',
      '/api/jobs/{jobId}',
      '/api/jobs/{jobId}',
      '/api/jobs/{jobId}/result',
    ]);
    expect(mocks.GET.mock.calls[0][1]).toEqual({ params: { path: { jobId: 'planner-1' } } });
  });

  it("fails with the job's own message when it fails", async () => {
    mocks.GET.mockResolvedValueOnce(
      job('failed', { message: 'The planner could not choose a dataset', error: undefined })
    );
    await expect(jobsApi.awaitResult('planner-1', { intervalMs: 1 })).rejects.toThrow(
      'The planner could not choose a dataset'
    );
  });

  it('fails when a completed job has no result, and gives up after the timeout', async () => {
    mocks.GET.mockResolvedValueOnce(job('completed')).mockResolvedValueOnce({
      error: { success: false, error: 'nope' },
      response: new Response(null, { status: 404 }),
    });
    await expect(jobsApi.awaitResult('planner-1', { intervalMs: 1 })).rejects.toThrow(
      'finished without a result'
    );

    mocks.GET.mockResolvedValue(job('processing'));
    await expect(jobsApi.awaitResult('planner-1', { intervalMs: 1, timeoutMs: 0 })).rejects.toThrow(
      'Gave up waiting'
    );
  });
});

describe('jobsApi.awaitJob', () => {
  it('returns the job as it ended, failed or not', async () => {
    mocks.GET.mockReset();
    mocks.GET.mockResolvedValueOnce(job('processing')).mockResolvedValueOnce(
      job('failed', { failures: [{ item: 'dash-1', error: 'Access denied' }] })
    );
    const ended = await jobsApi.awaitJob('planner-1', { intervalMs: 1 });
    expect(ended.status).toBe('failed');
    expect(ended.failures).toEqual([{ item: 'dash-1', error: 'Access denied' }]);
  });
});
