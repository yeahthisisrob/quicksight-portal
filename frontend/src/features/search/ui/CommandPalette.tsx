/**
 * The command palette: one box, Cmd+K anywhere, everything the portal knows
 * ranked as you type. Enter or a click opens the hit; arrows move; Esc closes.
 * Nothing runs while it is closed.
 */
import { Search } from '@mui/icons-material';
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  InputAdornment,
  InputBase,
  Stack,
  Typography,
} from '@mui/material';
import { format } from 'date-fns';
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '@/shared/api';
import type { SearchHit } from '@/shared/api/modules/search';
import { EmptyState, pal } from '@/shared/design-system';
import {
  describeIndexed,
  flattenGroups,
  groupHits,
  hitPath,
  moveSelection,
  SEARCH_FILTERS,
  SEARCH_MIN_LENGTH,
  useSearchHits,
} from '@/shared/lib/search';
import { SearchHitList } from '@/shared/ui';

import { useCommandPalette } from '../model/commandPalette';

const RESULT_LIMIT = 40;
const LIST_MAX_HEIGHT = 520;
const INDEXED_AT_FORMAT = 'MMM d, HH:mm';
const LIST_ID = 'command-palette-results';

function Hint({ children }: { children: string }) {
  return (
    <Typography
      component="kbd"
      variant="caption"
      sx={(theme) => ({
        px: 0.75,
        py: 0.25,
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `1px solid ${pal(theme).line.divider}`,
        color: pal(theme).text.muted,
        fontFamily: 'inherit',
      })}
    >
      {children}
    </Typography>
  );
}

export function CommandPalette({
  defaultText = '',
}: {
  /** Text in the box each time the palette opens (stories). */
  defaultText?: string;
}) {
  const palette = useCommandPalette();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [filterId, setFilterId] = useState(SEARCH_FILTERS[0]!.id);
  const [selected, setSelected] = useState(-1);
  const filter = SEARCH_FILTERS.find((f) => f.id === filterId) ?? SEARCH_FILTERS[0]!;

  const search = useSearchHits(text, {
    types: filter.types,
    limit: RESULT_LIMIT,
    enabled: palette.open,
  });
  const drawn = useMemo(() => flattenGroups(groupHits(search.hits)), [search.hits]);

  // A new result set starts with the top hit selected, so Enter just works.
  useEffect(() => {
    setSelected(drawn.length > 0 ? 0 : -1);
  }, [drawn]);
  // Closing forgets the text, so the next Cmd+K starts clean and does no work.
  useEffect(() => {
    setText(palette.open ? defaultText : '');
    setSelected(-1);
  }, [palette.open, defaultText]);

  const go = (hit: SearchHit) => {
    palette.hide();
    navigate(hitPath(hit));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((current) =>
        moveSelection(current, event.key === 'ArrowDown' ? 1 : -1, drawn.length)
      );
    } else if (event.key === 'Enter') {
      const hit = drawn[selected];
      if (hit) {
        event.preventDefault();
        go(hit);
      }
    }
  };

  const typedEnough = text.trim().length >= SEARCH_MIN_LENGTH;
  const answered = search.active && search.query === text.trim() && !search.loading;

  return (
    <Dialog
      open={palette.open}
      onClose={palette.hide}
      maxWidth="md"
      fullWidth
      aria-label="Search everything"
      slotProps={{ paper: { sx: { alignSelf: 'flex-start', mt: '10vh' } } }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <InputBase
          autoFocus
          fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search dashboards, datasets, SMUS listings, calculated fields, visuals…"
          inputProps={{
            'aria-label': 'Search everything',
            role: 'combobox',
            'aria-controls': LIST_ID,
            'aria-expanded': drawn.length > 0,
            'aria-activedescendant': drawn[selected] ? `hit-${drawn[selected]!.id}` : undefined,
          }}
          startAdornment={
            <InputAdornment position="start">
              {search.loading ? <CircularProgress size={18} /> : <Search fontSize="small" />}
            </InputAdornment>
          }
          endAdornment={
            <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
              <Hint>↑↓</Hint>
              <Hint>↵</Hint>
              <Hint>esc</Hint>
            </Stack>
          }
          sx={{ fontSize: '1.05rem' }}
        />
        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {SEARCH_FILTERS.map((f) => (
            <Chip
              key={f.id}
              size="small"
              label={f.label}
              color={f.id === filterId ? 'primary' : 'default'}
              variant={f.id === filterId ? 'filled' : 'outlined'}
              onClick={() => setFilterId(f.id)}
            />
          ))}
        </Stack>
      </Box>
      <Divider />
      <Box sx={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto', px: 1, py: 1 }}>
        {!typedEnough ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', px: 1.5, py: 2 }}>
            Type at least {SEARCH_MIN_LENGTH} characters. Plain words work: "gold orders dataset
            with revenue by region", "closed status margin rule", "bar chart by region".
          </Typography>
        ) : search.error ? (
          <Typography variant="body2" color="error" sx={{ px: 1.5, py: 2 }}>
            {getApiErrorMessage(search.error, 'Search failed')}
          </Typography>
        ) : answered && drawn.length === 0 ? (
          <EmptyState
            compact
            title={`Nothing matches "${search.query}"`}
            description={
              search.indexed
                ? `Searched ${describeIndexed(search.indexed)}${search.indexedAt ? `, indexed ${format(new Date(search.indexedAt), INDEXED_AT_FORMAT)}` : ''}. Run an export to index newer assets.`
                : 'Run an export to build the index.'
            }
          />
        ) : (
          <SearchHitList
            id={LIST_ID}
            hits={search.hits}
            selectedIndex={selected}
            onSelect={(hit) => go(hit)}
            onHoverIndex={setSelected}
          />
        )}
      </Box>
      {answered && drawn.length > 0 && search.indexed && (
        <>
          <Divider />
          <Typography variant="caption" sx={{ color: 'text.secondary', px: 2, py: 0.75 }}>
            {drawn.length} of {describeIndexed(search.indexed)}
            {search.indexedAt
              ? `, indexed ${format(new Date(search.indexedAt), INDEXED_AT_FORMAT)}`
              : ''}
          </Typography>
        </>
      )}
    </Dialog>
  );
}
