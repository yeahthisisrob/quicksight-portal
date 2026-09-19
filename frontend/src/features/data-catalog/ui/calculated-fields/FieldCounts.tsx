/**
 * The strip of counts over the calculated fields table. Tiles that narrow the
 * list (conflicts, unused, templated) are buttons and show when they are on.
 */
import { Box, ButtonBase, Typography } from '@mui/material';

import type { CalculatedFieldCatalog } from '@/shared/api/modules/data-catalog';
import { pal } from '@/shared/design-system';

export type CountFilter = 'conflicts' | 'unused' | 'templated';

interface FieldCountsProps {
  counts: CalculatedFieldCatalog['counts'];
  active?: CountFilter;
  onToggle: (filter: CountFilter) => void;
}

interface Tile {
  label: string;
  value: number;
  filter?: CountFilter;
  hint?: string;
}

export function FieldCounts({ counts, active, onToggle }: FieldCountsProps) {
  const tiles: Tile[] = [
    { label: 'Calculated fields', value: counts.fields, hint: 'One per distinct expression' },
    { label: 'Distinct names', value: counts.names },
    {
      label: 'Conflicts',
      value: counts.conflicts,
      filter: 'conflicts',
      hint: 'Names with more than one expression',
    },
    { label: 'Templated', value: counts.templated, filter: 'templated' },
    { label: 'Unused', value: counts.unused, filter: 'unused', hint: 'Read by nothing' },
    { label: 'Datasets', value: counts.datasets },
  ];
  return (
    <Box
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: `repeat(${tiles.length}, 1fr)` },
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: pal(theme).surface.container,
        overflow: 'hidden',
      })}
    >
      {tiles.map((tile, index) => {
        const on = tile.filter !== undefined && tile.filter === active;
        const content = (
          <>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {tile.label}
            </Typography>
            <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
              {tile.value}
            </Typography>
            {tile.hint && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}
              >
                {tile.hint}
              </Typography>
            )}
          </>
        );
        const sx = (theme: Parameters<typeof pal>[0]) => ({
          px: 2,
          py: 1.5,
          textAlign: 'left' as const,
          display: 'block',
          width: '100%',
          borderLeft: index === 0 ? 'none' : `1px solid ${pal(theme).line.divider}`,
          bgcolor: on ? pal(theme).surface.selected : undefined,
          boxShadow: on ? `inset 0 -2px 0 ${pal(theme).brand.primary}` : undefined,
        });
        return tile.filter ? (
          <ButtonBase
            key={tile.label}
            onClick={() => onToggle(tile.filter as CountFilter)}
            aria-pressed={on}
            sx={sx}
          >
            <Box sx={{ width: '100%' }}>{content}</Box>
          </ButtonBase>
        ) : (
          <Box key={tile.label} sx={sx}>
            {content}
          </Box>
        );
      })}
    </Box>
  );
}
