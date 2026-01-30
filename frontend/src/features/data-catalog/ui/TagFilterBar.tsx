import {
  FilterList,
  Clear,
  ExpandMore,
  ExpandLess,
  LocalOffer,
  Add,
  Remove,
  Dashboard as DashboardIcon,
  Analytics as AnalysisIcon,
  Storage as DatasetIcon,
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
} from '@mui/material';
import React, { useState, useMemo, useCallback } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

// ============================================================================
// Types
// ============================================================================

interface TagOption {
  key: string;
  value: string;
  count: number;
}

interface AssetOption {
  id: string;
  name: string;
  type: string;
  fieldCount: number;
}

interface AssetFilter {
  id: string;
  name: string;
  type: string;
}

interface TagFilterBarProps {
  availableTags: TagOption[];
  includeTags: Array<{ key: string; value: string }>;
  excludeTags: Array<{ key: string; value: string }>;
  onIncludeTagsChange: (tags: Array<{ key: string; value: string }>) => void;
  onExcludeTagsChange: (tags: Array<{ key: string; value: string }>) => void;
  isLoading?: boolean;
  availableAssets?: AssetOption[];
  selectedAssets?: AssetFilter[];
  onSelectedAssetsChange?: (assets: AssetFilter[]) => void;
}

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

const getAssetConfig = (type: string) => ASSET_TYPE_CONFIG[type] || { icon: DatasetIcon, color: colors.neutral[500] };

const truncateText = (text: string, maxLength: number) =>
  text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

// ============================================================================
// Sub-Components
// ============================================================================

interface CountChipProps {
  count: number;
  label: string;
  color?: 'primary' | 'success' | 'error';
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

const AssetChip: React.FC<AssetChipProps> = ({ asset, onDelete, stopPropagation = false, showFullName = false }) => {
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
// Autocomplete Option Renderers
// ============================================================================

const renderFilterTypeOption = (
  props: React.HTMLAttributes<HTMLLIElement>,
  option: string,
  groupedTags: Record<string, TagOption[]>,
  availableAssetsCount: number
) => {
  const { key, ...otherProps } = props as any;

  if (option === ASSET_KEY) {
    return (
      <Box component="li" key={key} {...otherProps}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
          <DashboardIcon sx={{ fontSize: 16, color: colors.primary.main }} />
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>Asset</Typography>
          <CountChip count={availableAssetsCount} label="available" color="primary" />
        </Stack>
      </Box>
    );
  }

  return (
    <Box component="li" key={key} {...otherProps}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
        <Typography variant="body2" sx={{ flex: 1 }}>{option}</Typography>
        <CountChip count={groupedTags[option]?.length || 0} label="values" />
      </Stack>
    </Box>
  );
};

const renderAssetOption = (
  props: React.HTMLAttributes<HTMLLIElement>,
  option: AssetOption,
  isSelected: boolean
) => {
  const { key, ...otherProps } = props as any;
  const config = getAssetConfig(option.type);
  const Icon = config.icon;

  return (
    <Box component="li" key={key} {...otherProps}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
        <Icon sx={{ fontSize: 18, color: config.color }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>{option.name}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {option.type}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <CountChip count={option.fieldCount} label="fields" />
          {isSelected && <CountChip count={0} label="selected" color="primary" />}
        </Stack>
      </Stack>
    </Box>
  );
};

const renderTagValueOption = (
  props: React.HTMLAttributes<HTMLLIElement>,
  option: TagOption,
  isIncluded: boolean,
  isExcluded: boolean
) => {
  const { key, ...otherProps } = props as any;

  return (
    <Box component="li" key={key} {...otherProps}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
        <Typography variant="body2" sx={{ flex: 1 }}>{option.value}</Typography>
        <Stack direction="row" spacing={0.5}>
          <CountChip count={option.count} label="assets" />
          {isIncluded && <CountChip count={0} label="included" color="success" />}
          {isExcluded && <CountChip count={0} label="excluded" color="error" />}
        </Stack>
      </Stack>
    </Box>
  );
};

// ============================================================================
// Header Component
// ============================================================================

interface FilterHeaderProps {
  totalFilters: number;
  selectedAssets: AssetFilter[];
  includeTags: Array<{ key: string; value: string }>;
  excludeTags: Array<{ key: string; value: string }>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClearAll: () => void;
  onRemoveAsset: (index: number) => void;
  onRemoveIncludeTag: (index: number) => void;
  onRemoveExcludeTag: (index: number) => void;
}

const FilterHeader: React.FC<FilterHeaderProps> = ({
  totalFilters,
  selectedAssets,
  includeTags,
  excludeTags,
  isExpanded,
  onToggleExpand,
  onClearAll,
  onRemoveAsset,
  onRemoveIncludeTag,
  onRemoveExcludeTag,
}) => {
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
        <LocalOffer sx={{ color: totalFilters > 0 ? colors.primary.main : colors.neutral[500], fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight={600}>Filters</Typography>

        {totalFilters > 0 && (
          <Chip
            label={`${totalFilters} active`}
            size="small"
            color="primary"
            onDelete={(e) => { e.stopPropagation(); onClearAll(); }}
          />
        )}

        {selectedAssets.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {selectedAssets.slice(0, 2).map((asset, idx) => (
              <AssetChip key={`asset-${idx}`} asset={asset} onDelete={() => onRemoveAsset(idx)} stopPropagation />
            ))}
            {selectedAssets.length > 2 && (
              <Typography variant="caption" color="text.secondary">+{selectedAssets.length - 2} more</Typography>
            )}
          </Stack>
        )}

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
                onDelete={(e) => { e.stopPropagation(); onRemoveIncludeTag(idx); }}
              />
            ))}
            {includeTags.length > 2 && (
              <Typography variant="caption" color="text.secondary">+{includeTags.length - 2} more</Typography>
            )}
          </Stack>
        )}

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
                onDelete={(e) => { e.stopPropagation(); onRemoveExcludeTag(idx); }}
              />
            ))}
            {excludeTags.length > 2 && (
              <Typography variant="caption" color="text.secondary">+{excludeTags.length - 2} more</Typography>
            )}
          </Stack>
        )}
      </Stack>

      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
        {isExpanded ? <ExpandLess /> : <ExpandMore />}
      </IconButton>
    </Box>
  );
};

// ============================================================================
// Filter Controls Component
// ============================================================================

interface FilterControlsProps {
  filterMode: 'include' | 'exclude';
  onFilterModeChange: (mode: 'include' | 'exclude') => void;
  selectedKey: string | null;
  onSelectedKeyChange: (key: string | null) => void;
  allKeys: string[];
  groupedTags: Record<string, TagOption[]>;
  availableAssets: AssetOption[];
  selectedAssets: AssetFilter[];
  includeTags: Array<{ key: string; value: string }>;
  excludeTags: Array<{ key: string; value: string }>;
  isLoading: boolean;
  onAddTag: (tag: TagOption) => void;
  onAddAsset: (asset: AssetOption) => void;
  onClearAll: () => void;
  totalFilters: number;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filterMode,
  onFilterModeChange,
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
    <>
      {!isAssetMode && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={500}>Tag Filter Mode:</Typography>
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
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
            {filterMode === 'include' ? 'Assets must have at least one of these tags' : 'Assets must not have any of these tags'}
          </Typography>
        </Stack>
      )}

      <Stack direction="row" spacing={2} alignItems="center">
        <FilterList sx={{ color: colors.neutral[500] }} />

        <Autocomplete
          sx={{ minWidth: 200 }}
          size="small"
          value={selectedKey}
          onChange={(_, newValue) => onSelectedKeyChange(newValue)}
          options={allKeys}
          getOptionLabel={(option) => option === ASSET_KEY ? 'Asset' : option}
          disabled={isLoading}
          renderInput={(params) => (
            <TextField {...params} label="Filter Type" placeholder="Select..." variant="outlined" />
          )}
          renderOption={(props, option) => renderFilterTypeOption(props, option, groupedTags, availableAssets.length)}
        />

        <Typography variant="body2" sx={{ color: colors.neutral[500], fontWeight: 600 }}>=</Typography>

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
              <TextField {...params} label="Select Asset" placeholder="Search assets..." variant="outlined" />
            )}
            renderOption={(props, option) => renderAssetOption(props, option, selectedAssets.some(a => a.id === option.id))}
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
              <TextField {...params} label="Tag Value" placeholder="Select value..." variant="outlined" />
            )}
            renderOption={(props, option) => renderTagValueOption(
              props,
              option,
              includeTags.some(t => t.key === option.key && t.value === option.value),
              excludeTags.some(t => t.key === option.key && t.value === option.value)
            )}
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
    </>
  );
};

// ============================================================================
// Active Filters Display Component
// ============================================================================

interface ActiveFiltersDisplayProps {
  selectedAssets: AssetFilter[];
  includeTags: Array<{ key: string; value: string }>;
  excludeTags: Array<{ key: string; value: string }>;
  onRemoveAsset: (index: number) => void;
  onRemoveIncludeTag: (index: number) => void;
  onRemoveExcludeTag: (index: number) => void;
}

const ActiveFiltersDisplay: React.FC<ActiveFiltersDisplayProps> = ({
  selectedAssets,
  includeTags,
  excludeTags,
  onRemoveAsset,
  onRemoveIncludeTag,
  onRemoveExcludeTag,
}) => {
  const totalFilters = selectedAssets.length + includeTags.length + excludeTags.length;
  if (totalFilters === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      {selectedAssets.length > 0 && (
        <FilterSection title="Assets (fields from these assets):" icon={<DashboardIcon sx={{ fontSize: 14 }} />} color="primary.main">
          {selectedAssets.map((asset, idx) => (
            <AssetChip key={`asset-full-${idx}`} asset={asset} onDelete={() => onRemoveAsset(idx)} showFullName />
          ))}
        </FilterSection>
      )}

      {includeTags.length > 0 && (
        <FilterSection title="Include Tags (OR):" icon={<Add sx={{ fontSize: 14 }} />} color="success.main">
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
        <FilterSection title="Exclude Tags (AND NOT):" icon={<Remove sx={{ fontSize: 14 }} />} color="error.main">
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

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  availableTags,
  includeTags,
  excludeTags,
  onIncludeTagsChange,
  onExcludeTagsChange,
  isLoading = false,
  availableAssets = [],
  selectedAssets = [],
  onSelectedAssetsChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterMode, setFilterMode] = useState<'include' | 'exclude'>('include');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const groupedTags = useMemo(() => {
    return availableTags.reduce((acc, tag) => {
      if (!acc[tag.key]) acc[tag.key] = [];
      acc[tag.key].push(tag);
      return acc;
    }, {} as Record<string, TagOption[]>);
  }, [availableTags]);

  const allKeys = useMemo(() => {
    const tagKeys = Object.keys(groupedTags).sort();
    return availableAssets.length > 0 && onSelectedAssetsChange ? [ASSET_KEY, ...tagKeys] : tagKeys;
  }, [groupedTags, availableAssets.length, onSelectedAssetsChange]);

  const totalFilters = includeTags.length + excludeTags.length + selectedAssets.length;

  const handleAddTag = useCallback((tag: TagOption) => {
    const newTag = { key: tag.key, value: tag.value };
    const targetList = filterMode === 'include' ? includeTags : excludeTags;
    const onChange = filterMode === 'include' ? onIncludeTagsChange : onExcludeTagsChange;
    if (!targetList.some(t => t.key === newTag.key && t.value === newTag.value)) {
      onChange([...targetList, newTag]);
    }
  }, [filterMode, includeTags, excludeTags, onIncludeTagsChange, onExcludeTagsChange]);

  const handleAddAsset = useCallback((asset: AssetOption) => {
    if (!onSelectedAssetsChange) return;
    if (!selectedAssets.some(a => a.id === asset.id)) {
      onSelectedAssetsChange([...selectedAssets, { id: asset.id, name: asset.name, type: asset.type }]);
    }
  }, [onSelectedAssetsChange, selectedAssets]);

  const handleRemoveIncludeTag = useCallback((index: number) => {
    onIncludeTagsChange(includeTags.filter((_, i) => i !== index));
  }, [includeTags, onIncludeTagsChange]);

  const handleRemoveExcludeTag = useCallback((index: number) => {
    onExcludeTagsChange(excludeTags.filter((_, i) => i !== index));
  }, [excludeTags, onExcludeTagsChange]);

  const handleRemoveAsset = useCallback((index: number) => {
    if (onSelectedAssetsChange) {
      onSelectedAssetsChange(selectedAssets.filter((_, i) => i !== index));
    }
  }, [onSelectedAssetsChange, selectedAssets]);

  const handleClearAll = useCallback(() => {
    onIncludeTagsChange([]);
    onExcludeTagsChange([]);
    onSelectedAssetsChange?.([]);
  }, [onIncludeTagsChange, onExcludeTagsChange, onSelectedAssetsChange]);

  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);

  return (
    <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2, overflow: 'hidden' }}>
      <FilterHeader
        totalFilters={totalFilters}
        selectedAssets={selectedAssets}
        includeTags={includeTags}
        excludeTags={excludeTags}
        isExpanded={isExpanded}
        onToggleExpand={toggleExpanded}
        onClearAll={handleClearAll}
        onRemoveAsset={handleRemoveAsset}
        onRemoveIncludeTag={handleRemoveIncludeTag}
        onRemoveExcludeTag={handleRemoveExcludeTag}
      />

      <Collapse in={isExpanded}>
        <Box sx={{ p: spacing.md / 8, bgcolor: colors.neutral[50] }}>
          <FilterControls
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            selectedKey={selectedKey}
            onSelectedKeyChange={setSelectedKey}
            allKeys={allKeys}
            groupedTags={groupedTags}
            availableAssets={availableAssets}
            selectedAssets={selectedAssets}
            includeTags={includeTags}
            excludeTags={excludeTags}
            isLoading={isLoading}
            onAddTag={handleAddTag}
            onAddAsset={handleAddAsset}
            onClearAll={handleClearAll}
            totalFilters={totalFilters}
          />

          <ActiveFiltersDisplay
            selectedAssets={selectedAssets}
            includeTags={includeTags}
            excludeTags={excludeTags}
            onRemoveAsset={handleRemoveAsset}
            onRemoveIncludeTag={handleRemoveIncludeTag}
            onRemoveExcludeTag={handleRemoveExcludeTag}
          />

          {!isLoading && (availableTags.length > 0 || availableAssets.length > 0) && (
            <Typography variant="caption" sx={{ mt: spacing.sm / 8, display: 'block', color: colors.neutral[600] }}>
              {Object.keys(groupedTags).length} tag keys | {availableTags.length} tag values | {availableAssets.length} assets
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
