/**
 * SearchMatchChip - Displays why an asset matched a search query
 * FSD Layer: shared/ui
 *
 * Shows compact, color-coded chips indicating match reasons
 * (name, tags, dependencies, permissions, etc.)
 */
import {
  TextFields as NameIcon,
  Key as IdIcon,
  Description as DescriptionIcon,
  Cloud as ArnIcon,
  LocalOffer as TagIcon,
  Security as PermissionIcon,
  Storage as DatasetIcon,
  CloudQueue as DatasourceIcon,
  Analytics as AnalysisIcon,
} from '@mui/icons-material';
import { Chip, ChipProps, Tooltip } from '@mui/material';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

import type { SearchMatchReason } from '@shared/generated';


/**
 * Configuration for each match reason type
 */
const MATCH_REASON_CONFIG: Record<
  SearchMatchReason,
  {
    label: string;
    tooltip: string;
    icon: React.ComponentType<{ fontSize?: 'inherit' | 'small' | 'medium' | 'large' }>;
    color: string;
    bgColor: string;
  }
> = {
  name: {
    label: 'Name',
    tooltip: 'Name',
    icon: NameIcon,
    color: colors.assetTypes.dashboard.dark,
    bgColor: colors.assetTypes.dashboard.light,
  },
  id: {
    label: 'ID',
    tooltip: 'ID',
    icon: IdIcon,
    color: colors.neutral[700],
    bgColor: colors.neutral[100],
  },
  description: {
    label: 'Desc',
    tooltip: 'Description',
    icon: DescriptionIcon,
    color: colors.assetTypes.analysis.dark,
    bgColor: colors.assetTypes.analysis.light,
  },
  arn: {
    label: 'ARN',
    tooltip: 'ARN',
    icon: ArnIcon,
    color: colors.assetTypes.datasource.dark,
    bgColor: colors.assetTypes.datasource.light,
  },
  tag_key: {
    label: 'Tag Key',
    tooltip: 'Tag key',
    icon: TagIcon,
    color: colors.status.info,
    bgColor: colors.status.infoLight,
  },
  tag_value: {
    label: 'Tag Value',
    tooltip: 'Tag value',
    icon: TagIcon,
    color: colors.status.success,
    bgColor: colors.status.successLight,
  },
  permission: {
    label: 'Perm',
    tooltip: 'Permission',
    icon: PermissionIcon,
    color: colors.assetTypes.user.dark,
    bgColor: colors.assetTypes.user.light,
  },
  dependency_dataset: {
    label: 'Dataset',
    tooltip: 'Related dataset',
    icon: DatasetIcon,
    color: colors.assetTypes.dataset.dark,
    bgColor: colors.assetTypes.dataset.light,
  },
  dependency_datasource: {
    label: 'Source',
    tooltip: 'Related datasource',
    icon: DatasourceIcon,
    color: colors.assetTypes.datasource.dark,
    bgColor: colors.assetTypes.datasource.light,
  },
  dependency_analysis: {
    label: 'Analysis',
    tooltip: 'Related analysis',
    icon: AnalysisIcon,
    color: colors.assetTypes.analysis.dark,
    bgColor: colors.assetTypes.analysis.light,
  },
};

export interface SearchMatchChipProps extends Omit<ChipProps, 'label' | 'icon' | 'color'> {
  /** The reason why the asset matched the search */
  reason: SearchMatchReason;
  /** Whether to show the icon */
  showIcon?: boolean;
  /** Whether to show as compact (icon only) */
  compact?: boolean;
  /** Optional custom label (e.g., count) - if provided, shows this instead of the reason label */
  label?: string | number;
}

/**
 * SearchMatchChip component
 *
 * Displays a chip indicating why an asset matched a search query.
 * Used in search results to provide transparency about match reasons.
 */
export const SearchMatchChip = React.forwardRef<HTMLDivElement, SearchMatchChipProps>(
  ({ reason, showIcon = true, compact = false, size = 'small', label: customLabel, ...chipProps }, ref) => {
    const config = MATCH_REASON_CONFIG[reason];

    if (!config) {
      return null;
    }

    const Icon = config.icon;
    // Use custom label if provided (e.g., count), otherwise use the config label
    const label = compact ? undefined : (customLabel !== undefined ? customLabel : config.label);
    // When custom label is used, enhance the tooltip to include the reason label
    const tooltipText = customLabel !== undefined
      ? `${config.label}: ${config.tooltip}`
      : config.tooltip;

    return (
      <Tooltip title={tooltipText} arrow placement="top">
        <Chip
          ref={ref}
          size={size}
          label={label}
          icon={showIcon ? <Icon fontSize="inherit" /> : undefined}
          sx={{
            backgroundColor: config.bgColor,
            color: config.color,
            fontWeight: 500,
            fontSize: '0.7rem',
            height: compact ? 20 : size === 'small' ? 22 : 26,
            minWidth: compact ? 20 : undefined,
            '& .MuiChip-icon': {
              color: config.color,
              fontSize: compact ? '0.875rem' : '0.9rem',
              marginLeft: compact ? 0 : undefined,
              marginRight: compact ? 0 : undefined,
            },
            '& .MuiChip-label': {
              paddingLeft: compact ? 0 : undefined,
              paddingRight: compact ? 0 : undefined,
            },
            ...chipProps.sx,
          }}
          {...chipProps}
        />
      </Tooltip>
    );
  }
);

SearchMatchChip.displayName = 'SearchMatchChip';

/**
 * SearchMatchChipGroup - Displays multiple match reasons
 */
export interface SearchMatchChipGroupProps {
  /** Array of match reasons to display */
  reasons: SearchMatchReason[];
  /** Maximum number of chips to show before collapsing */
  maxVisible?: number;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Gap between chips */
  gap?: number;
}

export const SearchMatchChipGroup: React.FC<SearchMatchChipGroupProps> = ({
  reasons,
  maxVisible = 3,
  compact = false,
  gap = 4,
}) => {
  if (!reasons || reasons.length === 0) {
    return null;
  }

  // Remove duplicates and sort by priority (direct matches first)
  const uniqueReasons = [...new Set(reasons)];
  const priorityOrder: SearchMatchReason[] = [
    'name',
    'id',
    'description',
    'tag_key',
    'tag_value',
    'permission',
    'arn',
    'dependency_dataset',
    'dependency_datasource',
    'dependency_analysis',
  ];
  const sortedReasons = uniqueReasons.sort(
    (a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b)
  );

  const visibleReasons = sortedReasons.slice(0, maxVisible);
  const hiddenCount = sortedReasons.length - maxVisible;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, flexWrap: 'wrap' }}>
      {visibleReasons.map((reason) => (
        <SearchMatchChip key={reason} reason={reason} compact={compact} />
      ))}
      {hiddenCount > 0 && (
        <Tooltip
          title={sortedReasons
            .slice(maxVisible)
            .map((r) => MATCH_REASON_CONFIG[r]?.tooltip)
            .join(', ')}
          arrow
        >
          <Chip
            size="small"
            label={`+${hiddenCount}`}
            sx={{
              height: compact ? 20 : 22,
              fontSize: '0.7rem',
              backgroundColor: colors.neutral[100],
              color: colors.neutral[600],
            }}
          />
        </Tooltip>
      )}
    </div>
  );
};

export default SearchMatchChip;
