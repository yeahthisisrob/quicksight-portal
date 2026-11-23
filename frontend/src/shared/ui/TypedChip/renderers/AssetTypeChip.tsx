import { alpha, Chip } from '@mui/material';
import React from 'react';

import { pal, tint } from '@/shared/design-system';
import type { AssetHueKey } from '@/shared/design-system/tokens';

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
  /** The asset hue the theme answers for in the dark scheme. */
  colorKey: AssetHueKey;
}

export const AssetTypeChip = React.forwardRef<HTMLDivElement, AssetTypeChipProps>(
  ({ Icon, label, effectiveVariant, size, showIcon, colorConfig, colorKey, ...chipProps }, ref) => {
    const filled = effectiveVariant === 'filled';
    return (
      <Chip
        ref={ref}
        size={size}
        variant={effectiveVariant}
        label={label}
        icon={showIcon ? <Icon /> : undefined}
        sx={(theme) => ({
          backgroundColor:
            effectiveVariant === 'filled' ? colorConfig.main : alpha(colorConfig.light, 0.5),
          color: effectiveVariant === 'filled' ? 'white' : colorConfig.dark,
          fontWeight: 600,
          borderColor:
            effectiveVariant === 'outlined' ? alpha(colorConfig.main, 0.5) : colorConfig.main,
          transition: 'all 0.2s',
          cursor: chipProps.onClick ? 'pointer' : 'default',
          '& .MuiChip-icon': {
            color: effectiveVariant === 'filled' ? 'white' : colorConfig.main,
            fontSize: '18px',
          },
          '&:hover': chipProps.onClick
            ? {
                backgroundColor:
                  effectiveVariant === 'filled' ? colorConfig.dark : alpha(colorConfig.light, 0.7),
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }
            : {},
          // The light values above are fixed; the dark scheme asks the theme.
          ...theme.applyStyles('dark', {
            backgroundColor: filled
              ? pal(theme).asset[colorKey].main
              : pal(theme).asset[colorKey].subtle,
            color: filled ? pal(theme).text.onBrand : pal(theme).asset[colorKey].strong,
            borderColor: filled
              ? pal(theme).asset[colorKey].main
              : tint(pal(theme).asset[colorKey].main, 50),
            '& .MuiChip-icon': {
              color: filled ? pal(theme).text.onBrand : pal(theme).asset[colorKey].main,
            },
            '&:hover': chipProps.onClick
              ? {
                  backgroundColor: filled
                    ? pal(theme).asset[colorKey].strong
                    : tint(pal(theme).asset[colorKey].main, 24),
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

AssetTypeChip.displayName = 'AssetTypeChip';
