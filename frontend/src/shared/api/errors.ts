/**
 * Best human-readable message for a failed API call.
 *
 * The typed client throws an ApiError carrying the server's own `error`
 * (e.g. "Each user name must be a non-empty string"), so the message is
 * already the one to show; anything else falls back.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
