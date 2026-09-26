/**
 * The calculated-field template library, as react-query hooks. Saving or
 * deleting a template also refreshes the open asset, whose fields report
 * whether they match a template.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { calculatedFieldTemplatesApi } from '@/shared/api';
import type {
  CalculatedFieldTemplate,
  CalculatedFieldTemplateInput,
} from '@/shared/api/modules/data-catalog';

const TEMPLATES_KEY = ['data-catalog', 'templates', 'calculated-fields'] as const;

export function useTemplates() {
  return useQuery<CalculatedFieldTemplate[]>({
    queryKey: TEMPLATES_KEY,
    queryFn: () => calculatedFieldTemplatesApi.list(),
  });
}

function useInvalidateTemplates() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: TEMPLATES_KEY });
    void client.invalidateQueries({ queryKey: ['data-catalog', 'smus', 'asset'] });
  };
}

export function useSaveTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (args: { templateId?: string; input: CalculatedFieldTemplateInput }) =>
      args.templateId
        ? calculatedFieldTemplatesApi.update(args.templateId, args.input)
        : calculatedFieldTemplatesApi.create(args.input),
    onSuccess: invalidate,
  });
}

export function useDeleteTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (templateId: string) => calculatedFieldTemplatesApi.remove(templateId),
    onSuccess: invalidate,
  });
}
