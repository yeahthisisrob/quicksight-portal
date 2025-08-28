import { Chip } from '@mui/material';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

import type { TypedChipProps } from '../index';

interface StatusChipProps extends TypedChipProps {
  Icon: React.ElementType;
  label: string;
  effectiveVariant: 'filled' | 'outlined';
}

export const StatusChip = React.forwardRef<HTMLDivElement, StatusChipProps>(({ 
  Icon,
  label,
  effectiveVariant,
  size,
  showIcon,
  ...chipProps 
}, ref) => {
  return (
    <Chip
      ref={ref}
      size={size}
      variant={effectiveVariant}
      label={label}
      icon={showIcon ? <Icon /> : undefined}
      sx={{
        backgroundColor: effectiveVariant === 'filled' ? colors.neutral[400] : colors.neutral[100],
        color: effectiveVariant === 'filled' ? 'white' : colors.neutral[600],
        fontWeight: 500,
        borderColor: effectiveVariant === 'outlined' ? colors.neutral[300] : 'transparent',
        transition: 'all 0.2s',
        cursor: chipProps.onClick ? 'pointer' : 'default',
        '& .MuiChip-icon': {
          color: effectiveVariant === 'filled' ? 'white' : colors.neutral[500],
          fontSize: '16px',
        },
        '&:hover': chipProps.onClick ? {
          backgroundColor: effectiveVariant === 'filled' 
            ? colors.neutral[500]
            : colors.neutral[200],
        } : {},
        ...chipProps.sx,
      }}
      {...chipProps}
    />
  );
});

StatusChip.displayName = 'StatusChip';