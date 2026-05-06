/**
 * Bounded-concurrency helper. Avoids pulling in `p-limit` (ESM-only) and
 * keeps behavior predictable: at most `concurrency` tasks run at any time;
 * tasks queue FIFO when the bucket is full.
 */
export type LimitedTask<T> = () => Promise<T>;

export interface PLimit {
  <T>(task: LimitedTask<T>): Promise<T>;
  readonly activeCount: number;
  readonly pendingCount: number;
}

export function pLimit(concurrency: number): PLimit {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`pLimit: concurrency must be a positive integer, got ${concurrency}`);
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const next = (): void => {
    active--;
    const resume = queue.shift();
    if (resume) {
      resume();
    }
  };

  const run = async <T>(
    task: LimitedTask<T>,
    resolve: (v: T | PromiseLike<T>) => void,
    reject: (e: unknown) => void
  ): Promise<void> => {
    active++;
    try {
      resolve(await task());
    } catch (err) {
      reject(err);
    } finally {
      next();
    }
  };

  const limit = <T>(task: LimitedTask<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const start = (): void => {
        void run(task, resolve, reject);
      };
      if (active < concurrency) {
        start();
      } else {
        queue.push(start);
      }
    });

  Object.defineProperty(limit, 'activeCount', { get: () => active });
  Object.defineProperty(limit, 'pendingCount', { get: () => queue.length });

  return limit as PLimit;
}
