/**
 * One search hit, the same everywhere it appears: the name, the one-line
 * summary the server wrote, why it matched, and for calculated fields the
 * expression and where it is defined.
 */
import { Box, Chip, Stack, Typography } from '@mui/material';
import type { MouseEvent } from 'react';

import type { SearchHit } from '@/shared/api/modules/search';
import { pal } from '@/shared/design-system';
import { SEARCH_TYPE_SINGULAR } from '@/shared/lib/search/groupHits';

const WHY_LIMIT = 4;
const DEFINED_IN_LIMIT = 3;

export interface SearchHitRowProps {
  hit: SearchHit;
  selected?: boolean;
  /** Hide the type chip when the list already says the type (a grouped list). */
  hideType?: boolean;
  onSelect: (hit: SearchHit, event: MouseEvent<HTMLElement>) => void;
  onHover?: (hit: SearchHit) => void;
}

export function SearchHitRow({ hit, selected, hideType, onSelect, onHover }: SearchHitRowProps) {
  const definedIn = hit.definedIn ?? [];
  return (
    <Box
      component="li"
      role="option"
      aria-selected={selected ? 'true' : 'false'}
      data-search-hit={hit.id}
      onClick={(event) => onSelect(hit, event)}
      onMouseEnter={() => onHover?.(hit)}
      sx={(theme) => ({
        listStyle: 'none',
        px: 1.5,
        py: 1,
        cursor: 'pointer',
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: selected ? pal(theme).surface.selected : 'transparent',
        '&:hover': { bgcolor: selected ? pal(theme).surface.selected : pal(theme).surface.hover },
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', minWidth: 0 }}>
        {!hideType && (
          <Chip size="small" variant="outlined" label={SEARCH_TYPE_SINGULAR[hit.type]} />
        )}
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {hit.name}
        </Typography>
        {hit.views !== undefined && hit.views > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {hit.views} views
          </Typography>
        )}
      </Stack>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}
        noWrap
      >
        {hit.summary}
      </Typography>
      {hit.expression && (
        <Typography
          variant="caption"
          sx={(theme) => ({
            display: 'block',
            mt: 0.5,
            fontFamily: 'monospace',
            color: pal(theme).text.primary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          })}
        >
          {hit.expression}
        </Typography>
      )}
      {definedIn.length > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
          Defined in {definedIn.length} asset{definedIn.length === 1 ? '' : 's'}:{' '}
          {definedIn
            .slice(0, DEFINED_IN_LIMIT)
            .map((d) => d.name)
            .join(', ')}
          {definedIn.length > DEFINED_IN_LIMIT ? ', …' : ''}
        </Typography>
      )}
      {hit.why.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
          {hit.why.slice(0, WHY_LIMIT).map((why) => (
            <Chip
              key={why}
              size="small"
              label={why}
              sx={(theme) => ({
                height: 20,
                fontSize: theme.typography.caption.fontSize,
                bgcolor: pal(theme).surface.container,
                border: `1px solid ${pal(theme).line.divider}`,
              })}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
