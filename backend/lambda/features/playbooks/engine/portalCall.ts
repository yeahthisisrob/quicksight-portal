/**
 * The portal's API as a function: a playbook asks for a path and gets the
 * response's `data`, or a PortalCallError carrying the route's own message.
 */
import { type PortalCall, PortalCallError } from '../types';

/** Runs one request through the API handler (the worker wires this up). */
export type Dispatch = (request: {
  method: string;
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: string }>;

const OK_MIN = 200;
const OK_MAX = 299;

function messageOf(body: any, status: number): string {
  const message =
    body?.error?.message ??
    (typeof body?.error === 'string' ? body.error : undefined) ??
    body?.message ??
    `The portal answered ${status}`;
  // What failed underneath, when the route's message hides it.
  const cause = body?.detail?.cause;
  const name = body?.detail?.name;
  return cause && cause !== message ? `${message}: ${name ? `${name}: ` : ''}${cause}` : message;
}

export function portalCall(dispatch: Dispatch): PortalCall {
  return async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await dispatch({ method, path, ...(body === undefined ? {} : { body }) });
    let parsed: any;
    try {
      parsed = response.body ? JSON.parse(response.body) : undefined;
    } catch {
      parsed = undefined;
    }
    if (response.status < OK_MIN || response.status > OK_MAX || parsed?.success === false) {
      // Name the call: a playbook's failure has to say which request failed, not only why.
      const call = `${method} ${path.split('?')[0]}`;
      throw new PortalCallError(response.status, `${messageOf(parsed, response.status)} (${call})`);
    }
    return (parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed) as T;
  };
}
