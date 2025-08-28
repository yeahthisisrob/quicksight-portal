import { useEffect, useRef } from 'react';

/**
 * Custom hook to ensure initial fetch only happens once
 * Prevents duplicate calls from StrictMode and rapid re-renders
 */
export function useInitialFetch(
  fetchFn: () => void | Promise<void>,
  dependencies: React.DependencyList = []
) {
  const hasFetched = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the fetch to prevent rapid calls
    timeoutRef.current = setTimeout(() => {
      if (!hasFetched.current) {
        hasFetched.current = true;
        fetchFn();
      }
    }, 100); // Small delay to batch multiple renders

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  // Reset the flag when dependencies change significantly
  useEffect(() => {
    hasFetched.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}