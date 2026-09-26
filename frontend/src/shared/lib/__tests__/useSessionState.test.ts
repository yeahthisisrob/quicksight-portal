import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionState } from '../useSessionState';

describe('useSessionState', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('starts from what the session kept, and keeps what changes', () => {
    const first = renderHook(() => useSessionState('browse.scope', 'live'));
    expect(first.result.current[0]).toBe('live');
    act(() => first.result.current[1]('archived'));
    first.unmount();

    const again = renderHook(() => useSessionState('browse.scope', 'live'));
    expect(again.result.current[0]).toBe('archived');
  });

  it('takes an updater like useState', () => {
    const { result } = renderHook(() => useSessionState('n', 1));
    act(() => result.current[1]((n) => n + 1));
    expect(result.current[0]).toBe(2);
  });
});
