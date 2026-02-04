import {
  FilterList,
  ExpandMore,
  ExpandLess,
  Add,
  Remove,
  Schedule,
  Error as ErrorIcon,
  CheckCircle,
  Folder as FolderIcon,
  Timeline as ActivityIcon,
  Block as NoActivityIcon,
} from '@mui/icons-material';
import { Box, Chip, Stack, Typography, IconButton, alpha } from '@mui/material';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

import { CHIP_STYLES, getDateFilterLabel } from './constants';
import { AssetChip } from './shared';

import type {
  DateFilterState,
  ErrorFilterState,
  ActivityFilterState,
  TagFilter,
  FolderFilter,
  AssetFilter,
} from '../../lib/types';

// ============================================================================
// Types
// ============================================================================

export interface FilterHeaderProps {
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

// ============================================================================
// Sub-Components
// ============================================================================

interface FilterChipProps {
  icon: React.ReactNode;
  label: string;
  color: 'info' | 'error' | 'success' | 'warning';
  onDelete: (e: React.MouseEvent) => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ icon, label, color, onDelete }) => (
  <Chip
    icon={<>{icon}</>}
    label={label}
    size="small"
    color={color}
    variant="outlined"
    sx={CHIP_STYLES.medium}
    onDelete={onDelete}
  />
);

interface ChipGroupProps {
  items: Array<{ label: string }>;
  icon?: React.ReactNode;
  color: 'success' | 'error' | 'primary';
  maxVisible?: number;
  onRemove: (index: number) => void;
  renderLabel?: (item: { label: string }, index: number) => string;
}

const ChipGroup: React.FC<ChipGroupProps> = ({
  items,
  icon,
  color,
  maxVisible = 2,
  onRemove,
  renderLabel = (item) => item.label,
}) => {
  if (items.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {icon}
      {items.slice(0, maxVisible).map((item, idx) => (
        <Chip
          key={`chip-${idx}`}
          label={renderLabel(item, idx)}
          size="small"
          color={color}
          variant="outlined"
          sx={CHIP_STYLES.medium}
          onDelete={(e) => {
            e.stopPropagation();
            onRemove(idx);
          }}
        />
      ))}
      {items.length > maxVisible && (
        <Typography variant="caption" color="text.secondary">
          +{items.length - maxVisible} more
        </Typography>
      )}
    </Stack>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const FilterHeader: React.FC<FilterHeaderProps> = ({
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
          <FilterChip
            icon={<Schedule sx={{ fontSize: 14 }} />}
            label={getDateFilterLabel(dateFilter)}
            color="info"
            onDelete={(e) => {
              e.stopPropagation();
              onClearDateFilter();
            }}
          />
        )}

        {/* Error filter chip */}
        {hasErrorFilter && onClearErrorFilter && (
          <FilterChip
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
            color={errorFilter === 'with_errors' ? 'error' : 'success'}
            onDelete={(e) => {
              e.stopPropagation();
              onClearErrorFilter();
            }}
          />
        )}

        {/* Activity filter chip */}
        {hasActivityFilter && onClearActivityFilter && (
          <FilterChip
            icon={
              activityFilter === 'with_activity' ? (
                <ActivityIcon sx={{ fontSize: 14 }} />
              ) : (
                <NoActivityIcon sx={{ fontSize: 14 }} />
              )
            }
            label={activityFilter === 'with_activity' ? 'With activity' : 'No activity'}
            color={activityFilter === 'with_activity' ? 'info' : 'warning'}
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
        <ChipGroup
          items={includeTags.map((tag) => ({ label: `${tag.key}=${tag.value}` }))}
          icon={<Add sx={{ fontSize: 14, color: 'success.main' }} />}
          color="success"
          onRemove={onRemoveIncludeTag}
        />

        {/* Exclude tag chips */}
        <ChipGroup
          items={excludeTags.map((tag) => ({ label: `${tag.key}=${tag.value}` }))}
          icon={<Remove sx={{ fontSize: 14, color: 'error.main' }} />}
          color="error"
          onRemove={onRemoveExcludeTag}
        />

        {/* Include folder chips */}
        <ChipGroup
          items={includeFolders.map((folder) => ({ label: folder.name }))}
          icon={<FolderIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
          color="primary"
          onRemove={onRemoveIncludeFolder}
        />

        {/* Exclude folder chips */}
        <ChipGroup
          items={excludeFolders.map((folder) => ({ label: folder.name }))}
          icon={<FolderIcon sx={{ fontSize: 14, color: 'error.main' }} />}
          color="error"
          onRemove={onRemoveExcludeFolder}
        />
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
