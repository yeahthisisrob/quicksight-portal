/**
 * Test utilities for validating async/await patterns
 */

import { vi } from 'vitest';

// Test constants for async operations
const TEST_CONSTANTS = {
  POLLING_INTERVAL_MS: 10,
  ASYNC_MOCK_DELAY_MS: 10,
  AWAIT_CHECK_DELAY_MS: 20,
} as const;

/**
 * Helper to verify that an async function properly completes
 * and doesn't leave dangling promises
 */
export async function expectAsyncToComplete<T>(
  asyncFn: () => Promise<T>,
  timeout: number = 100
): Promise<T> {
  let completed = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    global.setTimeout(() => {
      if (!completed) {
        reject(new Error(`Async operation did not complete within ${timeout}ms`));
      }
    }, timeout);
  });

  const operationPromise = asyncFn().then((res) => {
    completed = true;
    return res;
  });

  const result = await Promise.race([operationPromise, timeoutPromise]);
  return result;
}

/**
 * Helper to track if async operations are properly awaited
 */
export class AsyncTracker {
  private readonly completedOperations = new Set<Promise<any>>();
  private readonly pendingOperations = new Set<Promise<any>>();

  public getCompletedCount(): number {
    return this.completedOperations.size;
  }

  public getPendingCount(): number {
    return this.pendingOperations.size;
  }

  public hasPendingOperations(): boolean {
    return this.pendingOperations.size > 0;
  }

  public reset(): void {
    this.pendingOperations.clear();
    this.completedOperations.clear();
  }

  public track<T>(promise: Promise<T>): Promise<T> {
    this.pendingOperations.add(promise);

    promise.finally(() => {
      this.pendingOperations.delete(promise);
      this.completedOperations.add(promise);
    });

    return promise;
  }

  public async waitForAll(timeout: number = 1000): Promise<void> {
    const startTime = Date.now();

    while (this.hasPendingOperations()) {
      if (Date.now() - startTime > timeout) {
        throw new Error(
          `${this.pendingOperations.size} operations still pending after ${timeout}ms`
        );
      }
      await new Promise((resolve) =>
        global.setTimeout(resolve, TEST_CONSTANTS.POLLING_INTERVAL_MS)
      );
    }
  }
}

/**
 * Mock that tracks if its async methods are properly awaited
 */
export function createAsyncMock(methodName: string = 'asyncMethod'): {
  mock: any;
  tracker: AsyncTracker;
} {
  const tracker = new AsyncTracker();
  const mock = vi.fn();

  mock.mockImplementation((...args: any[]) => {
    const promise = new Promise((resolve) => {
      global.setTimeout(
        () => resolve({ method: methodName, args }),
        TEST_CONSTANTS.ASYNC_MOCK_DELAY_MS
      );
    });

    return tracker.track(promise);
  });

  return { mock, tracker };
}

/**
 * Verify that a promise is actually awaited in the code
 */
export async function expectToBeAwaited(fn: () => any, checkFn: () => boolean): Promise<void> {
  const result = fn();

  // If the function returns a promise, it might not be awaited
  if (result && typeof result.then === 'function') {
    throw new Error('Function returned a promise - might be missing await');
  }

  // Give a small delay for async operations to complete
  await new Promise((resolve) => global.setTimeout(resolve, TEST_CONSTANTS.AWAIT_CHECK_DELAY_MS));

  if (!checkFn()) {
    throw new Error('Async operation was not properly awaited');
  }
}

/**
 * Test helper to ensure all promises in a function complete
 */
export async function runWithPromiseTracking<T>(
  fn: () => Promise<T>
): Promise<{ result: T; pendingCount: number; completedCount: number }> {
  const tracker = new AsyncTracker();
  const originalPromise = global.Promise;

  // Temporarily override Promise to track all promises
  const trackedPromises: Promise<any>[] = [];
  global.Promise = new Proxy(originalPromise, {
    construct(target: any, args: any[]) {
      const promise = new target(...args);
      trackedPromises.push(promise);
      tracker.track(promise);
      return promise;
    },
  }) as any;

  try {
    const result = await fn();
    await tracker.waitForAll();

    return {
      result,
      pendingCount: tracker.getPendingCount(),
      completedCount: tracker.getCompletedCount(),
    };
  } finally {
    global.Promise = originalPromise;
  }
}
