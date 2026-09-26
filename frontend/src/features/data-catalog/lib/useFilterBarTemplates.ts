/** Filter bar templates, as react-query hooks. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { filterBarTemplatesApi } from '@/shared/api';
import type { FilterBarTemplate, FilterBarTemplateInput } from '@/shared/api/modules/data-catalog';

export const FILTER_BARS_KEY = ['data-catalog', 'templates', 'filter-bars'] as const;

export function useFilterBarTemplates() {
  return useQuery<FilterBarTemplate[]>({
    queryKey: FILTER_BARS_KEY,
    queryFn: () => filterBarTemplatesApi.list(),
  });
}

export function useSaveFilterBar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { templateId?: string; input: FilterBarTemplateInput }) =>
      filterBarTemplatesApi.save(args.templateId, args.input),
    onSuccess: () => client.invalidateQueries({ queryKey: FILTER_BARS_KEY }),
  });
}

export function useDeleteFilterBar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => filterBarTemplatesApi.remove(templateId),
    onSuccess: () => client.invalidateQueries({ queryKey: FILTER_BARS_KEY }),
  });
}
