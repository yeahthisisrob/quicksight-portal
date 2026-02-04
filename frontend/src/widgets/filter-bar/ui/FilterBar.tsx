import {
  FilterList,
  Clear,
  ExpandMore,
  ExpandLess,
  LocalOffer,
  Add,
  Remove,
  Schedule,
  Error as ErrorIcon,
  CheckCircle,
  Dashboard as DashboardIcon,
  Analytics as AnalysisIcon,
  Storage as DatasetIcon,
  Search as SearchIcon,
  Folder as FolderIcon,
  Timeline as ActivityIcon,
  Block as NoActivityIcon,
} from '@mui/icons-material';
import {
  Box,
  Autocomplete,
  TextField,
  Chip,
  Stack,
  Typography,
  IconButton,
  Collapse,
  Paper,
  Tooltip,
  alpha,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
} from '@mui/material';
import React, { useState, useMemo, useCallback } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

import {
  DATE_FIELD_OPTIONS,
  DATE_RANGE_OPTIONS,
  DEFAULT_DATE_FILTER,
  DEFAULT_ERROR_FILTER,
  DEFAULT_ACTIVITY_FILTER,
} from '../lib/constants';

import type {
  FilterBarProps,
  TagOption,
  TagFilter,
  DateFilterState,
  DateFieldOption,
  DateRangeOption,
  ErrorFilterState,
  ActivityFilterState,
  FolderOption,
  FolderFilter,
  AssetOption,
  AssetFilter,
} from '../lib/types';

// ============================================================================
// Constants
// ============================================================================

const ASSET_KEY = '__ASSET__';

const ASSET_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  dashboard: { icon: DashboardIcon, color: '#1976d2' },
  analysis: { icon: AnalysisIcon, color: '#9c27b0' },
  dataset: { icon: DatasetIcon, color: '#2e7d32' },
};

const CHIP_STYLES = {
  small: { height: 18, fontSize: '0.65rem' },
  medium: { height: 20, fontSize: '0.7rem' },
  withIcon: { '& .MuiChip-icon': { marginLeft: '4px' } },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

const getAssetConfig = (type: string) =>
  ASSET_TYPE_CONFIG[type] || { icon: DatasetIcon, color: colors.neutral[500] };

const truncateText = (text: string, maxLength: number) =>
  text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

const getDateFilterLabel = (filter: DateFilterState) => {
  const field = DATE_FIELD_OPTIONS.find((f) => f.value === filter.field)?.label || filter.field;
  const range = DATE_RANGE_OPTIONS.find((r) => r.value === filter.range)?.label || filter.range;
  return `${field}: ${range}`;
};

// ============================================================================
// Sub-Components
// ============================================================================

interface CountChipProps {
  count: number;
  label: string;
  color?: 'primary' | 'success' | 'error' | 'warning';
}

const CountChip: React.FC<CountChipProps> = ({ count, label, color }) => (
  <Chip
    label={`${count} ${label}`}
    size="small"
    color={color}
    variant={color ? 'filled' : 'outlined'}
    sx={{
      ...CHIP_STYLES.small,
      ...(color ? {} : { bgcolor: colors.neutral[200], color: colors.neutral[700] }),
    }}
  />
);

interface AssetChipProps {
  asset: AssetFilter;
  onDelete: () => void;
  stopPropagation?: boolean;
  showFullName?: boolean;
}

const AssetChip: React.FC<AssetChipProps> = ({
  asset,
  onDelete,
  stopPropagation = false,
  showFullName = false,
}) => {
  const config = getAssetConfig(asset.type);
  const Icon = config.icon;

  const handleDelete = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    onDelete();
  };

  return (
    <Chip
      icon={<Icon sx={{ fontSize: 14, color: config.color }} />}
      label={showFullName ? asset.name : truncateText(asset.name, 15)}
      size="small"
      variant="outlined"
      sx={{
        height: 22,
        fontSize: '0.7rem',
        bgcolor: alpha(config.color, 0.1),
        borderColor: config.color,
        ...CHIP_STYLES.withIcon,
        mb: showFullName ? 0.5 : 0,
      }}
      onDelete={handleDelete}
    />
  );
};

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, icon, color, children }) => (
  <Box sx={{ mb: 1 }}>
    <Typography
      variant="caption"
      fontWeight={600}
      color={color}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
    >
      {icon} {title}
    </Typography>
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {children}
    </Stack>
  </Box>
);

// ============================================================================
// Filter Header Component
// ============================================================================

interface FilterHeaderProps {
  totalFilters: number;
  dateFilter?: DateFilterState;
  errorFilter?: ErrorFilterState;
  activityFilter?: ActivityFilterState;
  selectedAssets: AssetFilter[];
  includeTags: TagFilter[];
  excludeTags: TagFilter[];
  includeFolders: FolderFilter[];
  excludeFolders: FolderFilter[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClearAll: () => void;
  onClearDateFilter?: () => void;
  onClearErrorFilter?: () => void;
  onClearActivityFilter?: () => void;
  onRemoveAsset: (index: number) => void;
  onRemoveIncludeTag: (index: number) => void;
  onRemoveExcludeTag: (index: number) => void;
  onRemoveIncludeFolder: (index: number) => void;
  onRemoveExcludeFolder: (index: number) => void;
  errorCount?: number;
}

const FilterHeader: React.FC<FilterHeaderProps> = ({
  totalFilters,
  dateFilter,
  errorFilter,
  activityFilter,
  selectedAssets,
  includeTags,
  excludeTags,
  includeFolders,
  excludeFolders,
  isExpanded,
  onToggleExpand,
  onClearAll,
  onClearDateFilter,
  onClearErrorFilter,
  onClearActivityFilter,
  onRemoveAsset,
  onRemoveIncludeTag,
  onRemoveExcludeTag,
  onRemoveIncludeFolder,
  onRemoveExcludeFolder,
  errorCount,
}) => {
  const hasDateFilter = dateFilter && dateFilter.range !== 'all';
  const hasErrorFilter = errorFilter && errorFilter !== 'all';
  const hasActivityFilter = activityFilter && activityFilter !== 'all';

  const headerSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    px: 2,
    py: 1,
    bgcolor: totalFilters > 0 ? alpha(colors.primary.main, 0.08) : 'background.paper',
    borderBottom: isExpanded ? '1px solid' : 'none',
    borderColor: 'divider',
    cursor: 'pointer',
  };

  return (
    <Box sx={headerSx} onClick={onToggleExpand}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <FilterList
          sx={{ color: totalFilters > 0 ? colors.primary.main : colors.neutral[500], fontSize: 20 }}
        />
        <Typography variant="subtitle2" fontWeight={600}>
          Filters
        </Typography>

        {totalFilters > 0 && (
          <Chip
            label={`${totalFilters} active`}
            size="small"
            color="primary"
            onDelete={(e) => {
              e.stopPropagation();
              onClearAll();
            }}
          />
        )}

        {/* Date filter chip */}
        {hasDateFilter && onClearDateFilter && (
          <Chip
            icon={<Schedule sx={{ fontSize: 14 }} />}
            label={getDateFilterLabel(dateFilter)}
            size="small"
            color="info"
            variant="outlined"
            sx={CHIP_STYLES.medium}
            onDelete={(e) => {
              e.stopPropagation();
              onClearDateFilter();
            }}
          />
        )}

        {/* Error filter chip */}
        {hasErrorFilter && onClearErrorFilter && (
          <Chip
            icon={
              errorFilter === 'with_errors' ? (
                <ErrorIcon sx={{ fontSize: 14 }} />
              ) : (
                <CheckCircle sx={{ fontSize: 14 }} />
              )
            }
            label={
              errorFilter === 'with_errors'
                ? `With errors${errorCount !== undefined ? ` (${errorCount})` : ''}`
                : 'Without errors'
            }
            size="small"
            color={errorFilter === 'with_errors' ? 'error' : 'success'}
            variant="outlined"
            sx={CHIP_STYLES.medium}
            onDelete={(e) => {
              e.stopPropagation();
              onClearErrorFilter();
            }}
          />
        )}

        {/* Activity filter chip */}
        {hasActivityFilter && onClearActivityFilter && (
          <Chip
            icon={
              activityFilter === 'with_activity' ? (
                <ActivityIcon sx={{ fontSize: 14 }} />
              ) : (
                <NoActivityIcon sx={{ fontSize: 14 }} />
              )
            }
            label={activityFilter === 'with_activity' ? 'With activity' : 'No activity'}
            size="small"
            color={activityFilter === 'with_activity' ? 'info' : 'warning'}
            variant="outlined"
            sx={CHIP_STYLES.medium}
            onDelete={(e) => {
              e.stopPropagation();
              onClearActivityFilter();
            }}
          />
        )}

        {/* Asset chips */}
        {selectedAssets.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {selectedAssets.slice(0, 2).map((asset, idx) => (
              <AssetChip
                key={`asset-${idx}`}
                asset={asset}
                onDelete={() => onRemoveAsset(idx)}
                stopPropagation
              />
            ))}
            {selectedAssets.length > 2 && (
              <Typography variant="caption" color="text.secondary">
                +{selectedAssets.length - 2} more
              </Typography>
            )}
          </Stack>
        )}

        {/* Include tag chips */}
        {includeTags.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Add sx={{ fontSize: 14, color: 'success.main' }} />
            {includeTags.slice(0, 2).map((tag, idx) => (
              <Chip
                key={`inc-${idx}`}
                label={`${tag.key}=${tag.value}`}
                size="small"
                color="success"
                variant="outlined"
                sx={CHIP_STYLES.medium}
                onDelete={(e) => {
                  e.stopPropagation();
                  onRemoveIncludeTag(idx);
                }}
              />
            ))}
            {includeTags.length > 2 && (
              <Typography variant="caption" color="text.secondary">
                +{includeTags.length - 2} more
              </Typography>
            )}
          </Stack>
        )}

        {/* Exclude tag chips */}
        {excludeTags.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Remove sx={{ fontSize: 14, color: 'error.main' }} />
            {excludeTags.slice(0, 2).map((tag, idx) => (
              <Chip
                key={`exc-${idx}`}
                label={`${tag.key}=${tag.value}`}
                size="small"
                color="error"
                variant="outlined"
                sx={CHIP_STYLES.medium}
                onDelete={(e) => {
                  e.stopPropagation();
                  onRemoveExcludeTag(idx);
                }}
              />
            ))}
            {excludeTags.length > 2 && (
              <Typography variant="caption" color="text.secondary">
                +{excludeTags.length - 2} more
              </Typography>
            )}
          </Stack>
        )}

        {/* Include folder chips */}
        {includeFolders.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <FolderIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            {includeFolders.slice(0, 2).map((folder, idx) => (
              <Chip
                key={`inc-folder-${idx}`}
                label={folder.name}
                size="small"
                color="primary"
                variant="outlined"
                sx={CHIP_STYLES.medium}
                onDelete={(e) => {
                  e.stopPropagation();
                  onRemoveIncludeFolder(idx);
                }}
              />
            ))}
            {includeFolders.length > 2 && (
              <Typography variant="caption" color="text.secondary">
                +{includeFolders.length - 2} more
              </Typography>
            )}
          </Stack>
        )}

        {/* Exclude folder chips */}
        {excludeFolders.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <FolderIcon sx={{ fontSize: 14, color: 'error.main' }} />
            {excludeFolders.slice(0, 2).map((folder, idx) => (
              <Chip
                key={`exc-folder-${idx}`}
                label={folder.name}
                size="small"
                color="error"
                variant="outlined"
                sx={CHIP_STYLES.medium}
                onDelete={(e) => {
                  e.stopPropagation();
                  onRemoveExcludeFolder(idx);
                }}
              />
            ))}
            {excludeFolders.length > 2 && (
              <Typography variant="caption" color="text.secondary">
                +{excludeFolders.length - 2} more
              </Typography>
            )}
          </Stack>
        )}
      </Stack>

      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        {isExpanded ? <ExpandLess /> : <ExpandMore />}
      </IconButton>
    </Box>
  );
};

// ============================================================================
// Filter Controls Component
// ============================================================================

interface FilterControlsProps {
  // Date controls
  dateFilter?: DateFilterState;
  onDateFilterChange?: (filter: DateFilterState) => void;
  showActivityOption?: boolean;

  // Tag controls
  enableTagFiltering: boolean;
  filterMode: 'include' | 'exclude';
  onFilterModeChange: (mode: 'include' | 'exclude') => void;
  selectedKey: string | null;
  onSelectedKeyChange: (key: string | null) => void;
  allKeys: string[];
  groupedTags: Record<string, TagOption[]>;
  includeTags: TagFilter[];
  excludeTags: TagFilter[];
  isLoading: boolean;
  onAddTag: (tag: TagOption) => void;

  // Error controls
  enableErrorFiltering: boolean;
  errorFilter?: ErrorFilterState;
  onErrorFilterChange?: (filter: ErrorFilterState) => void;
  errorCount?: number;

  // Activity controls
  enableActivityFiltering: boolean;
  activityFilter?: ActivityFilterState;
  onActivityFilterChange?: (filter: ActivityFilterState) => void;

  // Folder controls
  enableFolderFiltering: boolean;
  folderFilterMode: 'include' | 'exclude';
  onFolderFilterModeChange: (mode: 'include' | 'exclude') => void;
  availableFolders: FolderOption[];
  includeFolders: FolderFilter[];
  excludeFolders: FolderFilter[];
  isLoadingFolders: boolean;
  onAddFolder: (folder: FolderOption) => void;

  // Asset controls
  enableAssetSelection: boolean;
  availableAssets: AssetOption[];
  selectedAssets: AssetFilter[];
  onAddAsset: (asset: AssetOption) => void;

  onClearAll: () => void;
  totalFilters: number;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  dateFilter,
  onDateFilterChange,
  showActivityOption,
  enableTagFiltering,
  filterMode,
  onFilterModeChange,
  selectedKey,
  onSelectedKeyChange,
  allKeys,
  groupedTags,
  includeTags,
  excludeTags,
  isLoading,
  onAddTag,
  enableErrorFiltering,
  errorFilter,
  onErrorFilterChange,
  errorCount,
  enableActivityFiltering,
  activityFilter,
  onActivityFilterChange,
  enableFolderFiltering,
  folderFilterMode,
  onFolderFilterModeChange,
  availableFolders,
  includeFolders,
  excludeFolders,
  isLoadingFolders,
  onAddFolder,
  enableAssetSelection,
  availableAssets,
  selectedAssets,
  onAddAsset,
  onClearAll,
  totalFilters,
}) => {
  const isAssetMode = selectedKey === ASSET_KEY;
  const fieldOptions = showActivityOption
    ? DATE_FIELD_OPTIONS
    : DATE_FIELD_OPTIONS.filter((opt) => opt.value !== 'lastActivity');

  return (
    <Stack spacing={2}>
      {/* Date Filter Row */}
      {dateFilter && onDateFilterChange && (
        <Stack direction="row" spacing={2} alignItems="center">
          <Schedule sx={{ color: colors.neutral[500], fontSize: 20 }} />
          <Typography variant="body2" fontWeight={500} sx={{ minWidth: 80 }}>
            Date Range:
          </Typography>
          <Autocomplete
            sx={{ minWidth: 160 }}
            size="small"
            value={fieldOptions.find((f) => f.value === dateFilter.field) || fieldOptions[0]}
            onChange={(_, newValue) =>
              newValue &&
              onDateFilterChange({ ...dateFilter, field: newValue.value as DateFieldOption })
            }
            options={fieldOptions}
            getOptionLabel={(option) => option.label}
            disableClearable
            renderInput={(params) => <TextField {...params} label="Date Field" variant="outlined" />}
          />
          <Autocomplete
            sx={{ minWidth: 160 }}
            size="small"
            value={DATE_RANGE_OPTIONS.find((r) => r.value === dateFilter.range) || DATE_RANGE_OPTIONS[0]}
            onChange={(_, newValue) =>
              newValue &&
              onDateFilterChange({ ...dateFilter, range: newValue.value as DateRangeOption })
            }
            options={DATE_RANGE_OPTIONS}
            getOptionLabel={(option) => option.label}
            disableClearable
            renderInput={(params) => <TextField {...params} label="Time Range" variant="outlined" />}
          />
        </Stack>
      )}

      {/* Error Filter Row */}
      {enableErrorFiltering && errorFilter !== undefined && onErrorFilterChange && (
        <Stack direction="row" spacing={2} alignItems="center">
          <ErrorIcon sx={{ color: colors.neutral[500], fontSize: 20 }} />
          <Typography variant="body2" fontWeight={500} sx={{ minWidth: 80 }}>
            Errors:
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={errorFilter}
            exclusive
            onChange={(_, newValue) => newValue && onErrorFilterChange(newValue)}
          >
            <ToggleButton value="all" sx={{ px: 2 }}>
              All
            </ToggleButton>
            <ToggleButton value="with_errors" sx={{ px: 2 }}>
              <ErrorIcon sx={{ fontSize: 16, mr: 0.5, color: 'error.main' }} />
              With Errors{errorCount !== undefined && ` (${errorCount})`}
            </ToggleButton>
            <ToggleButton value="without_errors" sx={{ px: 2 }}>
              <CheckCircle sx={{ fontSize: 16, mr: 0.5, color: 'success.main' }} />
              No Errors
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}

      {/* Activity Filter Row */}
      {enableActivityFiltering && activityFilter !== undefined && onActivityFilterChange && (
        <Stack direction="row" spacing={2} alignItems="center">
          <ActivityIcon sx={{ color: colors.neutral[500], fontSize: 20 }} />
          <Typography variant="body2" fontWeight={500} sx={{ minWidth: 80 }}>
            Activity:
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={activityFilter}
            exclusive
            onChange={(_, newValue) => newValue && onActivityFilterChange(newValue)}
          >
            <ToggleButton value="all" sx={{ px: 2 }}>
              All
            </ToggleButton>
            <ToggleButton value="with_activity" sx={{ px: 2 }}>
              <ActivityIcon sx={{ fontSize: 16, mr: 0.5, color: 'info.main' }} />
              With Activity
            </ToggleButton>
            <ToggleButton value="without_activity" sx={{ px: 2 }}>
              <NoActivityIcon sx={{ fontSize: 16, mr: 0.5, color: 'warning.main' }} />
              No Activity
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}

      {/* Folder Filter Section */}
      {enableFolderFiltering && availableFolders.length > 0 && (
        <>
          <Stack direction="row" spacing={2} alignItems="center">
            <FolderIcon sx={{ color: colors.neutral[500], fontSize: 20 }} />
            <Typography variant="body2" fontWeight={500} sx={{ minWidth: 80 }}>
              Folders:
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={folderFilterMode}
              exclusive
              onChange={(_, newMode) => newMode && onFolderFilterModeChange(newMode)}
            >
              <ToggleButton value="include" sx={{ px: 2 }}>
                <Add sx={{ fontSize: 16, mr: 0.5, color: 'primary.main' }} />
                In Folders
              </ToggleButton>
              <ToggleButton value="exclude" sx={{ px: 2 }}>
                <Remove sx={{ fontSize: 16, mr: 0.5, color: 'error.main' }} />
                Not In Folders
              </ToggleButton>
            </ToggleButtonGroup>
            <Autocomplete
              sx={{ minWidth: 250 }}
              size="small"
              value={null}
              onChange={(_, newValue) => newValue && onAddFolder(newValue)}
              options={availableFolders}
              getOptionLabel={(option) => option.name}
              loading={isLoadingFolders}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Folder"
                  placeholder="Search folders..."
                  variant="outlined"
                />
              )}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props as any;
                const isIncluded = includeFolders.some((f) => f.id === option.id);
                const isExcluded = excludeFolders.some((f) => f.id === option.id);
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                      <FolderIcon sx={{ fontSize: 18, color: colors.primary.main }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {option.name}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {option.assetCount !== undefined && (
                          <CountChip count={option.assetCount} label="assets" />
                        )}
                        {isIncluded && <CountChip count={0} label="included" color="primary" />}
                        {isExcluded && <CountChip count={0} label="excluded" color="error" />}
                      </Stack>
                    </Stack>
                  </Box>
                );
              }}
            />
          </Stack>
        </>
      )}

      {/* Tag Filter Mode Toggle */}
      {enableTagFiltering && !isAssetMode && (
        <Stack direction="row" spacing={2} alignItems="center">
          <LocalOffer sx={{ color: colors.neutral[500], fontSize: 20 }} />
          <Typography variant="body2" fontWeight={500} sx={{ minWidth: 80 }}>
            Tag Mode:
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={filterMode}
            exclusive
            onChange={(_, newMode) => newMode && onFilterModeChange(newMode)}
          >
            <ToggleButton value="include" sx={{ px: 2 }}>
              <Add sx={{ fontSize: 16, mr: 0.5, color: 'success.main' }} />
              Include
            </ToggleButton>
            <ToggleButton value="exclude" sx={{ px: 2 }}>
              <Remove sx={{ fontSize: 16, mr: 0.5, color: 'error.main' }} />
              Exclude
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}

      {/* Tag/Asset Selection Row */}
      {(enableTagFiltering || enableAssetSelection) && (
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterList sx={{ color: colors.neutral[500], fontSize: 20 }} />

          <Autocomplete
            sx={{ minWidth: 200 }}
            size="small"
            value={selectedKey}
            onChange={(_, newValue) => onSelectedKeyChange(newValue)}
            options={allKeys}
            getOptionLabel={(option) => {
              if (option === ASSET_KEY) return 'Asset';
              return option;
            }}
            disabled={isLoading}
            renderInput={(params) => (
              <TextField {...params} label="Filter Type" placeholder="Select..." variant="outlined" />
            )}
            renderOption={(props, option) => {
              const { key, ...otherProps } = props as any;
              if (option === ASSET_KEY) {
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                      <DashboardIcon sx={{ fontSize: 16, color: colors.primary.main }} />
                      <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                        Asset
                      </Typography>
                      <CountChip count={availableAssets.length} label="available" color="primary" />
                    </Stack>
                  </Box>
                );
              }
              return (
                <Box component="li" key={key} {...otherProps}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {option}
                    </Typography>
                    <CountChip count={groupedTags[option]?.length || 0} label="values" />
                  </Stack>
                </Box>
              );
            }}
          />

          <Typography variant="body2" sx={{ color: colors.neutral[500], fontWeight: 600 }}>
            =
          </Typography>

          {isAssetMode ? (
            <Autocomplete
              sx={{ minWidth: 350 }}
              size="small"
              value={null}
              onChange={(_, newValue) => newValue && onAddAsset(newValue)}
              options={availableAssets}
              getOptionLabel={(option) => option.name}
              disabled={isLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Asset"
                  placeholder="Search assets..."
                  variant="outlined"
                />
              )}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props as any;
                const config = getAssetConfig(option.type);
                const Icon = config.icon;
                const isSelected = selectedAssets.some((a) => a.id === option.id);
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                      <Icon sx={{ fontSize: 18, color: config.color }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          {option.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'capitalize' }}
                        >
                          {option.type}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        {option.fieldCount !== undefined && (
                          <CountChip count={option.fieldCount} label="fields" />
                        )}
                        {isSelected && <CountChip count={0} label="selected" color="primary" />}
                      </Stack>
                    </Stack>
                  </Box>
                );
              }}
            />
          ) : (
            <Autocomplete
              sx={{ minWidth: 250 }}
              size="small"
              value={null}
              onChange={(_, newValue) => newValue && onAddTag(newValue)}
              options={selectedKey && selectedKey !== ASSET_KEY ? groupedTags[selectedKey] || [] : []}
              getOptionLabel={(option) => option.value}
              disabled={!selectedKey || selectedKey === ASSET_KEY || isLoading}
              noOptionsText={selectedKey ? 'No values available' : 'Select a filter type first'}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tag Value"
                  placeholder="Select value..."
                  variant="outlined"
                />
              )}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props as any;
                const isIncluded = includeTags.some(
                  (t) => t.key === option.key && t.value === option.value
                );
                const isExcluded = excludeTags.some(
                  (t) => t.key === option.key && t.value === option.value
                );
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {option.value}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        <CountChip count={option.count} label="assets" />
                        {isIncluded && <CountChip count={0} label="included" color="success" />}
                        {isExcluded && <CountChip count={0} label="excluded" color="error" />}
                      </Stack>
                    </Stack>
                  </Box>
                );
              }}
            />
          )}

          {totalFilters > 0 && (
            <Tooltip title="Clear all filters">
              <IconButton size="small" onClick={onClearAll} sx={{ ml: 1 }}>
                <Clear />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )}
    </Stack>
  );
};

// ============================================================================
// Active Filters Display Component
// ============================================================================

interface ActiveFiltersDisplayProps {
  selectedAssets: AssetFilter[];
  includeTags: TagFilter[];
  excludeTags: TagFilter[];
  includeFolders: FolderFilter[];
  excludeFolders: FolderFilter[];
  onRemoveAsset: (index: number) => void;
  onRemoveIncludeTag: (index: number) => void;
  onRemoveExcludeTag: (index: number) => void;
  onRemoveIncludeFolder: (index: number) => void;
  onRemoveExcludeFolder: (index: number) => void;
}

const ActiveFiltersDisplay: React.FC<ActiveFiltersDisplayProps> = ({
  selectedAssets,
  includeTags,
  excludeTags,
  includeFolders,
  excludeFolders,
  onRemoveAsset,
  onRemoveIncludeTag,
  onRemoveExcludeTag,
  onRemoveIncludeFolder,
  onRemoveExcludeFolder,
}) => {
  const totalFilters = selectedAssets.length + includeTags.length + excludeTags.length + includeFolders.length + excludeFolders.length;
  if (totalFilters === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      {selectedAssets.length > 0 && (
        <FilterSection
          title="Assets (fields from these assets):"
          icon={<DashboardIcon sx={{ fontSize: 14 }} />}
          color="primary.main"
        >
          {selectedAssets.map((asset, idx) => (
            <AssetChip
              key={`asset-full-${idx}`}
              asset={asset}
              onDelete={() => onRemoveAsset(idx)}
              showFullName
            />
          ))}
        </FilterSection>
      )}

      {includeFolders.length > 0 && (
        <FilterSection
          title="In Folders (OR):"
          icon={<FolderIcon sx={{ fontSize: 14 }} />}
          color="primary.main"
        >
          {includeFolders.map((folder, idx) => (
            <Chip
              key={`include-folder-${idx}`}
              icon={<FolderIcon sx={{ fontSize: 14 }} />}
              label={folder.name}
              size="small"
              color="primary"
              onDelete={() => onRemoveIncludeFolder(idx)}
              sx={{ mb: 0.5 }}
            />
          ))}
        </FilterSection>
      )}

      {excludeFolders.length > 0 && (
        <FilterSection
          title="Not In Folders (AND NOT):"
          icon={<FolderIcon sx={{ fontSize: 14 }} />}
          color="error.main"
        >
          {excludeFolders.map((folder, idx) => (
            <Chip
              key={`exclude-folder-${idx}`}
              icon={<FolderIcon sx={{ fontSize: 14 }} />}
              label={folder.name}
              size="small"
              color="error"
              onDelete={() => onRemoveExcludeFolder(idx)}
              sx={{ mb: 0.5 }}
            />
          ))}
        </FilterSection>
      )}

      {includeTags.length > 0 && (
        <FilterSection
          title="Include Tags (OR):"
          icon={<Add sx={{ fontSize: 14 }} />}
          color="success.main"
        >
          {includeTags.map((tag, idx) => (
            <Chip
              key={`include-${idx}`}
              label={`${tag.key}=${tag.value}`}
              size="small"
              color="success"
              onDelete={() => onRemoveIncludeTag(idx)}
              sx={{ mb: 0.5 }}
            />
          ))}
        </FilterSection>
      )}

      {excludeTags.length > 0 && (
        <FilterSection
          title="Exclude Tags (AND NOT):"
          icon={<Remove sx={{ fontSize: 14 }} />}
          color="error.main"
        >
          {excludeTags.map((tag, idx) => (
            <Chip
              key={`exclude-${idx}`}
              label={`${tag.key}=${tag.value}`}
              size="small"
              color="error"
              onDelete={() => onRemoveExcludeTag(idx)}
              sx={{ mb: 0.5 }}
            />
          ))}
        </FilterSection>
      )}
    </Box>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const FilterBar: React.FC<FilterBarProps> = ({
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
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterMode, setFilterMode] = useState<'include' | 'exclude'>('include');
  const [folderFilterMode, setFolderFilterMode] = useState<'include' | 'exclude'>('include');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const groupedTags = useMemo(() => {
    return availableTags.reduce(
      (acc, tag) => {
        if (!acc[tag.key]) acc[tag.key] = [];
        acc[tag.key].push(tag);
        return acc;
      },
      {} as Record<string, TagOption[]>
    );
  }, [availableTags]);

  const allKeys = useMemo(() => {
    const tagKeys = Object.keys(groupedTags).sort();
    if (enableAssetSelection && availableAssets.length > 0 && onSelectedAssetsChange) {
      return [ASSET_KEY, ...tagKeys];
    }
    return tagKeys;
  }, [groupedTags, enableAssetSelection, availableAssets.length, onSelectedAssetsChange]);

  // Calculate total active filters
  const totalFilters = useMemo(() => {
    let count = 0;
    if (dateFilter && dateFilter.range !== 'all') count++;
    if (errorFilter && errorFilter !== 'all') count++;
    if (activityFilter && activityFilter !== 'all') count++;
    count += includeTags.length;
    count += excludeTags.length;
    count += includeFolders.length;
    count += excludeFolders.length;
    count += selectedAssets.length;
    return count;
  }, [dateFilter, errorFilter, activityFilter, includeTags, excludeTags, includeFolders, excludeFolders, selectedAssets]);

  const handleAddTag = useCallback(
    (tag: TagOption) => {
      const newTag = { key: tag.key, value: tag.value };
      const targetList = filterMode === 'include' ? includeTags : excludeTags;
      const onChange = filterMode === 'include' ? onIncludeTagsChange : onExcludeTagsChange;
      if (onChange && !targetList.some((t) => t.key === newTag.key && t.value === newTag.value)) {
        onChange([...targetList, newTag]);
      }
    },
    [filterMode, includeTags, excludeTags, onIncludeTagsChange, onExcludeTagsChange]
  );

  const handleAddAsset = useCallback(
    (asset: AssetOption) => {
      if (!onSelectedAssetsChange) return;
      if (!selectedAssets.some((a) => a.id === asset.id)) {
        onSelectedAssetsChange([
          ...selectedAssets,
          { id: asset.id, name: asset.name, type: asset.type },
        ]);
      }
    },
    [onSelectedAssetsChange, selectedAssets]
  );

  const handleRemoveIncludeTag = useCallback(
    (index: number) => {
      onIncludeTagsChange?.(includeTags.filter((_, i) => i !== index));
    },
    [includeTags, onIncludeTagsChange]
  );

  const handleRemoveExcludeTag = useCallback(
    (index: number) => {
      onExcludeTagsChange?.(excludeTags.filter((_, i) => i !== index));
    },
    [excludeTags, onExcludeTagsChange]
  );

  const handleRemoveAsset = useCallback(
    (index: number) => {
      onSelectedAssetsChange?.(selectedAssets.filter((_, i) => i !== index));
    },
    [onSelectedAssetsChange, selectedAssets]
  );

  const handleAddFolder = useCallback(
    (folder: FolderOption) => {
      const newFolder = { id: folder.id, name: folder.name };
      const targetList = folderFilterMode === 'include' ? includeFolders : excludeFolders;
      const onChange = folderFilterMode === 'include' ? onIncludeFoldersChange : onExcludeFoldersChange;
      if (onChange && !targetList.some((f) => f.id === newFolder.id)) {
        onChange([...targetList, newFolder]);
      }
    },
    [folderFilterMode, includeFolders, excludeFolders, onIncludeFoldersChange, onExcludeFoldersChange]
  );

  const handleRemoveIncludeFolder = useCallback(
    (index: number) => {
      onIncludeFoldersChange?.(includeFolders.filter((_, i) => i !== index));
    },
    [includeFolders, onIncludeFoldersChange]
  );

  const handleRemoveExcludeFolder = useCallback(
    (index: number) => {
      onExcludeFoldersChange?.(excludeFolders.filter((_, i) => i !== index));
    },
    [excludeFolders, onExcludeFoldersChange]
  );

  const handleClearDateFilter = useCallback(() => {
    onDateFilterChange?.(DEFAULT_DATE_FILTER);
  }, [onDateFilterChange]);

  const handleClearErrorFilter = useCallback(() => {
    onErrorFilterChange?.(DEFAULT_ERROR_FILTER);
  }, [onErrorFilterChange]);

  const handleClearActivityFilter = useCallback(() => {
    onActivityFilterChange?.(DEFAULT_ACTIVITY_FILTER);
  }, [onActivityFilterChange]);

  const handleClearAll = useCallback(() => {
    onDateFilterChange?.(DEFAULT_DATE_FILTER);
    onErrorFilterChange?.(DEFAULT_ERROR_FILTER);
    onActivityFilterChange?.(DEFAULT_ACTIVITY_FILTER);
    onIncludeTagsChange?.([]);
    onExcludeTagsChange?.([]);
    onIncludeFoldersChange?.([]);
    onExcludeFoldersChange?.([]);
    onSelectedAssetsChange?.([]);
  }, [
    onDateFilterChange,
    onErrorFilterChange,
    onActivityFilterChange,
    onIncludeTagsChange,
    onExcludeTagsChange,
    onIncludeFoldersChange,
    onExcludeFoldersChange,
    onSelectedAssetsChange,
  ]);

  const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), []);

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
        totalFilters={totalFilters}
        dateFilter={dateFilter}
        errorFilter={errorFilter}
        activityFilter={activityFilter}
        selectedAssets={selectedAssets}
        includeTags={includeTags}
        excludeTags={excludeTags}
        includeFolders={includeFolders}
        excludeFolders={excludeFolders}
        isExpanded={isExpanded}
        onToggleExpand={toggleExpanded}
        onClearAll={handleClearAll}
        onClearDateFilter={dateFilter ? handleClearDateFilter : undefined}
        onClearErrorFilter={errorFilter !== undefined ? handleClearErrorFilter : undefined}
        onClearActivityFilter={activityFilter !== undefined ? handleClearActivityFilter : undefined}
        onRemoveAsset={handleRemoveAsset}
        onRemoveIncludeTag={handleRemoveIncludeTag}
        onRemoveExcludeTag={handleRemoveExcludeTag}
        onRemoveIncludeFolder={handleRemoveIncludeFolder}
        onRemoveExcludeFolder={handleRemoveExcludeFolder}
        errorCount={errorCount}
      />

      <Collapse in={isExpanded}>
        <Box sx={{ p: spacing.md / 8, bgcolor: colors.neutral[50] }}>
          <FilterControls
            dateFilter={dateFilter}
            onDateFilterChange={onDateFilterChange}
            showActivityOption={showActivityOption}
            enableTagFiltering={enableTagFiltering}
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            selectedKey={selectedKey}
            onSelectedKeyChange={setSelectedKey}
            allKeys={allKeys}
            groupedTags={groupedTags}
            includeTags={includeTags}
            excludeTags={excludeTags}
            isLoading={isLoadingTags}
            onAddTag={handleAddTag}
            enableErrorFiltering={enableErrorFiltering}
            errorFilter={errorFilter}
            onErrorFilterChange={onErrorFilterChange}
            errorCount={errorCount}
            enableActivityFiltering={enableActivityFiltering}
            activityFilter={activityFilter}
            onActivityFilterChange={onActivityFilterChange}
            enableFolderFiltering={enableFolderFiltering}
            folderFilterMode={folderFilterMode}
            onFolderFilterModeChange={setFolderFilterMode}
            availableFolders={availableFolders}
            includeFolders={includeFolders}
            excludeFolders={excludeFolders}
            isLoadingFolders={isLoadingFolders}
            onAddFolder={handleAddFolder}
            enableAssetSelection={enableAssetSelection}
            availableAssets={availableAssets}
            selectedAssets={selectedAssets}
            onAddAsset={handleAddAsset}
            onClearAll={handleClearAll}
            totalFilters={totalFilters}
          />

          <ActiveFiltersDisplay
            selectedAssets={selectedAssets}
            includeTags={includeTags}
            excludeTags={excludeTags}
            includeFolders={includeFolders}
            excludeFolders={excludeFolders}
            onRemoveAsset={handleRemoveAsset}
            onRemoveIncludeTag={handleRemoveIncludeTag}
            onRemoveExcludeTag={handleRemoveExcludeTag}
            onRemoveIncludeFolder={handleRemoveIncludeFolder}
            onRemoveExcludeFolder={handleRemoveExcludeFolder}
          />

          {!isLoadingTags && (availableTags.length > 0 || availableAssets.length > 0 || availableFolders.length > 0) && (
            <Typography
              variant="caption"
              sx={{ mt: spacing.sm / 8, display: 'block', color: colors.neutral[600] }}
            >
              {Object.keys(groupedTags).length > 0 &&
                `${Object.keys(groupedTags).length} tag keys | ${availableTags.length} tag values`}
              {availableFolders.length > 0 && ` | ${availableFolders.length} folders`}
              {availableAssets.length > 0 && ` | ${availableAssets.length} assets`}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
