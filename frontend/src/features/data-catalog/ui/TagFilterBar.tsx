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
import React, { useState, useMemo } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

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

const ASSET_KEY = '__ASSET__';

const assetTypeIcons: Record<string, React.ElementType> = {
  dashboard: DashboardIcon,
  analysis: AnalysisIcon,
  dataset: DatasetIcon,
};

const assetTypeColors: Record<string, string> = {
  dashboard: '#1976d2',
  analysis: '#9c27b0',
  dataset: '#2e7d32',
};

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

  // Group tags by key for the UI
  const groupedTags = useMemo(() => {
    return availableTags.reduce((acc, tag) => {
      if (!acc[tag.key]) {
        acc[tag.key] = [];
      }
      acc[tag.key].push(tag);
      return acc;
    }, {} as Record<string, TagOption[]>);
  }, [availableTags]);

  // Keys include tag keys plus "Asset" option
  const allKeys = useMemo(() => {
    const tagKeys = Object.keys(groupedTags).sort();
    if (availableAssets.length > 0 && onSelectedAssetsChange) {
      return [ASSET_KEY, ...tagKeys];
    }
    return tagKeys;
  }, [groupedTags, availableAssets.length, onSelectedAssetsChange]);

  const isAssetMode = selectedKey === ASSET_KEY;

  const handleAddTag = (tag: TagOption) => {
    const newTag = { key: tag.key, value: tag.value };

    if (filterMode === 'include') {
      if (!includeTags.some(t => t.key === newTag.key && t.value === newTag.value)) {
        onIncludeTagsChange([...includeTags, newTag]);
      }
    } else {
      if (!excludeTags.some(t => t.key === newTag.key && t.value === newTag.value)) {
        onExcludeTagsChange([...excludeTags, newTag]);
      }
    }
  };

  const handleAddAsset = (asset: AssetOption) => {
    if (!onSelectedAssetsChange) return;
    const newAsset: AssetFilter = { id: asset.id, name: asset.name, type: asset.type };
    if (!selectedAssets.some(a => a.id === newAsset.id)) {
      onSelectedAssetsChange([...selectedAssets, newAsset]);
    }
  };

  const handleRemoveIncludeTag = (index: number) => {
    onIncludeTagsChange(includeTags.filter((_, i) => i !== index));
  };

  const handleRemoveExcludeTag = (index: number) => {
    onExcludeTagsChange(excludeTags.filter((_, i) => i !== index));
  };

  const handleRemoveAsset = (index: number) => {
    if (!onSelectedAssetsChange) return;
    onSelectedAssetsChange(selectedAssets.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    onIncludeTagsChange([]);
    onExcludeTagsChange([]);
    if (onSelectedAssetsChange) {
      onSelectedAssetsChange([]);
    }
  };

  const totalFilters = includeTags.length + excludeTags.length + selectedAssets.length;

  const getAssetIcon = (type: string) => {
    const Icon = assetTypeIcons[type] || DatasetIcon;
    return <Icon sx={{ fontSize: 14, color: assetTypeColors[type] || colors.neutral[500] }} />;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        mb: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          bgcolor: totalFilters > 0 ? alpha(colors.primary.main, 0.08) : 'background.paper',
          borderBottom: isExpanded ? '1px solid' : 'none',
          borderColor: 'divider',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <LocalOffer
            sx={{
              color: totalFilters > 0 ? colors.primary.main : colors.neutral[500],
              fontSize: 20,
            }}
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
                handleClearAll();
              }}
            />
          )}
          {/* Show selected assets summary */}
          {selectedAssets.length > 0 && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {selectedAssets.slice(0, 2).map((asset, idx) => (
                <Chip
                  key={`asset-${idx}`}
                  icon={getAssetIcon(asset.type)}
                  label={asset.name.length > 15 ? `${asset.name.substring(0, 15)}...` : asset.name}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    bgcolor: alpha(assetTypeColors[asset.type] || colors.neutral[500], 0.1),
                    borderColor: assetTypeColors[asset.type],
                    '& .MuiChip-icon': { marginLeft: '4px' },
                  }}
                  variant="outlined"
                  onDelete={(e) => {
                    e.stopPropagation();
                    handleRemoveAsset(idx);
                  }}
                />
              ))}
              {selectedAssets.length > 2 && (
                <Typography variant="caption" color="text.secondary">
                  +{selectedAssets.length - 2} more
                </Typography>
              )}
            </Stack>
          )}
          {/* Show active tag filters summary */}
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
                  sx={{ height: 20, fontSize: '0.7rem' }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    handleRemoveIncludeTag(idx);
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
                  sx={{ height: 20, fontSize: '0.7rem' }}
                  onDelete={(e) => {
                    e.stopPropagation();
                    handleRemoveExcludeTag(idx);
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
        </Stack>
        <IconButton size="small" onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}>
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      {/* Expandable Filter Controls */}
      <Collapse in={isExpanded}>
        <Box sx={{ p: spacing.md / 8, bgcolor: colors.neutral[50] }}>
          {/* Mode Toggle - only for tags, not assets */}
          {!isAssetMode && (
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={500}>
                Tag Filter Mode:
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={filterMode}
                exclusive
                onChange={(_, newMode) => newMode && setFilterMode(newMode)}
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
                {filterMode === 'include'
                  ? 'Assets must have at least one of these tags'
                  : 'Assets must not have any of these tags'}
              </Typography>
            </Stack>
          )}

          {/* Filter Selection */}
          <Stack direction="row" spacing={2} alignItems="center">
            <FilterList sx={{ color: colors.neutral[500] }} />

            <Autocomplete
              sx={{ minWidth: 200 }}
              size="small"
              value={selectedKey}
              onChange={(_, newValue) => setSelectedKey(newValue)}
              options={allKeys}
              getOptionLabel={(option) => option === ASSET_KEY ? 'Asset' : option}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter Type"
                  placeholder="Select..."
                  variant="outlined"
                />
              )}
              disabled={isLoading}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                if (option === ASSET_KEY) {
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                        <DashboardIcon sx={{ fontSize: 16, color: colors.primary.main }} />
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>Asset</Typography>
                        <Chip
                          label={`${availableAssets.length} available`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      </Stack>
                    </Box>
                  );
                }
                const tagCount = groupedTags[option]?.length || 0;
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>{option}</Typography>
                      <Chip
                        label={`${tagCount} values`}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    </Stack>
                  </Box>
                );
              }}
            />

            <Typography variant="body2" sx={{ color: colors.neutral[500], fontWeight: 600 }}>
              =
            </Typography>

            {/* Value Autocomplete - switches between tags and assets */}
            {isAssetMode ? (
              <Autocomplete
                sx={{ minWidth: 350 }}
                size="small"
                value={null}
                onChange={(_, newValue) => {
                  if (newValue) {
                    handleAddAsset(newValue);
                  }
                }}
                options={availableAssets}
                getOptionLabel={(option) => option.name}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Asset"
                    placeholder="Search assets..."
                    variant="outlined"
                  />
                )}
                disabled={isLoading}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  const isSelected = selectedAssets.some(a => a.id === option.id);
                  const Icon = assetTypeIcons[option.type] || DatasetIcon;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                        <Icon sx={{ fontSize: 18, color: assetTypeColors[option.type] }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap>{option.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                            {option.type}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Chip
                            label={`${option.fieldCount} fields`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: colors.neutral[200],
                              color: colors.neutral[700]
                            }}
                          />
                          {isSelected && (
                            <Chip
                              label="selected"
                              size="small"
                              color="primary"
                              sx={{ height: 18, fontSize: '0.6rem' }}
                            />
                          )}
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
                onChange={(_, newValue) => {
                  if (newValue) {
                    handleAddTag(newValue);
                  }
                }}
                options={selectedKey && selectedKey !== ASSET_KEY ? groupedTags[selectedKey] || [] : []}
                getOptionLabel={(option) => option.value}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tag Value"
                    placeholder="Select value..."
                    variant="outlined"
                  />
                )}
                disabled={!selectedKey || selectedKey === ASSET_KEY || isLoading}
                noOptionsText={selectedKey ? 'No values available' : 'Select a filter type first'}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  const isAlreadyIncluded = includeTags.some(t => t.key === option.key && t.value === option.value);
                  const isAlreadyExcluded = excludeTags.some(t => t.key === option.key && t.value === option.value);
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>{option.value}</Typography>
                        <Stack direction="row" spacing={0.5}>
                          <Chip
                            label={`${option.count} assets`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: colors.neutral[200],
                              color: colors.neutral[700]
                            }}
                          />
                          {isAlreadyIncluded && (
                            <Chip label="included" size="small" color="success" sx={{ height: 18, fontSize: '0.6rem' }} />
                          )}
                          {isAlreadyExcluded && (
                            <Chip label="excluded" size="small" color="error" sx={{ height: 18, fontSize: '0.6rem' }} />
                          )}
                        </Stack>
                      </Stack>
                    </Box>
                  );
                }}
              />
            )}

            {totalFilters > 0 && (
              <Tooltip title="Clear all filters">
                <IconButton size="small" onClick={handleClearAll} sx={{ ml: 1 }}>
                  <Clear />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {/* Active Filters Display */}
          {(selectedAssets.length > 0 || includeTags.length > 0 || excludeTags.length > 0) && (
            <Box sx={{ mt: 2 }}>
              {/* Selected Assets */}
              {selectedAssets.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={600} color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <DashboardIcon sx={{ fontSize: 14 }} /> Assets (fields from these assets):
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {selectedAssets.map((asset, idx) => (
                      <Chip
                        key={`asset-full-${idx}`}
                        icon={getAssetIcon(asset.type)}
                        label={asset.name}
                        size="small"
                        sx={{
                          mb: 0.5,
                          bgcolor: alpha(assetTypeColors[asset.type] || colors.neutral[500], 0.1),
                          '& .MuiChip-icon': { marginLeft: '4px' },
                        }}
                        onDelete={() => handleRemoveAsset(idx)}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
              {/* Include Tags */}
              {includeTags.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={600} color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Add sx={{ fontSize: 14 }} /> Include Tags (OR):
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {includeTags.map((tag, idx) => (
                      <Chip
                        key={`include-${idx}`}
                        label={`${tag.key}=${tag.value}`}
                        size="small"
                        color="success"
                        onDelete={() => handleRemoveIncludeTag(idx)}
                        sx={{ mb: 0.5 }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
              {/* Exclude Tags */}
              {excludeTags.length > 0 && (
                <Box>
                  <Typography variant="caption" fontWeight={600} color="error.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Remove sx={{ fontSize: 14 }} /> Exclude Tags (AND NOT):
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {excludeTags.map((tag, idx) => (
                      <Chip
                        key={`exclude-${idx}`}
                        label={`${tag.key}=${tag.value}`}
                        size="small"
                        color="error"
                        onDelete={() => handleRemoveExcludeTag(idx)}
                        sx={{ mb: 0.5 }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          )}

          {/* Quick Stats */}
          {!isLoading && (availableTags.length > 0 || availableAssets.length > 0) && (
            <Typography
              variant="caption"
              sx={{ mt: spacing.sm / 8, display: 'block', color: colors.neutral[600] }}
            >
              {Object.keys(groupedTags).length} tag keys | {availableTags.length} tag values | {availableAssets.length} assets
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
