/* eslint-disable react-refresh/only-export-components */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useCallback, useState } from 'react';

import { dataCatalogApi } from '@/shared/api';

interface DataCatalogContextType {
  catalogData: any;
  catalogLoading: boolean;
  catalogError: any;
  refreshCatalog: () => Promise<void>;
  invalidateCatalog: () => void;
  rebuildCatalog: () => Promise<void>;
  isRebuilding: boolean;
}

const DataCatalogContext = createContext<DataCatalogContextType | undefined>(undefined);

export const useDataCatalog = () => {
  const context = useContext(DataCatalogContext);
  if (!context) {
    throw new Error('useDataCatalog must be used within a DataCatalogProvider');
  }
  return context;
};

interface DataCatalogProviderProps {
  children: React.ReactNode;
}

export function DataCatalogProvider({ children }: DataCatalogProviderProps) {
  const queryClient = useQueryClient();
  const [isRebuilding, setIsRebuilding] = useState(false);

  // Main query for catalog data
  const { 
    data: catalogData, 
    isLoading: catalogLoading, 
    error: catalogError,
    refetch 
  } = useQuery({
    queryKey: ['data-catalog'],
    queryFn: () => dataCatalogApi.getCatalog(),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (gcTime is the new name for cacheTime)
  });

  // Refresh catalog (uses cache if available)
  const refreshCatalog = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Invalidate catalog (forces refetch)
  const invalidateCatalog = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['data-catalog'] });
  }, [queryClient]);

  // Rebuild catalog (forces backend rebuild)
  const rebuildCatalog = useCallback(async () => {
    setIsRebuilding(true);
    try {
      await dataCatalogApi.rebuildCatalog();
      // After rebuild, invalidate cache to fetch fresh data
      invalidateCatalog();
      await refreshCatalog();
    } finally {
      setIsRebuilding(false);
    }
  }, [invalidateCatalog, refreshCatalog]);

  const value: DataCatalogContextType = {
    catalogData,
    catalogLoading,
    catalogError,
    refreshCatalog,
    invalidateCatalog,
    rebuildCatalog,
    isRebuilding,
  };

  return (
    <DataCatalogContext.Provider value={value}>
      {children}
    </DataCatalogContext.Provider>
  );
}