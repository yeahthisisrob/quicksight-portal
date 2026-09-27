/**
 * What went wrong while answering one API request, kept so the error
 * response can say it: handlers log the error they caught (almost all of
 * them do, just before answering), and the logger records it here. The
 * response then carries a short message for people and a detail for
 * whoever debugs it: the underlying error, AWS's request id, and this
 * request's id to find the logs by.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface ErrorDetail {
  /** The underlying error's name (ValidationException, AccessDeniedException...). */
  name?: string;
  /** The underlying error's own message, which the response message may have replaced. */
  cause?: string;
  /** AWS's id for the failing call, for a support case. */
  awsRequestId?: string;
  /** The HTTP status AWS answered with. */
  awsStatus?: number;
  /** This request's id: the key to its logs. */
  requestId?: string;
}

interface RequestState {
  requestId?: string;
  lastError?: Omit<ErrorDetail, 'requestId'>;
}

const storage = new AsyncLocalStorage<RequestState>();

export function runWithRequestContext<T>(requestId: string | undefined, run: () => Promise<T>) {
  return storage.run(requestId ? { requestId } : {}, run);
}

function describe(value: unknown): Omit<ErrorDetail, 'requestId'> | undefined {
  if (value instanceof Error) {
    const meta = (value as { $metadata?: { requestId?: string; httpStatusCode?: number } })
      .$metadata;
    return {
      name: value.name,
      cause: value.message,
      ...(meta?.requestId ? { awsRequestId: meta.requestId } : {}),
      ...(meta?.httpStatusCode ? { awsStatus: meta.httpStatusCode } : {}),
    };
  }
  if (typeof value === 'string' && value) return { cause: value };
  return undefined;
}

/** Record an error logged while answering this request (logger.error calls this). */
export function recordError(data: unknown): void {
  const state = storage.getStore();
  if (!state || data === undefined || data === null) return;
  const found =
    describe(data) ??
    (typeof data === 'object'
      ? (describe((data as Record<string, unknown>).error) ??
        describe((data as Record<string, unknown>).err))
      : undefined);
  if (found) state.lastError = found;
}

/** What the error response should carry beyond its message, if anything. */
export function currentErrorDetail(): ErrorDetail | undefined {
  const state = storage.getStore();
  if (!state) return undefined;
  const detail = {
    ...(state.lastError ?? {}),
    ...(state.requestId ? { requestId: state.requestId } : {}),
  };
  return Object.keys(detail).length ? detail : undefined;
}
