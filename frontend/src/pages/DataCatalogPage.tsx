/**
 * Refactored DataCatalogPage with reduced complexity
 */
import { Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import {
  DialogsContainer,
  PageComponents,
  rowDataProcessors
} from '@/widgets/data-catalog-dialogs';

import {
  DataCatalogHeader,
  DataCatalogProvider,
  DataCatalogStats,
  useDataCatalogHandlers,
  useDataCatalogQueries,
  useDataCatalogState
} from '@/features/data-catalog';

import { dataCatalogApi } from '@/shared/api/modules/data-catalog';
import { useDebounce, useFilters } from '@/shared/lib';
import { PageHeader } from '@/shared/ui';

const { ContentView, SearchBar } = PageComponents;
const {
  processCalculatedViewRows,
  processPhysicalViewRows,
  processSemanticViewRows,
  processVisualFieldsRows,
} = rowDataProcessors;

/**
 * Process rows based on view mode
 */
function processRows(viewMode: string, catalogData: any, terms: any[], mappings: any[], visualFieldCatalog: any) {
  switch (viewMode) {
    case 'physical':
      return processPhysicalViewRows(catalogData, mappings || []);
    case 'semantic':
      return processSemanticViewRows(terms || [], mappings || [], visualFieldCatalog);
    case 'calculated':
      return processCalculatedViewRows(catalogData);
    case 'visual-fields':
      return processVisualFieldsRows(visualFieldCatalog, terms || [], mappings || []);
    case 'mapping':
      return mappings || [];
    default:
      return [];
  }
}

/**
 * Get loading state based on view mode
 */
function getLoadingState(viewMode: string, termsLoading: boolean, visualFieldsLoading: boolean, catalogLoading: boolean) {
  if (viewMode === 'semantic') return termsLoading;
  if (viewMode === 'visual-fields') return visualFieldsLoading;
  return catalogLoading;
}

/**
 * Get total rows based on view mode
 * Uses pagination.totalItems from API response per OpenAPI contract
 * Visual fields uses summary.totalMappings (legacy pattern)
 */
function getTotalRows(viewMode: string, terms: any[], visualFieldCatalog: any, catalogData: any) {
  if (viewMode === 'semantic') return terms?.length || 0;
  if (viewMode === 'visual-fields') {
    return visualFieldCatalog?.pagination?.totalItems || visualFieldCatalog?.summary?.totalMappings || 0;
  }
  return catalogData?.pagination?.totalItems || 0;
}

function DataCatalogPageContent() {
  const state = useDataCatalogState();

  // Use shared filter hook for tag and asset filtering (uses OpenAPI generated types)
  const {
    includeTags,
    excludeTags,
    selectedAssets,
    setIncludeTags,
    setExcludeTags,
    setSelectedAssets,
    getAssetIds,
  } = useFilters();

  // Fetch available tags
  const { data: availableTags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ['available-tags'],
    queryFn: () => dataCatalogApi.getAvailableTags(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch available assets for filtering
  const { data: availableAssets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['available-assets'],
    queryFn: () => dataCatalogApi.getAvailableAssets(),
    staleTime: 5 * 60 * 1000,
  });

  const debouncedSearchTerm = useDebounce(state.searchTerm, 500);
  const debouncedIncludeTags = useDebounce(includeTags, 300);
  const debouncedExcludeTags = useDebounce(excludeTags, 300);
  const debouncedAssetIds = useDebounce(getAssetIds(), 300);

  const queries = useDataCatalogQueries({
    viewMode: state.viewMode,
    page: state.page,
    pageSize: state.pageSize,
    searchTerm: debouncedSearchTerm,
    sortModel: state.sortModel,
    unmappedDialogOpen: state.dialogState.unmappedDialogOpen,
    includeTags: debouncedIncludeTags,
    excludeTags: debouncedExcludeTags,
    assetIds: debouncedAssetIds,
  });

  const handlers = useDataCatalogHandlers();

  // Process data for rendering
  const rowsData = processRows(
    state.viewMode, 
    queries.catalogData, 
    queries.terms || [], 
    queries.mappings || [], 
    queries.visualFieldCatalog
  );
  
  const loading = getLoadingState(
    state.viewMode,
    queries.termsLoading,
    queries.visualFieldsLoading,
    queries.catalogLoading
  );
  
  const totalRows = getTotalRows(
    state.viewMode,
    queries.terms || [],
    queries.visualFieldCatalog,
    queries.catalogData
  );

  // Dialog handlers
  const dialogHandlers = {
    onFieldClick: (field: any) => state.openDialog('detailsDialogOpen', field),
    onTermClick: (term: any) => state.openDialog('termDialogOpen', term),
    onMappingClick: (mapping: any) => state.openDialog('mappingDialogOpen', mapping),
    onUnmappedClick: () => state.openDialog('unmappedDialogOpen'),
    onAssetListClick: (assets: any[]) => state.openDialog('assetListDialogOpen', { assets }),
    onMappedFieldsClick: (term: any) => state.openDialog('mappedFieldsDialogOpen', term),
  };

  const additionalData = {
    terms: queries.terms,
    mappings: queries.mappings,
    unmappedFields: queries.unmappedFields,
    availableTags,
    tagsLoading,
    includeTags,
    setIncludeTags,
    excludeTags,
    setExcludeTags,
    calculatedFields: queries.catalogData?.items?.filter((f: any) => f.isCalculated) || [],
  };

  return (
    <Box>
      <PageHeader title="Data Catalog" />

      <DataCatalogHeader
        viewMode={state.viewMode}
        onViewModeChange={state.setViewMode}
        availableTags={availableTags}
        includeTags={includeTags}
        excludeTags={excludeTags}
        onIncludeTagsChange={setIncludeTags}
        onExcludeTagsChange={setExcludeTags}
        tagsLoading={tagsLoading}
        availableAssets={availableAssets}
        selectedAssets={selectedAssets}
        onSelectedAssetsChange={setSelectedAssets}
        assetsLoading={assetsLoading}
      />
      
      <DataCatalogStats
        viewMode={state.viewMode}
        stats={queries.stats}
        catalogSummary={queries.catalogData?.summary}
        visualFieldSummary={queries.visualFieldCatalog?.summary}
      />
      
      <Box sx={{ mb: 2 }}>
        <SearchBar 
          searchTerm={state.searchTerm} 
          onSearchChange={state.setSearchTerm}
        />
      </Box>
        
      <ContentView
        viewMode={state.viewMode}
        rows={rowsData}
        totalRows={totalRows}
        loading={loading}
        page={state.page}
        pageSize={state.pageSize}
        sortModel={state.sortModel}
        onPageChange={state.setPage}
        onPageSizeChange={state.setPageSize}
        onSortModelChange={state.setSortModel}
        dialogHandlers={dialogHandlers}
        additionalData={additionalData}
      />
        
      <DialogsContainer
        dialogState={state.dialogState}
        closeDialog={(name) => state.closeDialog(name as keyof typeof state.dialogState)}
        closeConfirmDialog={state.closeConfirmDialog}
        catalogData={queries.catalogData}
        terms={queries.terms || []}
        mappings={queries.mappings || []}
        unmappedFields={queries.unmappedFields || []}
        visualFieldCatalog={queries.visualFieldCatalog}
        viewMode={state.viewMode}
        invalidateCatalogQueries={handlers.invalidateCatalogQueries}
        invalidateSemanticQueries={handlers.invalidateSemanticQueries}
      />
    </Box>
  );
}

export default function DataCatalogPage() {
  return (
    <DataCatalogProvider>
      <DataCatalogPageContent />
    </DataCatalogProvider>
  );
}