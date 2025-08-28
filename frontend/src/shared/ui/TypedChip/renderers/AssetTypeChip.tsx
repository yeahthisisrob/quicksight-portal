import { Chip, alpha } from '@mui/material';
import React from 'react';

import type { TypedChipProps } from '../index';

interface AssetTypeChipProps extends TypedChipProps {
  Icon: React.ElementType;
  label: string;
  effectiveVariant: 'filled' | 'outlined';
  colorConfig: {
    main: string;
    light: string;
    dark: string;
  };
}

export const AssetTypeChip = React.forwardRef<HTMLDivElement, AssetTypeChipProps>(({ 
  Icon,
  label,
  effectiveVariant,
  size,
  showIcon,
  colorConfig,
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
        backgroundColor: effectiveVariant === 'filled' ? colorConfig.main : alpha(colorConfig.light, 0.5),
        color: effectiveVariant === 'filled' ? 'white' : colorConfig.dark,
        fontWeight: 600,
        borderColor: effectiveVariant === 'outlined' ? alpha(colorConfig.main, 0.5) : colorConfig.main,
        transition: 'all 0.2s',
        cursor: chipProps.onClick ? 'pointer' : 'default',
        '& .MuiChip-icon': {
          color: effectiveVariant === 'filled' ? 'white' : colorConfig.main,
          fontSize: '18px',
        },
        '&:hover': chipProps.onClick ? {
          backgroundColor: effectiveVariant === 'filled' 
            ? colorConfig.dark 
            : alpha(colorConfig.light, 0.7),
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        } : {},
        ...chipProps.sx,
      }}
      {...chipProps}
    />
  );
});

AssetTypeChip.displayName = 'AssetTypeChip';