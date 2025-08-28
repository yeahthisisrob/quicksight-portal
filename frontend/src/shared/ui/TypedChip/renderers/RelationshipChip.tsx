import { Chip, alpha } from '@mui/material';
import React from 'react';

import { colors, components, typography } from '@/shared/design-system/theme';

import type { TypedChipProps } from '../index';

interface RelationshipChipProps extends TypedChipProps {
  Icon: React.ElementType;
  label: string;
  effectiveVariant: 'filled' | 'outlined';
}

export const RelationshipChip = React.forwardRef<HTMLDivElement, RelationshipChipProps>(({ 
  Icon,
  label,
  effectiveVariant,
  size,
  showIcon,
  count,
  ...chipProps 
}, ref) => {
  const hasCount = count !== undefined && count > 0;
  
  return (
    <Chip
      ref={ref}
      size={size}
      variant={effectiveVariant}
      label={label}
      icon={showIcon && hasCount ? <Icon /> : undefined}
      sx={{
        height: size === 'small' ? components.chip.height.small : components.chip.height.medium,
        minWidth: '40px',
        backgroundColor: hasCount 
          ? (effectiveVariant === 'filled' ? colors.primary.main : alpha(colors.primary.light, 0.3))
          : colors.neutral[100],
        color: hasCount 
          ? (effectiveVariant === 'filled' ? 'white' : colors.primary.dark)
          : colors.neutral[400],
        fontSize: size === 'small' ? typography.fontSize.xs : typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        borderColor: effectiveVariant === 'outlined' 
          ? (hasCount ? alpha(colors.primary.main, 0.5) : colors.neutral[300]) 
          : 'transparent',
        opacity: hasCount ? 1 : 0.6,
        transition: 'all 0.2s',
        cursor: chipProps.onClick ? 'pointer' : 'default',
        '& .MuiChip-label': { 
          px: size === 'small' ? 0.75 : 1 
        },
        '& .MuiChip-icon': {
          display: hasCount ? 'flex' : 'none',
          color: effectiveVariant === 'filled' ? 'white' : colors.primary.main,
          fontSize: size === 'small' ? '14px' : '16px',
          ml: 0.25,
          mr: -0.5,
        },
        '&:hover': chipProps.onClick ? {
          backgroundColor: hasCount 
            ? colors.primary.main
            : colors.neutral[200],
          color: hasCount ? 'white' : colors.neutral[600],
          opacity: 1,
          '& .MuiChip-icon': {
            color: 'white',
          },
        } : {},
        ...chipProps.sx,
      }}
      {...chipProps}
    />
  );
});

RelationshipChip.displayName = 'RelationshipChip';