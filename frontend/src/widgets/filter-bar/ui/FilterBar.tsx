import { Box, Collapse, Paper } from '@mui/material';
import React from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

import {
  FilterHeader,
  FilterControls,
  ActiveFiltersDisplay,
  SearchBar,
  FilterStats,
} from './components';
import { applyFilterBarDefaults } from '../lib/applyDefaults';
import { useFilterBarState } from '../lib/useFilterBarState';

import type { FilterBarProps } from '../lib/types';

// ============================================================================
// Main Component
// ============================================================================

export const FilterBar: React.FC<FilterBarProps> = (props) => {
  const p = applyFilterBarDefaults(props);

  const state = useFilterBarState({
    dateFilter: p.dateFilter,
    onDateFilterChange: p.onDateFilterChange,
    availableTags: p.availableTags,
    includeTags: p.includeTags,
    excludeTags: p.excludeTags,
    onIncludeTagsChange: p.onIncludeTagsChange,
    onExcludeTagsChange: p.onExcludeTagsChange,
    errorFilter: p.errorFilter,
    onErrorFilterChange: p.onErrorFilterChange,
    activityFilter: p.activityFilter,
    onActivityFilterChange: p.onActivityFilterChange,
    includeFolders: p.includeFolders,
    excludeFolders: p.excludeFolders,
    onIncludeFoldersChange: p.onIncludeFoldersChange,
    onExcludeFoldersChange: p.onExcludeFoldersChange,
    enableAssetSelection: p.enableAssetSelection,
    availableAssets: p.availableAssets,
    selectedAssets: p.selectedAssets,
    onSelectedAssetsChange: p.onSelectedAssetsChange,
  });

  const showSearchBar = p.showSearch && p.onSearchChange;
  const showStats = !p.isLoadingTags && (p.availableTags.length > 0 || p.availableAssets.length > 0 || p.availableFolders.length > 0);

  return (
    <Paper
      elevation={0}
      sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2, overflow: 'hidden' }}
    >
      {showSearchBar && (
        <SearchBar
          searchTerm={p.searchTerm}
          onSearchChange={p.onSearchChange!}
          matchReasonSummary={p.matchReasonSummary}
        />
      )}

      <FilterHeader
        totalFilters={state.totalFilters}
        dateFilter={p.dateFilter}
        errorFilter={p.errorFilter}
        activityFilter={p.activityFilter}
        selectedAssets={p.selectedAssets}
        includeTags={p.includeTags}
        excludeTags={p.excludeTags}
        includeFolders={p.includeFolders}
        excludeFolders={p.excludeFolders}
        isExpanded={state.isExpanded}
        onToggleExpand={state.toggleExpanded}
        onClearAll={state.handleClearAll}
        onClearDateFilter={p.dateFilter ? state.handleClearDateFilter : undefined}
        onClearErrorFilter={p.errorFilter !== undefined ? state.handleClearErrorFilter : undefined}
        onClearActivityFilter={p.activityFilter !== undefined ? state.handleClearActivityFilter : undefined}
        onRemoveAsset={state.handleRemoveAsset}
        onRemoveIncludeTag={state.handleRemoveIncludeTag}
        onRemoveExcludeTag={state.handleRemoveExcludeTag}
        onRemoveIncludeFolder={state.handleRemoveIncludeFolder}
        onRemoveExcludeFolder={state.handleRemoveExcludeFolder}
        errorCount={p.errorCount}
      />

      <Collapse in={state.isExpanded}>
        <Box sx={{ p: spacing.md / 8, bgcolor: colors.neutral[50] }}>
          <FilterControls
            dateFilter={p.dateFilter}
            onDateFilterChange={p.onDateFilterChange}
            showActivityOption={p.showActivityOption}
            enableTagFiltering={p.enableTagFiltering}
            filterMode={state.filterMode}
            onFilterModeChange={state.setFilterMode}
            selectedKey={state.selectedKey}
            onSelectedKeyChange={state.setSelectedKey}
            allKeys={state.allKeys}
            groupedTags={state.groupedTags}
            includeTags={p.includeTags}
            excludeTags={p.excludeTags}
            isLoading={p.isLoadingTags}
            onAddTag={state.handleAddTag}
            enableErrorFiltering={p.enableErrorFiltering}
            errorFilter={p.errorFilter}
            onErrorFilterChange={p.onErrorFilterChange}
            errorCount={p.errorCount}
            enableActivityFiltering={p.enableActivityFiltering}
            activityFilter={p.activityFilter}
            onActivityFilterChange={p.onActivityFilterChange}
            enableFolderFiltering={p.enableFolderFiltering}
            folderFilterMode={state.folderFilterMode}
            onFolderFilterModeChange={state.setFolderFilterMode}
            availableFolders={p.availableFolders}
            includeFolders={p.includeFolders}
            excludeFolders={p.excludeFolders}
            isLoadingFolders={p.isLoadingFolders}
            onAddFolder={state.handleAddFolder}
            enableAssetSelection={p.enableAssetSelection}
            availableAssets={p.availableAssets}
            selectedAssets={p.selectedAssets}
            onAddAsset={state.handleAddAsset}
            onClearAll={state.handleClearAll}
            totalFilters={state.totalFilters}
          />

          <ActiveFiltersDisplay
            selectedAssets={p.selectedAssets}
            includeTags={p.includeTags}
            excludeTags={p.excludeTags}
            includeFolders={p.includeFolders}
            excludeFolders={p.excludeFolders}
            onRemoveAsset={state.handleRemoveAsset}
            onRemoveIncludeTag={state.handleRemoveIncludeTag}
            onRemoveExcludeTag={state.handleRemoveExcludeTag}
            onRemoveIncludeFolder={state.handleRemoveIncludeFolder}
            onRemoveExcludeFolder={state.handleRemoveExcludeFolder}
          />

          {showStats && (
            <FilterStats
              tagKeyCount={Object.keys(state.groupedTags).length}
              tagValueCount={p.availableTags.length}
              folderCount={p.availableFolders.length}
              assetCount={p.availableAssets.length}
            />
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
