import { STATUS_CODES } from '../constants';

/**
 * Thrown when a request payload fails validation before any work is queued.
 * Handlers map it to a 400 carrying the message verbatim, so callers see
 * what was wrong with their input instead of a generic "operation failed".
 */
export class ValidationError extends Error {
  public readonly statusCode = STATUS_CODES.BAD_REQUEST;

  public constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const isValidationError = (error: unknown): error is ValidationError =>
  error instanceof ValidationError ||
  (error instanceof Error && (error as ValidationError).statusCode === STATUS_CODES.BAD_REQUEST);
