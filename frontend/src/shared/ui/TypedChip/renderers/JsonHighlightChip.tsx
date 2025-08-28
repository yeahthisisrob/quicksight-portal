import { Chip, alpha } from '@mui/material';
import React from 'react';

import { colors } from '@/shared/design-system/theme';

import type { ChipType } from '../chipConfig';
import type { TypedChipProps } from '../index';

interface JsonHighlightChipProps extends TypedChipProps {
  Icon: React.ElementType;
  label: string;
  effectiveVariant: 'filled' | 'outlined';
}

const getHighlightColors = (type: ChipType) => {
  const highlightColors = {
    FIELDS: { 
      bg: alpha(colors.primary.main, 0.1), 
      color: colors.primary.main, 
      border: colors.primary.main 
    },
    CALCULATED_FIELDS: { 
      bg: alpha(colors.assetTypes.analysis.main, 0.1), 
      color: colors.assetTypes.analysis.main, 
      border: colors.assetTypes.analysis.main 
    },
    VISUALS: { 
      bg: alpha(colors.status.success, 0.1), 
      color: colors.status.success, 
      border: colors.status.success 
    },
    SHEETS: { 
      bg: alpha(colors.status.warning, 0.1), 
      color: colors.status.warning, 
      border: colors.status.warning 
    },
    FILTERS: { 
      bg: alpha(colors.status.error, 0.1), 
      color: colors.status.error, 
      border: colors.status.error 
    },
    EXPRESSIONS: { 
      bg: alpha(colors.assetTypes.analysis.main, 0.1), 
      color: colors.assetTypes.analysis.main, 
      border: colors.assetTypes.analysis.main 
    },
  };
  
  return highlightColors[type as keyof typeof highlightColors];
};

export const JsonHighlightChip = React.forwardRef<HTMLDivElement, JsonHighlightChipProps>(({ 
  Icon,
  label,
  effectiveVariant,
  size,
  showIcon,
  type,
  ...chipProps 
}, ref) => {
  const chipColors = getHighlightColors(type);
  
  return (
    <Chip
      ref={ref}
      size={size}
      variant={effectiveVariant}
      label={label}
      icon={showIcon ? <Icon /> : undefined}
      sx={{
        backgroundColor: effectiveVariant === 'filled' ? chipColors.color : chipColors.bg,
        color: effectiveVariant === 'filled' ? 'white' : chipColors.color,
        fontWeight: 600,
        borderColor: effectiveVariant === 'outlined' ? alpha(chipColors.border, 0.5) : 'transparent',
        transition: 'all 0.2s',
        cursor: chipProps.onClick ? 'pointer' : 'default',
        '& .MuiChip-icon': {
          color: effectiveVariant === 'filled' ? 'white' : chipColors.color,
          fontSize: '18px',
        },
        '&:hover': chipProps.onClick ? {
          backgroundColor: effectiveVariant === 'filled' 
            ? alpha(chipColors.color, 0.8)
            : alpha(chipColors.bg, 0.8),
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        } : {},
        ...chipProps.sx,
      }}
      {...chipProps}
    />
  );
});

JsonHighlightChip.displayName = 'JsonHighlightChip';