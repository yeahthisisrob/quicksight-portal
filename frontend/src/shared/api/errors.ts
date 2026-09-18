import axios from 'axios';

/**
 * Best human-readable message for a failed API call.
 *
 * The backend answers 4xx/5xx with `{ success: false, error }`; axios wraps
 * that in an AxiosError whose own `.message` is just "Request failed with
 * status code 400". Prefer the body's error so validation messages
 * (e.g. "Each user name must be a non-empty string") reach the user.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { error?: unknown; message?: unknown } | undefined;
    if (typeof body?.error === 'string' && body.error) return body.error;
    if (typeof body?.message === 'string' && body.message) return body.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
