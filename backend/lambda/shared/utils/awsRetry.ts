import { STATUS_CODES, RETRY_CONFIG } from '../constants';
import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: RETRY_CONFIG.MAX_RETRIES,
  baseDelay: RETRY_CONFIG.BASE_DELAY_MS,
  maxDelay: RETRY_CONFIG.MAX_DELAY_MS,
  backoffMultiplier: RETRY_CONFIG.BACKOFF_MULTIPLIER,
};

export function isThrottlingError(error: any): boolean {
  const errorCode = error.name || error.Code || '';
  const errorMessage = error.message || '';

  return (
    errorCode === 'ThrottlingException' ||
    errorCode === 'TooManyRequestsException' ||
    errorCode === 'RequestLimitExceeded' ||
    errorCode === 'RateLimitExceededException' ||
    errorMessage.includes('Rate exceeded') ||
    errorMessage.includes('too many requests') ||
    error.statusCode === STATUS_CODES.TOO_MANY_REQUESTS
  );
}

export function isRetryableError(error: any): boolean {
  // AWS SDK retryable errors
  const retryableCodes = [
    'ServiceUnavailable',
    'RequestTimeout',
    'RequestTimeoutException',
    'InternalServerError',
    'InternalError',
    'NetworkingError',
    'TimeoutError',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'ENOTFOUND',
  ];

  const errorCode = error.name || error.Code || error.code || '';
  const errorMessage = error.message || '';

  return (
    isThrottlingError(error) ||
    retryableCodes.includes(errorCode) ||
    errorMessage.includes('socket hang up') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('timeout') ||
    error.statusCode === STATUS_CODES.INTERNAL_SERVER_ERROR ||
    error.statusCode === STATUS_CODES.BAD_GATEWAY ||
    error.statusCode === STATUS_CODES.SERVICE_UNAVAILABLE ||
    error.statusCode === STATUS_CODES.GATEWAY_TIMEOUT
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );
      const jitter = Math.random() * RETRY_CONFIG.JITTER_FACTOR * baseDelay;
      const delay = Math.floor(baseDelay + jitter);

      const errorName = (error as any).name || 'error';
      const errorMessage = (error as any).message || 'Unknown error';

      logger.warn(
        `${operationName} failed with ${errorName}, retrying in ${delay}ms (attempt ${attempt + 1}/${opts.maxRetries})`,
        {
          error: errorMessage,
          attempt: attempt + 1,
          delay,
        }
      );

      await new Promise<void>((resolve) => {
        // eslint-disable-next-line no-undef
        setTimeout(resolve, delay);
      });
    }
  }

  throw lastError;
}
