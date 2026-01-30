import { GridSortModel } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';

import { dataCatalogApi, semanticApi } from '@/shared/api';
import { useDebounce, type TagFilter } from '@/shared/lib';

interface UseDataCatalogQueriesProps {
  viewMode: 'physical' | 'semantic' | 'mapping' | 'visual-fields' | 'calculated';
  page: number;
  pageSize: number;
  searchTerm: string;
  sortModel: GridSortModel;
  unmappedDialogOpen: boolean;
  includeTags?: TagFilter[];
  excludeTags?: TagFilter[];
  assetIds?: string[];
}

export function useDataCatalogQueries({
  viewMode,
  page,
  pageSize,
  searchTerm,
  sortModel,
  unmappedDialogOpen,
  includeTags,
  excludeTags,
  assetIds,
}: UseDataCatalogQueriesProps) {
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Serialize filters for query key stability
  const includeTagsKey = includeTags && includeTags.length > 0 ? JSON.stringify(includeTags) : '';
  const excludeTagsKey = excludeTags && excludeTags.length > 0 ? JSON.stringify(excludeTags) : '';
  const assetIdsKey = assetIds && assetIds.length > 0 ? JSON.stringify(assetIds) : '';

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
               includeTagsKey, excludeTagsKey, assetIdsKey],
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

      const apiParams: Record<string, any> = {
        page: page + 1,
        pageSize,
        search: debouncedSearchTerm,
        viewMode: (viewMode === 'physical' ? 'all' : viewMode === 'calculated' ? 'calculated' : viewMode === 'semantic' ? 'all' : 'all') as 'all' | 'calculated' | 'fields',
        ...sortParams,
      };

      // Add include/exclude tag filters as JSON strings
      if (includeTags && includeTags.length > 0) {
        apiParams.includeTags = JSON.stringify(includeTags);
      }
      if (excludeTags && excludeTags.length > 0) {
        apiParams.excludeTags = JSON.stringify(excludeTags);
      }
      // Add asset IDs filter
      if (assetIds && assetIds.length > 0) {
        apiParams.assetIds = JSON.stringify(assetIds);
      }

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