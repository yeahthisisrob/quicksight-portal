/**
 * Shared pagination and sorting utilities for server-side operations
 */

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
  preCompute?: boolean; // Flag to pre-compute expensive values
}

/**
 * Apply search filter to items
 */
export function applySearch<T>(
  items: T[],
  search: string,
  searchFields: ((item: T) => string)[]
): T[] {
  if (!search) {
    return items;
  }

  const searchLower = search.toLowerCase();

  const filtered = items.filter((item) => {
    return searchFields.some((getField) => {
      const fieldValue = getField(item) || '';
      const fieldLower = fieldValue.toLowerCase();
      return fieldLower.includes(searchLower);
    });
  });

  return filtered;
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

  // Pre-compute expensive values if needed
  let sortKeysMap: Map<T, any> | undefined;
  if (config.preCompute) {
    sortKeysMap = new Map();
    for (const item of items) {
      sortKeysMap.set(item, config.getValue(item));
    }
  }

  // Sort items
  const sortedItems = [...items];
  sortedItems.sort((a, b) => {
    const aValue = sortKeysMap ? sortKeysMap.get(a) : config.getValue(a);
    const bValue = sortKeysMap ? sortKeysMap.get(b) : config.getValue(b);

    // Handle string vs number comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'desc' ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
    } else {
      return sortOrder === 'desc' ? (bValue || 0) - (aValue || 0) : (aValue || 0) - (bValue || 0);
    }
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
export function processPaginatedData<T>(
  items: T[],
  params: PaginationParams,
  searchFields: ((item: T) => string)[],
  sortConfigs: Record<string, SortConfig<T>>
): PaginationResult<T> {
  // Apply search
  let processedItems = applySearch(items, params.search || '', searchFields);

  // Apply sort
  if (params.sortBy && params.sortOrder) {
    processedItems = applySort(processedItems, params.sortBy, params.sortOrder, sortConfigs);
  }

  // Apply pagination
  const result = paginate(processedItems, params.page, params.pageSize);

  return result;
}
