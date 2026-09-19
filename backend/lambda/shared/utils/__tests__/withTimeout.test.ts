import { describe, expect, it, vi } from 'vitest';

import { TimeoutError, withTimeout } from '../withTimeout';

describe('withTimeout', () => {
  it('passes a value through when it arrives in time', async () => {
    await expect(withTimeout(Promise.resolve(1), 50, 'x')).resolves.toBe(1);
  });

  it('rejects with a named error once the limit passes', async () => {
    vi.useFakeTimers();
    const never = new Promise<number>(() => {});
    const pending = withTimeout(never, 100, 'ListProjects');
    const outcome = pending.catch((e) => e);
    vi.advanceTimersByTime(101);
    const error = await outcome;
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.message).toBe('ListProjects timed out after 100ms');
    vi.useRealTimers();
  });

  it('keeps the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50, 'x')).rejects.toThrow('boom');
  });
});
