import { useState, useCallback } from 'react';

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore?: boolean;  // Made optional to match backend API
}

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

export interface UsePaginationReturn {
  pagination: PaginationInfo;
  setPagination: (pagination: PaginationInfo) => void;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  setPageSize: (pageSize: number) => void;
  updateTotalItems: (totalItems: number) => void;
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    initialPageSize = 10,
  } = options;

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: initialPage,
    pageSize: initialPageSize,
    totalItems: 0,
    totalPages: 0,
    hasMore: false,
  });

  const updateTotalItems = useCallback((totalItems: number) => {
    setPagination(prev => ({
      ...prev,
      totalItems,
      totalPages: Math.ceil(totalItems / prev.pageSize),
      hasMore: prev.page < Math.ceil(totalItems / prev.pageSize),
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setPagination(prev => ({
      ...prev,
      page: Math.max(1, Math.min(page, prev.totalPages)),
      hasMore: page < prev.totalPages,
    }));
  }, []);

  const goToNextPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      page: Math.min(prev.page + 1, prev.totalPages),
      hasMore: prev.page + 1 < prev.totalPages,
    }));
  }, []);

  const goToPreviousPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      page: Math.max(prev.page - 1, 1),
      hasMore: Math.max(prev.page - 1, 1) < prev.totalPages,
    }));
  }, []);

  const goToFirstPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      page: 1,
      hasMore: 1 < prev.totalPages,
    }));
  }, []);

  const goToLastPage = useCallback(() => {
    setPagination(prev => ({
      ...prev,
      page: prev.totalPages,
      hasMore: false,
    }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setPagination(prev => {
      const newTotalPages = Math.ceil(prev.totalItems / pageSize);
      const newPage = Math.min(prev.page, newTotalPages);
      return {
        ...prev,
        pageSize,
        page: newPage,
        totalPages: newTotalPages,
        hasMore: newPage < newTotalPages,
      };
    });
  }, []);

  return {
    pagination,
    setPagination,
    currentPage: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: pagination.totalPages,
    hasNextPage: pagination.hasMore ?? false,
    hasPreviousPage: pagination.page > 1,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    setPageSize,
    updateTotalItems,
  };
}