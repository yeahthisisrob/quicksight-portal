import { Chip, alpha } from '@mui/material';
import React from 'react';

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
      border: colors.status.error 
    },
    warning: { 
      bg: alpha(colors.status.warning, 0.1), 
      color: colors.status.warning, 
      border: colors.status.warning 
    },
    default: { 
      bg: colors.neutral[100], 
      color: colors.neutral[700], 
      border: colors.neutral[400] 
    }
  };
  
  return specialTag && specialTag in tagColors ? 
    tagColors[specialTag as keyof typeof tagColors] : 
    tagColors.default;
};

export const TagChip = React.forwardRef<HTMLDivElement, TagChipProps>(({ 
  Icon,
  label,
  effectiveVariant,
  size,
  showIcon,
  specialTag,
  ...chipProps 
}, ref) => {
  const chipColors = getTagColors(specialTag);
  
  return (
    <Chip
      ref={ref}
      size={size}
      variant={effectiveVariant}
      label={label}
      icon={showIcon ? <Icon /> : undefined}
      sx={{
        height: size === 'small' ? components.chip.height.small : components.chip.height.medium,
        backgroundColor: effectiveVariant === 'filled' ? chipColors.color : chipColors.bg,
        color: effectiveVariant === 'filled' ? 'white' : chipColors.color,
        fontSize: size === 'small' ? typography.fontSize.xs : typography.fontSize.sm,
        fontWeight: specialTag ? typography.fontWeight.semibold : typography.fontWeight.medium,
        borderColor: effectiveVariant === 'outlined' ? alpha(chipColors.border, 0.5) : 'transparent',
        transition: 'all 0.2s',
        cursor: chipProps.onClick ? 'pointer' : 'default',
        '& .MuiChip-label': { 
          px: size === 'small' ? 0.75 : 1 
        },
        '& .MuiChip-icon': {
          color: effectiveVariant === 'filled' ? 'white' : chipColors.color,
          fontSize: size === 'small' ? '14px' : '16px',
          ml: 0.5,
          mr: -0.25,
        },
        '&:hover': chipProps.onClick ? {
          backgroundColor: effectiveVariant === 'filled' 
            ? alpha(chipColors.color, 0.8)
            : alpha(chipColors.bg, 0.8),
        } : {},
        ...chipProps.sx,
      }}
      {...chipProps}
    />
  );
});

TagChip.displayName = 'TagChip';