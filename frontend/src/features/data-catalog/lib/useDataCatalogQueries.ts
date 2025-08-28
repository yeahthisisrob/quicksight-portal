import { GridSortModel } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';

import { dataCatalogApi, semanticApi } from '@/shared/api';
import { useDebounce } from '@/shared/lib';

interface UseDataCatalogQueriesProps {
  viewMode: 'physical' | 'semantic' | 'mapping' | 'visual-fields' | 'calculated';
  page: number;
  pageSize: number;
  searchTerm: string;
  sortModel: GridSortModel;
  unmappedDialogOpen: boolean;
  tagKey?: string;
  tagValue?: string;
}

export function useDataCatalogQueries({
  viewMode,
  page,
  pageSize,
  searchTerm,
  sortModel,
  unmappedDialogOpen,
  tagKey,
  tagValue,
}: UseDataCatalogQueriesProps) {
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const catalogData = useQuery<{
    items: any[];
    summary: any;
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>({
    queryKey: ['data-catalog-paginated', page + 1, pageSize, debouncedSearchTerm, viewMode, 
               viewMode !== 'semantic' && sortModel.length > 0 ? `${sortModel[0].field}-${sortModel[0].sort}` : 'no-sort',
               tagKey, tagValue],
    queryFn: () => {
      const sortParams = viewMode !== 'semantic' && sortModel.length > 0 && sortModel[0].sort ? {
        sortBy: sortModel[0].field,
        sortOrder: sortModel[0].sort as 'asc' | 'desc',
      } : {};
      
      if (viewMode === 'visual-fields') {
        return { 
          items: [], 
          summary: {}, 
          pagination: { 
            page: 1, 
            pageSize: 50, 
            totalItems: 0, 
            totalPages: 0, 
            hasMore: false 
          } 
        };
      }
      
      const apiParams = {
        page: page + 1,
        pageSize,
        search: debouncedSearchTerm,
        viewMode: (viewMode === 'physical' ? 'all' : viewMode === 'calculated' ? 'calculated' : viewMode === 'semantic' ? 'all' : 'all') as 'all' | 'calculated' | 'fields',
        ...sortParams,
        ...(tagKey && tagValue ? { tagKey, tagValue } : {}),
      };
      
      return dataCatalogApi.getDataCatalog(apiParams);
    },
    placeholderData: undefined,
  });

  const terms = useQuery({
    queryKey: ['semantic-terms', searchTerm],
    queryFn: () => semanticApi.getTerms({ search: searchTerm }),
  });

  const mappings = useQuery({
    queryKey: ['semantic-mappings'],
    queryFn: () => semanticApi.getMappings(),
  });

  const stats = useQuery({
    queryKey: ['semantic-stats'],
    queryFn: semanticApi.getStats,
  });

  const unmappedFields = useQuery({
    queryKey: ['unmapped-fields'],
    queryFn: semanticApi.getUnmappedFields,
    enabled: unmappedDialogOpen,
  });

  const visualFieldCatalog = useQuery({
    queryKey: ['visual-field-catalog', viewMode, page, pageSize, searchTerm, sortModel],
    queryFn: () => {
      if (viewMode !== 'visual-fields' && viewMode !== 'semantic') return null;
      
      const params: any = {
        page: viewMode === 'visual-fields' ? page + 1 : 1,
        pageSize: viewMode === 'visual-fields' ? pageSize : 1000,
        search: viewMode === 'visual-fields' ? searchTerm : '',
      };
      
      if (viewMode === 'visual-fields' && sortModel.length > 0) {
        params.sortBy = sortModel[0].field;
        params.sortOrder = sortModel[0].sort || 'asc';
      }
      
      return dataCatalogApi.getVisualFieldCatalog(params);
    },
    enabled: viewMode === 'visual-fields' || viewMode === 'semantic',
    staleTime: 0,
  });

  return {
    catalogData: catalogData.data,
    catalogLoading: catalogData.isLoading,
    terms: terms.data,
    termsLoading: terms.isLoading,
    mappings: mappings.data,
    stats: stats.data,
    unmappedFields: unmappedFields.data,
    visualFieldCatalog: visualFieldCatalog.data,
    visualFieldsLoading: visualFieldCatalog.isLoading,
  };
}