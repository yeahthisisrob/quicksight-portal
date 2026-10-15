import { Box, Skeleton, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { pal } from '../createAppTheme';

interface StatStripItem {
  label: ReactNode;
  /** The number, usually; any short node. */
  value: ReactNode;
  /** A line under the value: what the number means, or a status. */
  hint?: ReactNode;
}

interface StatStripProps {
  items: StatStripItem[];
  /** Tiles per row at desktop width; every item on one row when omitted. */
  columns?: number;
  loading?: boolean;
  ariaLabel?: string;
}

const SKELETON_WIDTH = 64;
const NARROW_COLUMNS = 2;

function StatTile({
  item,
  first,
  loading,
}: {
  item: StatStripItem;
  first: boolean;
  loading: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        px: 2,
        py: 1.5,
        minWidth: 0,
        borderLeft: first ? 'none' : `1px solid ${pal(theme).line.divider}`,
      })}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
        {item.label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" sx={{ width: SKELETON_WIDTH, fontSize: '1.5rem' }} />
      ) : (
        <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
          {item.value}
        </Typography>
      )}
      {item.hint !== undefined && !loading && (
        <Box sx={{ mt: 0.25 }}>
          {typeof item.hint === 'string' ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {item.hint}
            </Typography>
          ) : (
            item.hint
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * A strip of counts over a list or a page: label over number, tiles side by
 * side with a divider between them, two to a row on a phone. Numbers only,
 * never controls: filtering is the job of the controls beside the list. The
 * one shape for every summary in the portal, so the catalog, the export and
 * the rest read the same way.
 */
export function StatStrip({ items, columns, loading = false, ariaLabel }: StatStripProps) {
  const perRow = columns ?? items.length;
  return (
    <Box
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: {
          xs: `repeat(${NARROW_COLUMNS}, 1fr)`,
          md: `repeat(${perRow}, 1fr)`,
        },
        border: `1px solid ${pal(theme).line.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: pal(theme).surface.container,
        overflow: 'hidden',
      })}
    >
      {items.map((item, index) => (
        <StatTile key={index} item={item} first={index === 0} loading={loading} />
      ))}
    </Box>
  );
}
