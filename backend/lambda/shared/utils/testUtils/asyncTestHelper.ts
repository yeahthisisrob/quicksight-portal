/**
 * Test utilities for validating async/await patterns
 */

// Test constants for async operations
const TEST_CONSTANTS = {
  POLLING_INTERVAL_MS: 10,
  ASYNC_MOCK_DELAY_MS: 10,
  AWAIT_CHECK_DELAY_MS: 20,
} as const;

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
