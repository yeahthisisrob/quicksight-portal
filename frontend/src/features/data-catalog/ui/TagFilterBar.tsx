import {
  FilterList,
  Clear,
  ExpandMore,
  ExpandLess,
  LocalOffer,
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
} from '@mui/material';
import React, { useState, useEffect } from 'react';

import { colors, spacing } from '@/shared/design-system/theme';

interface TagFilterBarProps {
  availableTags: { key: string; value: string; count: number }[];
  onFilterChange: (filter: { key: string; value: string } | null) => void;
  isLoading?: boolean;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  availableTags,
  onFilterChange,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<{ key: string; value: string; count: number } | null>(null);

  // Group tags by key for the UI
  const groupedTags = availableTags.reduce((acc, tag) => {
    if (!acc[tag.key]) {
      acc[tag.key] = [];
    }
    acc[tag.key].push(tag);
    return acc;
  }, {} as Record<string, typeof availableTags>);

  const tagKeys = Object.keys(groupedTags).sort();

  useEffect(() => {
    // Notify parent of filter changes
    if (onFilterChange) {
      if (selectedTag) {
        onFilterChange({ key: selectedTag.key, value: selectedTag.value });
      } else {
        onFilterChange(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag]);

  const handleClearFilter = () => {
    setSelectedKey(null);
    setSelectedTag(null);
  };

  const activeFilter = selectedTag;

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
          bgcolor: activeFilter ? alpha(colors.primary.main, 0.08) : 'background.paper',
          borderBottom: isExpanded ? '1px solid' : 'none',
          borderColor: 'divider',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <LocalOffer
            sx={{
              color: activeFilter ? colors.primary.main : colors.neutral[500],
              fontSize: 20,
            }}
          />
          <Typography variant="subtitle2" fontWeight={600}>
            Tag Filter
          </Typography>
          {activeFilter && (
            <Chip
              label={`${activeFilter.key}=${activeFilter.value}`}
              size="small"
              color="primary"
              onDelete={(e) => {
                e.stopPropagation();
                handleClearFilter();
              }}
            />
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
          <Stack direction="row" spacing={2} alignItems="center">
            <FilterList sx={{ color: colors.neutral[500] }} />
            
            <Autocomplete
              sx={{ minWidth: 300 }}
              size="small"
              value={selectedKey}
              onChange={(_, newValue) => {
                setSelectedKey(newValue);
                // When key changes, clear the full tag selection
                setSelectedTag(null);
              }}
              options={tagKeys}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tag Key"
                  placeholder="Select tag key..."
                  variant="outlined"
                />
              )}
              disabled={isLoading}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                const tagCount = groupedTags[option]?.length || 0;
                const totalUsage = groupedTags[option]?.reduce((sum, tag) => sum + tag.count, 0) || 0;
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>{option}</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip
                          label={`${tagCount} values`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        <Chip
                          label={`${totalUsage} uses`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                );
              }}
            />

            <Typography variant="body2" sx={{ color: colors.neutral[500], fontWeight: 600 }}>
              =
            </Typography>

            <Autocomplete
              sx={{ minWidth: 300 }}
              size="small"
              value={selectedTag}
              onChange={(_, newValue) => setSelectedTag(newValue)}
              options={selectedKey ? groupedTags[selectedKey] || [] : []}
              getOptionLabel={(option) => option.value}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tag Value"
                  placeholder="Select tag value..."
                  variant="outlined"
                />
              )}
              disabled={!selectedKey || isLoading}
              noOptionsText={
                selectedKey
                  ? 'No values available'
                  : 'Select a tag key first'
              }
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                  <Box component="li" key={key} {...otherProps}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>{option.value}</Typography>
                      <Chip
                        label={`${option.count} assets`}
                        size="small"
                        color="secondary"
                        variant="filled"
                        sx={{ 
                          height: 18, 
                          fontSize: '0.65rem',
                          bgcolor: colors.neutral[200],
                          color: colors.neutral[700]
                        }}
                      />
                    </Stack>
                  </Box>
                );
              }}
            />

            {activeFilter && (
              <Tooltip title="Clear filter">
                <IconButton
                  size="small"
                  onClick={handleClearFilter}
                  sx={{ ml: 1 }}
                >
                  <Clear />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {/* Quick Stats */}
          {!isLoading && availableTags.length > 0 && (
            <Typography
              variant="caption"
              sx={{ mt: spacing.sm / 8, display: 'block', color: colors.neutral[600] }}
            >
              {tagKeys.length} tag keys available •{' '}
              {availableTags.length} unique tag combinations •{' '}
              {availableTags.reduce((sum, tag) => sum + tag.count, 0)} total usages
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};