import { Box, Typography } from '@mui/material';

import { pal } from '@/shared/design-system';

import type { CatalogCounts } from '../model/catalogState';

interface CatalogStatsProps {
  counts: CatalogCounts;
}

/** A compact strip of counts for the project in view. */
export function CatalogStats({ counts }: CatalogStatsProps) {
  const cells: Array<[string, number]> = [
    ['Published assets', counts.assets],
    ['With a QuickSight dataset', counts.withDataset],
    ['Without one', counts.withoutDataset],
    ['Calculated fields', counts.calculatedFields],
    ['Glossary terms', counts.terms],
  ];
  return (
    <Box
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: `repeat(${cells.length}, 1fr)` },
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: pal(theme).surface.container,
        overflow: 'hidden',
      })}
    >
      {cells.map(([label, value], index) => (
        <Box
          key={label}
          sx={(theme) => ({
            px: 2,
            py: 1.5,
            borderLeft: index === 0 ? 'none' : `1px solid ${pal(theme).line.divider}`,
          })}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {label}
          </Typography>
          <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
