import { alpha, Chip } from '@mui/material';
import React from 'react';

import { pal, tint } from '@/shared/design-system';
import { colors, components, typography } from '@/shared/design-system/theme';

import type { TypedChipProps } from '../index';

interface RelationshipChipProps extends TypedChipProps {
  Icon: React.ElementType;
  label: string;
  effectiveVariant: 'filled' | 'outlined';
}

export const RelationshipChip = React.forwardRef<HTMLDivElement, RelationshipChipProps>(
  ({ Icon, label, effectiveVariant, size, showIcon, count, ...chipProps }, ref) => {
    const hasCount = count !== undefined && count > 0;
    const filled = effectiveVariant === 'filled';

    return (
      <Chip
        ref={ref}
        size={size}
        variant={effectiveVariant}
        label={label}
        icon={showIcon && hasCount ? <Icon /> : undefined}
        sx={(theme) => ({
          height: size === 'small' ? components.chip.height.small : components.chip.height.medium,
          minWidth: '40px',
          backgroundColor: hasCount
            ? effectiveVariant === 'filled'
              ? colors.primary.main
              : alpha(colors.primary.light, 0.3)
            : colors.neutral[100],
          color: hasCount
            ? effectiveVariant === 'filled'
              ? 'white'
              : colors.primary.dark
            : colors.neutral[400],
          fontSize: size === 'small' ? typography.fontSize.xs : typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          borderColor:
            effectiveVariant === 'outlined'
              ? hasCount
                ? alpha(colors.primary.main, 0.5)
                : colors.neutral[300]
              : 'transparent',
          opacity: hasCount ? 1 : 0.6,
          transition: 'all 0.2s',
          cursor: chipProps.onClick ? 'pointer' : 'default',
          '& .MuiChip-label': {
            px: size === 'small' ? 0.75 : 1,
          },
          '& .MuiChip-icon': {
            display: hasCount ? 'flex' : 'none',
            color: effectiveVariant === 'filled' ? 'white' : colors.primary.main,
            fontSize: size === 'small' ? '14px' : '16px',
            ml: 0.25,
            mr: -0.5,
          },
          '&:hover': chipProps.onClick
            ? {
                backgroundColor: hasCount ? colors.primary.main : colors.neutral[200],
                color: hasCount ? 'white' : colors.neutral[600],
                opacity: 1,
                '& .MuiChip-icon': {
                  color: 'white',
                },
              }
            : {},
          // The light values above are fixed; the dark scheme asks the theme.
          ...theme.applyStyles('dark', {
            backgroundColor: hasCount
              ? filled
                ? pal(theme).brand.primary
                : pal(theme).brand.subtle
              : pal(theme).surface.hover,
            color: hasCount
              ? filled
                ? pal(theme).text.onBrand
                : pal(theme).brand.primary
              : pal(theme).text.muted,
            borderColor: filled
              ? 'transparent'
              : hasCount
                ? tint(pal(theme).brand.primary, 50)
                : pal(theme).line.default,
            '& .MuiChip-icon': {
              color: filled ? pal(theme).text.onBrand : pal(theme).brand.primary,
            },
            '&:hover': chipProps.onClick
              ? {
                  backgroundColor: hasCount ? pal(theme).brand.hover : pal(theme).surface.selected,
                  color: hasCount ? pal(theme).text.onBrand : pal(theme).text.primary,
                  '& .MuiChip-icon': { color: pal(theme).text.onBrand },
                }
              : {},
          }),
          ...(chipProps.sx as object),
        })}
        {...chipProps}
      />
    );
  }
);

RelationshipChip.displayName = 'RelationshipChip';
