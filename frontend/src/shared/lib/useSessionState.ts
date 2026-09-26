/**
 * useState that lasts the browser tab's session: a panel left and come
 * back to (the Studio's asset list, say) opens where it was. Storage can be
 * missing or refuse (private windows); then it is plain state.
 */
import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

const PREFIX = 'qsp.session.';

function read<T>(key: string | null, initial: T): T {
  if (key === null) return initial;
  try {
    const raw = window.sessionStorage.getItem(`${PREFIX}${key}`);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}

/** A null key is plain state (a story that pins where it starts). */
export function useSessionState<T>(
  key: string | null,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          if (key !== null)
            window.sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(resolved));
        } catch {
          // No storage: it lasts as long as the component.
        }
        return resolved;
      }),
    [key]
  );
  return [value, set];
}
