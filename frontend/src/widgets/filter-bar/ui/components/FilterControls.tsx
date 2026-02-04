import {
  FilterList,
  Clear,
  LocalOffer,
  Add,
  Remove,
  Schedule,
  Error as ErrorIcon,
  CheckCircle,
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  Timeline as ActivityIcon,
  Block as NoActivityIcon,
} from '@mui/icons-material';
import {
  Box,
  Autocomplete,
  TextField,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

import { ASSET_KEY, getAssetConfig } from './constants';
import { CountChip } from './shared';
import { DATE_FIELD_OPTIONS, DATE_RANGE_OPTIONS } from '../../lib/constants';

import type {
  DateFilterState,
  DateFieldOption,
  DateRangeOption,
  ErrorFilterState,
  ActivityFilterState,
  TagOption,
  TagFilter,
  FolderOption,
  FolderFilter,
  AssetOption,
  AssetFilter,
} from '../../lib/types';

// ============================================================================
// Types
// ============================================================================

export interface FilterControlsProps {
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

// ============================================================================
// Sub-Components
// ============================================================================

interface DateFilterRowProps {
  dateFilter: DateFilterState;
  onDateFilterChange: (filter: DateFilterState) => void;
  showActivityOption?: boolean;
}

const DateFilterRow: React.FC<DateFilterRowProps> = ({
  dateFilter,
  onDateFilterChange,
  showActivityOption,
}) => {
  const fieldOptions = showActivityOption
    ? DATE_FIELD_OPTIONS
    : DATE_FIELD_OPTIONS.filter((opt) => opt.value !== 'lastActivity');

  return (
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
          newValue && onDateFilterChange({ ...dateFilter, field: newValue.value as DateFieldOption })
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
          newValue && onDateFilterChange({ ...dateFilter, range: newValue.value as DateRangeOption })
        }
        options={DATE_RANGE_OPTIONS}
        getOptionLabel={(option) => option.label}
        disableClearable
        renderInput={(params) => <TextField {...params} label="Time Range" variant="outlined" />}
      />
    </Stack>
  );
};

interface ToggleFilterRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; icon?: React.ReactNode; color?: string }>;
}

const ToggleFilterRow: React.FC<ToggleFilterRowProps> = ({
  icon,
  label,
  value,
  onChange,
  options,
}) => (
  <Stack direction="row" spacing={2} alignItems="center">
    {icon}
    <Typography variant="body2" fontWeight={500} sx={{ minWidth: 80 }}>
      {label}:
    </Typography>
    <ToggleButtonGroup
      size="small"
      value={value}
      exclusive
      onChange={(_, newValue) => newValue && onChange(newValue)}
    >
      {options.map((opt) => (
        <ToggleButton key={opt.value} value={opt.value} sx={{ px: 2 }}>
          {opt.icon}
          {opt.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  </Stack>
);

interface FolderFilterRowProps {
  folderFilterMode: 'include' | 'exclude';
  onFolderFilterModeChange: (mode: 'include' | 'exclude') => void;
  availableFolders: FolderOption[];
  includeFolders: FolderFilter[];
  excludeFolders: FolderFilter[];
  isLoadingFolders: boolean;
  onAddFolder: (folder: FolderOption) => void;
}

const FolderFilterRow: React.FC<FolderFilterRowProps> = ({
  folderFilterMode,
  onFolderFilterModeChange,
  availableFolders,
  includeFolders,
  excludeFolders,
  isLoadingFolders,
  onAddFolder,
}) => (
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
);

interface TagAssetSelectionRowProps {
  enableTagFiltering: boolean;
  enableAssetSelection: boolean;
  selectedKey: string | null;
  onSelectedKeyChange: (key: string | null) => void;
  allKeys: string[];
  groupedTags: Record<string, TagOption[]>;
  availableAssets: AssetOption[];
  selectedAssets: AssetFilter[];
  includeTags: TagFilter[];
  excludeTags: TagFilter[];
  isLoading: boolean;
  onAddTag: (tag: TagOption) => void;
  onAddAsset: (asset: AssetOption) => void;
  onClearAll: () => void;
  totalFilters: number;
}

const TagAssetSelectionRow: React.FC<TagAssetSelectionRowProps> = ({
  selectedKey,
  onSelectedKeyChange,
  allKeys,
  groupedTags,
  availableAssets,
  selectedAssets,
  includeTags,
  excludeTags,
  isLoading,
  onAddTag,
  onAddAsset,
  onClearAll,
  totalFilters,
}) => {
  const isAssetMode = selectedKey === ASSET_KEY;

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <FilterList sx={{ color: colors.neutral[500], fontSize: 20 }} />

      <Autocomplete
        sx={{ minWidth: 200 }}
        size="small"
        value={selectedKey}
        onChange={(_, newValue) => onSelectedKeyChange(newValue)}
        options={allKeys}
        getOptionLabel={(option) => (option === ASSET_KEY ? 'Asset' : option)}
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
        <AssetAutocomplete
          availableAssets={availableAssets}
          selectedAssets={selectedAssets}
          isLoading={isLoading}
          onAddAsset={onAddAsset}
        />
      ) : (
        <TagValueAutocomplete
          selectedKey={selectedKey}
          groupedTags={groupedTags}
          includeTags={includeTags}
          excludeTags={excludeTags}
          isLoading={isLoading}
          onAddTag={onAddTag}
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
  );
};

interface AssetAutocompleteProps {
  availableAssets: AssetOption[];
  selectedAssets: AssetFilter[];
  isLoading: boolean;
  onAddAsset: (asset: AssetOption) => void;
}

const AssetAutocomplete: React.FC<AssetAutocompleteProps> = ({
  availableAssets,
  selectedAssets,
  isLoading,
  onAddAsset,
}) => (
  <Autocomplete
    sx={{ minWidth: 350 }}
    size="small"
    value={null}
    onChange={(_, newValue) => newValue && onAddAsset(newValue)}
    options={availableAssets}
    getOptionLabel={(option) => option.name}
    disabled={isLoading}
    renderInput={(params) => (
      <TextField {...params} label="Select Asset" placeholder="Search assets..." variant="outlined" />
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
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                {option.type}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5}>
              {option.fieldCount !== undefined && <CountChip count={option.fieldCount} label="fields" />}
              {isSelected && <CountChip count={0} label="selected" color="primary" />}
            </Stack>
          </Stack>
        </Box>
      );
    }}
  />
);

interface TagValueAutocompleteProps {
  selectedKey: string | null;
  groupedTags: Record<string, TagOption[]>;
  includeTags: TagFilter[];
  excludeTags: TagFilter[];
  isLoading: boolean;
  onAddTag: (tag: TagOption) => void;
}

const TagValueAutocomplete: React.FC<TagValueAutocompleteProps> = ({
  selectedKey,
  groupedTags,
  includeTags,
  excludeTags,
  isLoading,
  onAddTag,
}) => (
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
      <TextField {...params} label="Tag Value" placeholder="Select value..." variant="outlined" />
    )}
    renderOption={(props, option) => {
      const { key, ...otherProps } = props as any;
      const isIncluded = includeTags.some((t) => t.key === option.key && t.value === option.value);
      const isExcluded = excludeTags.some((t) => t.key === option.key && t.value === option.value);
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
);

// ============================================================================
// Main Component
// ============================================================================

export const FilterControls: React.FC<FilterControlsProps> = ({
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

  return (
    <Stack spacing={2}>
      {/* Date Filter Row */}
      {dateFilter && onDateFilterChange && (
        <DateFilterRow
          dateFilter={dateFilter}
          onDateFilterChange={onDateFilterChange}
          showActivityOption={showActivityOption}
        />
      )}

      {/* Error Filter Row */}
      {enableErrorFiltering && errorFilter !== undefined && onErrorFilterChange && (
        <ToggleFilterRow
          icon={<ErrorIcon sx={{ color: colors.neutral[500], fontSize: 20 }} />}
          label="Errors"
          value={errorFilter}
          onChange={(v) => onErrorFilterChange(v as ErrorFilterState)}
          options={[
            { value: 'all', label: 'All' },
            {
              value: 'with_errors',
              label: `With Errors${errorCount !== undefined ? ` (${errorCount})` : ''}`,
              icon: <ErrorIcon sx={{ fontSize: 16, mr: 0.5, color: 'error.main' }} />,
            },
            {
              value: 'without_errors',
              label: 'No Errors',
              icon: <CheckCircle sx={{ fontSize: 16, mr: 0.5, color: 'success.main' }} />,
            },
          ]}
        />
      )}

      {/* Activity Filter Row */}
      {enableActivityFiltering && activityFilter !== undefined && onActivityFilterChange && (
        <ToggleFilterRow
          icon={<ActivityIcon sx={{ color: colors.neutral[500], fontSize: 20 }} />}
          label="Activity"
          value={activityFilter}
          onChange={(v) => onActivityFilterChange(v as ActivityFilterState)}
          options={[
            { value: 'all', label: 'All' },
            {
              value: 'with_activity',
              label: 'With Activity',
              icon: <ActivityIcon sx={{ fontSize: 16, mr: 0.5, color: 'info.main' }} />,
            },
            {
              value: 'without_activity',
              label: 'No Activity',
              icon: <NoActivityIcon sx={{ fontSize: 16, mr: 0.5, color: 'warning.main' }} />,
            },
          ]}
        />
      )}

      {/* Folder Filter Section */}
      {enableFolderFiltering && availableFolders.length > 0 && (
        <FolderFilterRow
          folderFilterMode={folderFilterMode}
          onFolderFilterModeChange={onFolderFilterModeChange}
          availableFolders={availableFolders}
          includeFolders={includeFolders}
          excludeFolders={excludeFolders}
          isLoadingFolders={isLoadingFolders}
          onAddFolder={onAddFolder}
        />
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
        <TagAssetSelectionRow
          enableTagFiltering={enableTagFiltering}
          enableAssetSelection={enableAssetSelection}
          selectedKey={selectedKey}
          onSelectedKeyChange={onSelectedKeyChange}
          allKeys={allKeys}
          groupedTags={groupedTags}
          availableAssets={availableAssets}
          selectedAssets={selectedAssets}
          includeTags={includeTags}
          excludeTags={excludeTags}
          isLoading={isLoading}
          onAddTag={onAddTag}
          onAddAsset={onAddAsset}
          onClearAll={onClearAll}
          totalFilters={totalFilters}
        />
      )}
    </Stack>
  );
};
