/** A template library (filter bars, visuals), as react-query hooks. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { filterBarTemplatesApi, visualTemplatesApi } from '@/shared/api';
import type { TemplateLibraryApi } from '@/shared/api/modules/data-catalog';

function libraryHooks<T, Input>(key: readonly string[], api: TemplateLibraryApi<T, Input>) {
  return {
    useList: () => useQuery<T[]>({ queryKey: key, queryFn: () => api.list() }),
    useSave: () => {
      const client = useQueryClient();
      return useMutation({
        mutationFn: (args: { templateId?: string; input: Input }) =>
          api.save(args.templateId, args.input),
        onSuccess: () => client.invalidateQueries({ queryKey: key }),
      });
    },
    useRemove: () => {
      const client = useQueryClient();
      return useMutation({
        mutationFn: (templateId: string) => api.remove(templateId),
        onSuccess: () => client.invalidateQueries({ queryKey: key }),
      });
    },
  };
}

export const filterBarLibrary = libraryHooks(
  ['data-catalog', 'templates', 'filter-bars'],
  filterBarTemplatesApi
);
export const visualLibrary = libraryHooks(
  ['data-catalog', 'templates', 'visuals'],
  visualTemplatesApi
);
