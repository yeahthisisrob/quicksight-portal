/**
 * Shared pagination, search, and sorting utilities for server-side operations
 *
 * This module provides the core algorithms for filtering, sorting, and paginating data.
 * Each vertical slice (asset-management, data-catalog, etc.) defines its own field
 * configurations using the shared types exported here.
 */

import type { components } from '@shared/generated/types';

/**
 * SearchMatchReason - imported from OpenAPI generated types (single source of truth)
 */
export type SearchMatchReason = components['schemas']['SearchMatchReason'];

export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface SortConfig<T> {
  field: keyof T | string;
  getValue: (item: T) => any;
  preCompute?: boolean;
}

/**
 * Search field configuration
 * - getValue: Extracts the searchable text from an item
 * - reason: If provided, tracks why the item matched (for UI display)
 */
export interface SearchFieldConfig<T> {
  getValue: (item: T) => string;
  reason?: SearchMatchReason;
}

/**
 * Apply search filter to items with optional match reason tracking
 */
export function applySearch<T extends Record<string, any>>(
  items: T[],
  search: string,
  searchFields: SearchFieldConfig<T>[]
): (T & { searchMatchReasons?: SearchMatchReason[] })[] {
  if (!search) {
    return items;
  }

  const searchLower = search.toLowerCase();
  const results: (T & { searchMatchReasons?: SearchMatchReason[] })[] = [];

  for (const item of items) {
    const matchReasons: SearchMatchReason[] = [];
    let matched = false;

    for (const config of searchFields) {
      const fieldValue = config.getValue(item) || '';
      if (fieldValue.toLowerCase().includes(searchLower)) {
        matched = true;
        if (config.reason) {
          matchReasons.push(config.reason);
        }
      }
    }

    if (matched) {
      if (matchReasons.length > 0) {
        const uniqueReasons = [...new Set(matchReasons)];
        results.push({ ...item, searchMatchReasons: uniqueReasons });
      } else {
        results.push(item);
      }
    }
  }

  return results;
}

/**
 * Apply sorting with optional pre-computation for expensive operations
 */
export function applySort<T>(
  items: T[],
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  sortConfigs: Record<string, SortConfig<T>>
): T[] {
  const config = sortConfigs[sortBy];
  if (!config) {
    return items;
  }

  let sortKeysMap: Map<T, any> | undefined;
  if (config.preCompute) {
    sortKeysMap = new Map();
    for (const item of items) {
      sortKeysMap.set(item, config.getValue(item));
    }
  }

  const sortedItems = [...items];
  sortedItems.sort((a, b) => {
    const aValue = sortKeysMap ? sortKeysMap.get(a) : config.getValue(a);
    const bValue = sortKeysMap ? sortKeysMap.get(b) : config.getValue(b);

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'desc' ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
    }
    return sortOrder === 'desc' ? (bValue || 0) - (aValue || 0) : (aValue || 0) - (bValue || 0);
  });

  return sortedItems;
}

/**
 * Apply pagination to get a slice of items
 */
export function paginate<T>(items: T[], page: number, pageSize: number): PaginationResult<T> {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasMore: endIndex < totalItems,
    },
  };
}

/**
 * Combined helper for search, sort, and pagination
 */
export function processPaginatedData<T extends Record<string, any>>(
  items: T[],
  params: PaginationParams,
  searchFields: SearchFieldConfig<T>[],
  sortConfigs: Record<string, SortConfig<T>>
): PaginationResult<T & { searchMatchReasons?: SearchMatchReason[] }> {
  let processedItems = applySearch(items, params.search || '', searchFields);

  if (params.sortBy && params.sortOrder) {
    processedItems = applySort(processedItems, params.sortBy, params.sortOrder, sortConfigs);
  }

  return paginate(processedItems, params.page, params.pageSize);
}
