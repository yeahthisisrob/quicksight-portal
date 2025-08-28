/**
 * Request manager to prevent duplicate API calls
 */
class RequestManager {
  private pendingRequests: Map<string, Promise<any>> = new Map();

  /**
   * Execute a request with deduplication
   */
  async execute<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if there's already a pending request with this key
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending;
    }

    // Create new request
    const request = requestFn()
      .finally(() => {
        // Remove from pending after completion
        this.pendingRequests.delete(key);
      });

    // Store in pending
    this.pendingRequests.set(key, request);
    
    return request;
  }

  /**
   * Cancel all pending requests
   */
  cancelAll() {
    this.pendingRequests.clear();
  }
}

export const requestManager = new RequestManager();