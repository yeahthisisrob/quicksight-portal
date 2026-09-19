/**
 * Queries for the field-first catalog. Keys start with 'data-catalog' so a
 * saved note or template refreshes what is on screen.
 */
import { useQuery } from '@tanstack/react-query';

import { fieldCatalogApi, type FieldCatalogParams } from '@/shared/api/modules/data-catalog';

const LIST_STALE_MS = 30_000;

export function useCalculatedFields(params: FieldCatalogParams, enabled = true) {
  return useQuery({
    queryKey: ['data-catalog', 'calculated-fields', params],
    queryFn: () => fieldCatalogApi.calculatedFields(params),
    enabled,
    staleTime: LIST_STALE_MS,
  });
}

export function useCalculatedField(key?: string) {
  return useQuery({
    queryKey: ['data-catalog', 'calculated-field', key],
    queryFn: () => fieldCatalogApi.calculatedField(key as string),
    enabled: Boolean(key),
    staleTime: LIST_STALE_MS,
  });
}

export function useColumns(params: FieldCatalogParams, enabled = true) {
  return useQuery({
    queryKey: ['data-catalog', 'columns', params],
    queryFn: () => fieldCatalogApi.columns(params),
    enabled,
    staleTime: LIST_STALE_MS,
  });
}
