/**
 * The most recent failed API request, with what the server said went wrong
 * underneath. An error message on screen can then offer its details
 * without every caller passing the error along: the snackbar that follows
 * a failure within a few seconds belongs to it.
 */
import type { components } from '@shared/generated/types';

export type ErrorDetail = components['schemas']['ErrorDetail'];

export interface ApiFailure {
  at: number;
  method: string;
  path: string;
  status: number;
  error: string;
  detail?: ErrorDetail;
}

const RECENT_MS = 10_000;
let last: ApiFailure | null = null;

export function recordFailure(failure: ApiFailure): void {
  // The parsed body arrives after the bare status: keep what is known of the same request.
  if (
    last &&
    last.method === failure.method &&
    last.path === failure.path &&
    Date.now() - last.at < RECENT_MS
  ) {
    last = { ...last, ...failure, detail: failure.detail ?? last.detail };
    return;
  }
  last = failure;
}

/** What a caller learned from the body, added to the failure of the same request. */
export function noteDetail(path: string, error: string, detail?: ErrorDetail): void {
  if (last && last.path === path) {
    last = { ...last, error, ...(detail ? { detail } : {}) };
  }
}

export function recentFailure(withinMs = RECENT_MS): ApiFailure | null {
  return last && Date.now() - last.at <= withinMs ? last : null;
}

/** The failure whose details are open, for the one dialog that shows them. */
let opened: ApiFailure | null = null;
const listeners = new Set<() => void>();

export const failureDetails = {
  open(failure: ApiFailure) {
    opened = failure;
    for (const listener of listeners) listener();
  },
  close() {
    opened = null;
    for (const listener of listeners) listener();
  },
  current: () => opened,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
