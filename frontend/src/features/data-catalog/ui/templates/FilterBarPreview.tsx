/**
 * A filter bar as it will sit at the top of a sheet: its controls in order,
 * each as wide as its span (QuickSight's control bar is 12 units wide; the
 * portal allows 1 to 6 per control).
 */
import { FilterList } from '@mui/icons-material';
import { Box, Stack, Typography } from '@mui/material';

import type { FilterBarControl } from '@/shared/api/modules/data-catalog';
import { pal } from '@/shared/design-system';

/** Control-bar width in grid units, so a span reads as a share of it. */
const CONTROL_BAR_UNITS = 12;

export function FilterBarPreview({ controls }: { controls: FilterBarControl[] }) {
  return (
    <Box
      aria-label="Filter bar preview"
      sx={(theme) => ({
        display: 'flex',
        gap: 1,
        p: 1,
        overflowX: 'auto',
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: pal(theme).surface.container,
      })}
    >
      {controls.map((control) => (
        <Box
          key={control.column}
          sx={(theme) => ({
            flex: `0 0 ${(control.span / CONTROL_BAR_UNITS) * 100}%`,
            minWidth: 96,
            px: 1,
            py: 0.75,
            border: `1px solid ${pal(theme).line.divider}`,
            borderRadius: `${theme.shape.borderRadius}px`,
            bgcolor: 'background.paper',
          })}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
            <FilterList sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
              {control.title || control.column}
            </Typography>
          </Stack>
          <Typography variant="caption" noWrap component="div" sx={{ color: 'text.secondary' }}>
            {control.values?.length ? control.values.join(', ') : 'All'}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
