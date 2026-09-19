import { Box, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { pal } from '../createAppTheme';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
  /** Shown in a tooltip on the label. */
  info?: string;
}

export interface KeyValuePairsProps {
  items: KeyValueItem[];
  /** Columns at desktop width; collapses to one on narrow screens. */
  columns?: 1 | 2 | 3 | 4;
  /** Show a dash when a value is empty instead of nothing. */
  emptyText?: string;
}

/**
 * Labelled facts in a grid: id, owner, last updated. The label is small and
 * secondary, the value is body text, so a scan finds the values.
 */
export function KeyValuePairs({ items, columns = 2, emptyText = '-' }: KeyValuePairsProps) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: `repeat(${columns}, minmax(0, 1fr))` },
        columnGap: 3,
        rowGap: 2,
        m: 0,
      }}
    >
      {items.map((item, index) => (
        <Box key={index} sx={{ minWidth: 0 }}>
          <Typography
            component="dt"
            variant="body2"
            sx={(theme) => ({ color: pal(theme).text.secondary, fontWeight: 600, mb: 0.25 })}
          >
            {item.info ? (
              <Tooltip title={item.info} arrow>
                <Box
                  component="span"
                  sx={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                >
                  {item.label}
                </Box>
              </Tooltip>
            ) : (
              item.label
            )}
          </Typography>
          <Typography component="dd" variant="body1" sx={{ m: 0, overflowWrap: 'anywhere' }}>
            {item.value === undefined || item.value === null || item.value === ''
              ? emptyText
              : item.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default KeyValuePairs;
