/**
 * Refactored DataCatalogPage with reduced complexity
 */
import { Box, Typography, alpha } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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
import { colors, spacing } from '@/shared/design-system/theme';
import { useDebounce } from '@/shared/lib';

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

interface TagFilter {
  key: string;
  value: string;
}

interface AssetFilter {
  id: string;
  name: string;
  type: string;
}

function DataCatalogPageContent() {
  const state = useDataCatalogState();
  const [tagFilter, setTagFilter] = useState<{ key: string; value: string } | null>(null);
  const [includeTags, setIncludeTags] = useState<TagFilter[]>([]);
  const [excludeTags, setExcludeTags] = useState<TagFilter[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<AssetFilter[]>([]);
  
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
  const debouncedTagFilter = useDebounce(tagFilter, 300);
  const debouncedIncludeTags = useDebounce(includeTags, 300);
  const debouncedExcludeTags = useDebounce(excludeTags, 300);
  const debouncedAssetIds = useDebounce(selectedAssets.map(a => a.id), 300);

  const queries = useDataCatalogQueries({
    viewMode: state.viewMode,
    page: state.page,
    pageSize: state.pageSize,
    searchTerm: debouncedSearchTerm,
    sortModel: state.sortModel,
    unmappedDialogOpen: state.dialogState.unmappedDialogOpen,
    tagKey: debouncedTagFilter?.key,
    tagValue: debouncedTagFilter?.value,
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
    tagFilter,
    setTagFilter,
    includeTags,
    setIncludeTags,
    excludeTags,
    setExcludeTags,
    calculatedFields: queries.catalogData?.items?.filter((f: any) => f.isCalculated) || [],
  };

  return (
    <Box>
      {/* Header matching TableHeader pattern */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: spacing.lg / 8,
          p: spacing.lg / 8,
          borderRadius: `${spacing.sm / 8}px`,
          background: `linear-gradient(135deg, ${alpha(colors.primary.light, 0.05)} 0%, ${alpha(colors.primary.main, 0.05)} 100%)`,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(colors.primary.main, 0.1)}`,
        }}
      >
        <Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.primary.dark} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5,
            }}
          >
            Data Catalog
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: colors.neutral[600],
              fontWeight: 400,
            }}
          >
            Explore and manage your data fields and semantic layer
          </Typography>
        </Box>
      </Box>

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