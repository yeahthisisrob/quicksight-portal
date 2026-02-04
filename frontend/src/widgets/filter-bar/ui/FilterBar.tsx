import { Search as SearchIcon } from '@mui/icons-material';
import {
  Box,
  TextField,
  Chip,
  Stack,
  Typography,
  Collapse,
  Paper,
  InputAdornment,
} from '@mui/material';
import React from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

import {
  FilterHeader,
  FilterControls,
  ActiveFiltersDisplay,
} from './components';
import { useFilterBarState } from '../lib/useFilterBarState';

import type { FilterBarProps } from '../lib/types';

// ============================================================================
// Main Component
// ============================================================================

export const FilterBar: React.FC<FilterBarProps> = (props) => {
  const {
    // Date filtering
    dateFilter,
    onDateFilterChange,
    showActivityOption = false,

    // Tag filtering
    enableTagFiltering = false,
    availableTags = [],
    includeTags = [],
    excludeTags = [],
    onIncludeTagsChange,
    onExcludeTagsChange,
    isLoadingTags = false,

    // Error filtering
    enableErrorFiltering = false,
    errorFilter,
    onErrorFilterChange,
    errorCount,

    // Activity filtering
    enableActivityFiltering = false,
    activityFilter,
    onActivityFilterChange,

    // Folder filtering
    enableFolderFiltering = false,
    availableFolders = [],
    includeFolders = [],
    excludeFolders = [],
    onIncludeFoldersChange,
    onExcludeFoldersChange,
    isLoadingFolders = false,

    // Asset selection
    enableAssetSelection = false,
    availableAssets = [],
    selectedAssets = [],
    onSelectedAssetsChange,

    // Search
    searchTerm,
    onSearchChange,
    showSearch = false,
    matchReasonSummary,
  } = props;

  const state = useFilterBarState({
    dateFilter,
    onDateFilterChange,
    availableTags,
    includeTags,
    excludeTags,
    onIncludeTagsChange,
    onExcludeTagsChange,
    errorFilter,
    onErrorFilterChange,
    activityFilter,
    onActivityFilterChange,
    includeFolders,
    excludeFolders,
    onIncludeFoldersChange,
    onExcludeFoldersChange,
    enableAssetSelection,
    availableAssets,
    selectedAssets,
    onSelectedAssetsChange,
  });

  return (
    <Paper
      elevation={0}
      sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2, overflow: 'hidden' }}
    >
      {/* Optional Search Bar */}
      {showSearch && onSearchChange && (
        <Box sx={{ px: 2, pt: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search assets..."
            value={searchTerm || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: colors.neutral[400] }} />
                </InputAdornment>
              ),
            }}
          />
          {/* Match Reason Summary */}
          {matchReasonSummary && matchReasonSummary.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                Matched by:
              </Typography>
              {matchReasonSummary.map((reason, idx) => (
                <Chip
                  key={idx}
                  label={`${reason.reason} (${reason.count})`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}

      <FilterHeader
        totalFilters={state.totalFilters}
        dateFilter={dateFilter}
        errorFilter={errorFilter}
        activityFilter={activityFilter}
        selectedAssets={selectedAssets}
        includeTags={includeTags}
        excludeTags={excludeTags}
        includeFolders={includeFolders}
        excludeFolders={excludeFolders}
        isExpanded={state.isExpanded}
        onToggleExpand={state.toggleExpanded}
        onClearAll={state.handleClearAll}
        onClearDateFilter={dateFilter ? state.handleClearDateFilter : undefined}
        onClearErrorFilter={errorFilter !== undefined ? state.handleClearErrorFilter : undefined}
        onClearActivityFilter={activityFilter !== undefined ? state.handleClearActivityFilter : undefined}
        onRemoveAsset={state.handleRemoveAsset}
        onRemoveIncludeTag={state.handleRemoveIncludeTag}
        onRemoveExcludeTag={state.handleRemoveExcludeTag}
        onRemoveIncludeFolder={state.handleRemoveIncludeFolder}
        onRemoveExcludeFolder={state.handleRemoveExcludeFolder}
        errorCount={errorCount}
      />

      <Collapse in={state.isExpanded}>
        <Box sx={{ p: spacing.md / 8, bgcolor: colors.neutral[50] }}>
          <FilterControls
            dateFilter={dateFilter}
            onDateFilterChange={onDateFilterChange}
            showActivityOption={showActivityOption}
            enableTagFiltering={enableTagFiltering}
            filterMode={state.filterMode}
            onFilterModeChange={state.setFilterMode}
            selectedKey={state.selectedKey}
            onSelectedKeyChange={state.setSelectedKey}
            allKeys={state.allKeys}
            groupedTags={state.groupedTags}
            includeTags={includeTags}
            excludeTags={excludeTags}
            isLoading={isLoadingTags}
            onAddTag={state.handleAddTag}
            enableErrorFiltering={enableErrorFiltering}
            errorFilter={errorFilter}
            onErrorFilterChange={onErrorFilterChange}
            errorCount={errorCount}
            enableActivityFiltering={enableActivityFiltering}
            activityFilter={activityFilter}
            onActivityFilterChange={onActivityFilterChange}
            enableFolderFiltering={enableFolderFiltering}
            folderFilterMode={state.folderFilterMode}
            onFolderFilterModeChange={state.setFolderFilterMode}
            availableFolders={availableFolders}
            includeFolders={includeFolders}
            excludeFolders={excludeFolders}
            isLoadingFolders={isLoadingFolders}
            onAddFolder={state.handleAddFolder}
            enableAssetSelection={enableAssetSelection}
            availableAssets={availableAssets}
            selectedAssets={selectedAssets}
            onAddAsset={state.handleAddAsset}
            onClearAll={state.handleClearAll}
            totalFilters={state.totalFilters}
          />

          <ActiveFiltersDisplay
            selectedAssets={selectedAssets}
            includeTags={includeTags}
            excludeTags={excludeTags}
            includeFolders={includeFolders}
            excludeFolders={excludeFolders}
            onRemoveAsset={state.handleRemoveAsset}
            onRemoveIncludeTag={state.handleRemoveIncludeTag}
            onRemoveExcludeTag={state.handleRemoveExcludeTag}
            onRemoveIncludeFolder={state.handleRemoveIncludeFolder}
            onRemoveExcludeFolder={state.handleRemoveExcludeFolder}
          />

          {!isLoadingTags && (availableTags.length > 0 || availableAssets.length > 0 || availableFolders.length > 0) && (
            <Typography
              variant="caption"
              sx={{ mt: spacing.sm / 8, display: 'block', color: colors.neutral[600] }}
            >
              {Object.keys(state.groupedTags).length > 0 &&
                `${Object.keys(state.groupedTags).length} tag keys | ${availableTags.length} tag values`}
              {availableFolders.length > 0 && ` | ${availableFolders.length} folders`}
              {availableAssets.length > 0 && ` | ${availableAssets.length} assets`}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
