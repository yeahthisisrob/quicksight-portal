/**
 * Search hits grouped by type, with one keyboard-selected row. The list is a
 * listbox; the caller owns the selected index so the input that drives it can
 * handle the arrow keys.
 */
import { Box, Typography } from '@mui/material';
import type { MouseEvent } from 'react';

import type { SearchHit } from '@/shared/api/modules/search';
import { pal } from '@/shared/design-system';
import { flattenGroups, groupHits } from '@/shared/lib/search/groupHits';

import { SearchHitRow } from './SearchHitRow';

interface SearchHitListProps {
  hits: SearchHit[];
  /** Index into the drawn order (see flattenGroups); -1 for none. */
  selectedIndex?: number;
  onSelect: (hit: SearchHit, event: MouseEvent<HTMLElement>) => void;
  onHoverIndex?: (index: number) => void;
  /** Draw one flat list without group headings. */
  flat?: boolean;
  id?: string;
}

export function SearchHitList({
  hits,
  selectedIndex = -1,
  onSelect,
  onHoverIndex,
  flat,
  id,
}: SearchHitListProps) {
  const groups = groupHits(hits);
  const drawn = flattenGroups(groups);
  const indexOf = (hit: SearchHit) => drawn.indexOf(hit);

  return (
    <Box component="ul" id={id} role="listbox" sx={{ m: 0, p: 0 }}>
      {groups.map((group) => (
        <Box key={group.type} component="li" sx={{ listStyle: 'none' }}>
          {!flat && (
            <Typography
              variant="overline"
              sx={(theme) => ({
                display: 'block',
                px: 1.5,
                pt: 1,
                color: pal(theme).text.muted,
                letterSpacing: '0.06em',
              })}
            >
              {group.label}
            </Typography>
          )}
          <Box component="ul" role="group" aria-label={group.label} sx={{ m: 0, p: 0 }}>
            {group.hits.map((hit) => {
              const index = indexOf(hit);
              return (
                <SearchHitRow
                  key={`${hit.type}:${hit.id}`}
                  hit={hit}
                  hideType={!flat}
                  selected={index === selectedIndex}
                  onSelect={onSelect}
                  onHover={() => onHoverIndex?.(index)}
                />
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
