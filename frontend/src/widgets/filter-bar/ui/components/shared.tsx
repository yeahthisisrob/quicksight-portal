import { Box, Chip, Stack, Typography, alpha } from '@mui/material';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

import { CHIP_STYLES, getAssetConfig, truncateText } from './constants';

import type { AssetFilter } from '../../lib/types';

// ============================================================================
// Shared Sub-Components
// ============================================================================

interface CountChipProps {
  count: number;
  label: string;
  color?: 'primary' | 'success' | 'error' | 'warning';
}

export const CountChip: React.FC<CountChipProps> = ({ count, label, color }) => (
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

export const AssetChip: React.FC<AssetChipProps> = ({
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

export const FilterSection: React.FC<FilterSectionProps> = ({ title, icon, color, children }) => (
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
