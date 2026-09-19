import { useQuery } from '@tanstack/react-query';

import { type SearchableType, searchApi } from '@/shared/api/modules/search';

import { useDebounce } from '../useDebounce';

export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_MIN_LENGTH = 2;
const SEARCH_STALE_MS = 60_000;

interface Options {
  types?: SearchableType[];
  limit?: number;
  /** Turn the query off entirely (a closed palette does no work). */
  enabled?: boolean;
}

/**
 * Debounced search against /search. Nothing is asked until the text has at
 * least two characters; the last result stays on screen while a new one
 * loads so lists do not flicker as someone types.
 */
export function useSearchHits(text: string, options: Options = {}) {
  const debounced = useDebounce(text.trim(), SEARCH_DEBOUNCE_MS);
  const active = (options.enabled ?? true) && debounced.length >= SEARCH_MIN_LENGTH;
  const types = options.types ?? [];
  const query = useQuery({
    queryKey: ['search', debounced, types.join(','), options.limit ?? null],
    queryFn: () => searchApi.search(debounced, { types, limit: options.limit }),
    enabled: active,
    placeholderData: (previous) => previous,
    staleTime: SEARCH_STALE_MS,
    retry: false,
  });
  return {
    /** The text the current result answers. */
    query: debounced,
    active,
    hits: active ? (query.data?.hits ?? []) : [],
    indexed: query.data?.indexed,
    indexedAt: query.data?.indexedAt,
    loading: active && query.isFetching,
    error: query.error,
  };
}
