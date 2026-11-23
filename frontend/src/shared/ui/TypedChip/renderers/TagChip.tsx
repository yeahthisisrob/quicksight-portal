import { alpha, Chip } from '@mui/material';
import React from 'react';

import { pal } from '@/shared/design-system';
import { colors, components, typography } from '@/shared/design-system/theme';

import type { TypedChipProps } from '../index';

interface TagChipProps extends TypedChipProps {
  Icon: React.ElementType;
  label: string;
  effectiveVariant: 'filled' | 'outlined';
  specialTag?: string | null;
}

const getTagColors = (specialTag: string | null | undefined) => {
  const tagColors = {
    error: {
      bg: alpha(colors.status.error, 0.1),
      color: colors.status.error,
      border: colors.status.error,
    },
    warning: {
      bg: alpha(colors.status.warning, 0.1),
      color: colors.status.warning,
      border: colors.status.warning,
    },
    default: {
      bg: colors.neutral[100],
      color: colors.neutral[700],
      border: colors.neutral[400],
    },
  };

  return specialTag && specialTag in tagColors
    ? tagColors[specialTag as keyof typeof tagColors]
    : tagColors.default;
};

export const TagChip = React.forwardRef<HTMLDivElement, TagChipProps>(
  ({ Icon, label, effectiveVariant, size, showIcon, specialTag, ...chipProps }, ref) => {
    const chipColors = getTagColors(specialTag);
    const tone = specialTag === 'error' || specialTag === 'warning' ? specialTag : null;
    const filled = effectiveVariant === 'filled';

    return (
      <Chip
        ref={ref}
        size={size}
        variant={effectiveVariant}
        label={label}
        icon={showIcon ? <Icon /> : undefined}
        sx={(theme) => ({
          height: size === 'small' ? components.chip.height.small : components.chip.height.medium,
          backgroundColor: effectiveVariant === 'filled' ? chipColors.color : chipColors.bg,
          color: effectiveVariant === 'filled' ? 'white' : chipColors.color,
          fontSize: size === 'small' ? typography.fontSize.xs : typography.fontSize.sm,
          fontWeight: specialTag ? typography.fontWeight.semibold : typography.fontWeight.medium,
          borderColor:
            effectiveVariant === 'outlined' ? alpha(chipColors.border, 0.5) : 'transparent',
          transition: 'all 0.2s',
          cursor: chipProps.onClick ? 'pointer' : 'default',
          '& .MuiChip-label': {
            px: size === 'small' ? 0.75 : 1,
          },
          '& .MuiChip-icon': {
            color: effectiveVariant === 'filled' ? 'white' : chipColors.color,
            fontSize: size === 'small' ? '14px' : '16px',
            ml: 0.5,
            mr: -0.25,
          },
          '&:hover': chipProps.onClick
            ? {
                backgroundColor:
                  effectiveVariant === 'filled'
                    ? alpha(chipColors.color, 0.8)
                    : alpha(chipColors.bg, 0.8),
              }
            : {},
          // The light values above are fixed; the dark scheme asks the theme.
          ...theme.applyStyles('dark', {
            backgroundColor: tone
              ? filled
                ? pal(theme).tone[tone].text
                : pal(theme).tone[tone].bg
              : filled
                ? pal(theme).surface.selected
                : pal(theme).surface.hover,
            color: tone
              ? filled
                ? pal(theme).text.onBrand
                : pal(theme).tone[tone].text
              : pal(theme).text.primary,
            borderColor: filled
              ? 'transparent'
              : tone
                ? pal(theme).tone[tone].border
                : pal(theme).line.default,
            '& .MuiChip-icon': { color: 'inherit' },
            '&:hover': chipProps.onClick ? { backgroundColor: pal(theme).surface.selected } : {},
          }),
          ...(chipProps.sx as object),
        })}
        {...chipProps}
      />
    );
  }
);

TagChip.displayName = 'TagChip';
