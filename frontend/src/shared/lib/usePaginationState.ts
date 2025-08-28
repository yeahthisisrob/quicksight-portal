import { useState, useCallback } from 'react';

import { PaginationInfo } from './usePagination';

/**
 * A hook that manages pagination state with null support for backward compatibility
 * This is designed to work with existing code that expects pagination to be null initially
 */
export function usePaginationState() {
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const updatePagination = useCallback((newPagination: PaginationInfo) => {
    setPagination(newPagination);
  }, []);

  const clearPagination = useCallback(() => {
    setPagination(null);
  }, []);

  return {
    pagination,
    setPagination: updatePagination,
    clearPagination,
  };
}