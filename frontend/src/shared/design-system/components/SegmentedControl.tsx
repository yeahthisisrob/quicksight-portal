import { Box, ButtonBase, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';

import { pal } from '../createAppTheme';
import { radius } from '../tokens/scale';

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Required: the group has no visible label of its own. */
  ariaLabel: string;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

/**
 * A single-choice switch for two to five short options ("Grid | List",
 * "Copy | In place"). For longer lists use a Select; for navigation use TabBar.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'medium',
  sx,
}: SegmentedControlProps<T>) {
  return (
    <Box
      role="radiogroup"
      aria-label={ariaLabel}
      sx={[
        (theme) => ({
          display: 'inline-flex',
          border: `2px solid ${pal(theme).line.default}`,
          borderRadius: `${radius.pill}px`,
          padding: '2px',
          gap: '2px',
          backgroundColor: pal(theme).surface.container,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <ButtonBase
            key={option.value}
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            sx={(theme) => ({
              borderRadius: `${radius.pill}px`,
              px: size === 'small' ? 1.5 : 2,
              py: size === 'small' ? 0.25 : 0.5,
              minHeight: size === 'small' ? 24 : 28,
              gap: 0.75,
              fontWeight: 700,
              fontSize: size === 'small' ? 12 : 14,
              fontFamily: 'inherit',
              color: selected ? pal(theme).text.onBrand : pal(theme).text.secondary,
              backgroundColor: selected ? pal(theme).brand.primary : 'transparent',
              transition: theme.transitions.create(['background-color', 'color']),
              '&:hover': {
                backgroundColor: selected ? pal(theme).brand.hover : pal(theme).surface.hover,
              },
              '&.Mui-disabled': { color: pal(theme).text.disabled },
              '&:focus-visible': { outline: `2px solid ${pal(theme).line.focus}` },
              '& svg': { fontSize: size === 'small' ? 14 : 16 },
            })}
          >
            {option.icon}
            {option.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
