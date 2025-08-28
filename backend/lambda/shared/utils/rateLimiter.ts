/**
 * Simple token bucket rate limiter for smoothing out API requests
 */
import { RATE_LIMITS, TIME_UNITS } from '../constants';
export class TokenBucketRateLimiter {
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private tokens: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefillTime = Date.now();
  }

  /**
   * Get current token count (for debugging)
   */
  public getTokenCount(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Wait until a token is available and consume it
   */
  public async waitForToken(): Promise<void> {
    while (true) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Calculate wait time until next token
      const tokensNeeded = 1 - this.tokens;
      const waitMs = Math.ceil((tokensNeeded / this.refillRate) * TIME_UNITS.SECOND);

      // Add small jitter to prevent synchronized waiting
      const jitter = Math.random() * RATE_LIMITS.JITTER_MS;
      await new Promise<void>((resolve) => {
        // eslint-disable-next-line no-undef
        setTimeout(resolve, waitMs + jitter);
      });
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / TIME_UNITS.SECOND;
    const tokensToAdd = elapsedSeconds * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
}

// Singleton rate limiter for all QuickSight API calls
export const quickSightRateLimiter = new TokenBucketRateLimiter(
  RATE_LIMITS.QUICKSIGHT_BURST,
  RATE_LIMITS.QUICKSIGHT_PER_SECOND
);

// Singleton rate limiter for QuickSight permissions operations
// These have stricter limits than general operations
export const quickSightPermissionsRateLimiter = new TokenBucketRateLimiter(
  RATE_LIMITS.QUICKSIGHT_PERMISSIONS_BURST,
  RATE_LIMITS.QUICKSIGHT_PERMISSIONS_PER_SECOND
);

// Singleton rate limiter for CloudTrail API calls
// CloudTrail LookupEvents allows 2 requests per second
export const cloudTrailRateLimiter = new TokenBucketRateLimiter(
  RATE_LIMITS.CLOUDTRAIL_BURST,
  RATE_LIMITS.CLOUDTRAIL_PER_SECOND
);

// Singleton rate limiter for S3 operations
export const s3RateLimiter = new TokenBucketRateLimiter(
  RATE_LIMITS.S3_BURST,
  RATE_LIMITS.S3_PER_SECOND
);
