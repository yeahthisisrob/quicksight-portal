import { afterEach, describe, expect, it, vi } from 'vitest';

import { failureDetails, noteDetail, recentFailure, recordFailure } from '../failures';

afterEach(() => {
  vi.useRealTimers();
  failureDetails.close();
});

describe('the most recent API failure', () => {
  it('keeps the bare status, then what the body said, for the same request', () => {
    recordFailure({
      at: Date.now(),
      method: 'GET',
      path: '/api/x',
      status: 500,
      error: 'Internal Server Error',
    });
    noteDetail('/api/x', 'Could not read the rows', {
      name: 'ValidationException',
      requestId: 'r-1',
    });
    expect(recentFailure()).toMatchObject({
      method: 'GET',
      status: 500,
      error: 'Could not read the rows',
      detail: { name: 'ValidationException', requestId: 'r-1' },
    });
  });

  it('is only offered for a few seconds, so a later message does not borrow it', () => {
    vi.useFakeTimers();
    recordFailure({
      at: Date.now(),
      method: 'GET',
      path: '/api/y',
      status: 404,
      error: 'Not found',
    });
    vi.advanceTimersByTime(11_000);
    expect(recentFailure()).toBeNull();
  });

  it('opens one failure at a time for the details dialog', () => {
    const seen: unknown[] = [];
    const stop = failureDetails.subscribe(() => seen.push(failureDetails.current()));
    const failure = { at: 1, method: 'POST', path: '/api/z', status: 409, error: 'Conflict' };
    failureDetails.open(failure);
    failureDetails.close();
    stop();
    expect(seen).toEqual([failure, null]);
  });
});
