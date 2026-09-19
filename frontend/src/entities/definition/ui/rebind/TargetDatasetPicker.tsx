import { Autocomplete, Chip, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { assetsApi } from '@/shared/api';
import { SEARCH_MIN_LENGTH, useSearchHits } from '@/shared/lib/search';
import { useDebounce } from '@/shared/lib/useDebounce';

import type { DatasetOption } from '../../lib/useRebindDraft';

interface TargetDatasetPickerProps {
  value: DatasetOption | null;
  onChange: (value: DatasetOption | null) => void;
  /** The dataset currently bound; shown as a hint and excluded from the options. */
  currentId: string;
  disabled?: boolean;
  /** Text in the box at first render, with the list open (stories). */
  initialInput?: string;
}

const LIST_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;
const SEARCH_LIMIT = 15;
const WHY_LIMIT = 3;

interface SearchedOption extends DatasetOption {
  summary?: string;
  why?: string[];
}

/**
 * Picks a dataset from the account. An empty box lists datasets by name;
 * typing searches them in plain words (name, columns, calculated fields,
 * tags, folders) through /search, so "gold orders with revenue" finds the
 * right one without knowing what it is called. Ids are never typed: the
 * server resolves the target by id and reads its columns live.
 */
export function TargetDatasetPicker({
  value,
  onChange,
  currentId,
  disabled,
  initialInput = '',
}: TargetDatasetPickerProps) {
  const [input, setInput] = useState(initialInput);
  const [open, setOpen] = useState(initialInput.length > 0);
  const [listed, setListed] = useState<DatasetOption[]>([]);
  const [listing, setListing] = useState(false);
  const searching = input.trim().length >= SEARCH_MIN_LENGTH;
  const listQuery = useDebounce(searching ? '' : input, LIST_DEBOUNCE_MS);
  const found = useSearchHits(input, {
    types: ['dataset'],
    limit: SEARCH_LIMIT,
    enabled: searching,
  });

  useEffect(() => {
    let cancelled = false;
    setListing(true);
    assetsApi
      .getDatasetsPaginated({ search: listQuery || undefined, pageSize: PAGE_SIZE, page: 1 })
      .then((result) => {
        if (!cancelled) {
          setListed(
            result.datasets
              .filter((d) => d.id !== currentId)
              .map((d) => ({ id: d.id, name: d.name }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setListed([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setListing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listQuery, currentId]);

  const options = useMemo<SearchedOption[]>(
    () =>
      searching
        ? found.hits
            .filter((h) => h.id !== currentId)
            .map((h) => ({ id: h.id, name: h.name, summary: h.summary, why: h.why }))
        : listed,
    [searching, found.hits, listed, currentId]
  );

  return (
    <Autocomplete<SearchedOption, false, false, false>
      options={options}
      value={value}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onChange={(_, next) => onChange(next)}
      inputValue={input}
      onInputChange={(_, next) => setInput(next)}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      filterOptions={(x) => x}
      loading={searching ? found.loading : listing}
      disabled={disabled}
      size="small"
      noOptionsText={searching ? `Nothing matches "${found.query}"` : 'No datasets match that name'}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <li key={key} {...rest}>
            <Stack sx={{ minWidth: 0, py: 0.25 }}>
              <Typography variant="body2" noWrap>
                {option.name}
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ color: 'text.secondary', ml: 1, fontFamily: 'monospace' }}
                >
                  {option.id}
                </Typography>
              </Typography>
              {option.summary && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {option.summary}
                </Typography>
              )}
              {option.why && option.why.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.25, flexWrap: 'wrap', gap: 0.5 }}>
                  {option.why.slice(0, WHY_LIMIT).map((why) => (
                    <Chip key={why} size="small" variant="outlined" label={why} />
                  ))}
                </Stack>
              )}
            </Stack>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Read from dataset"
          placeholder="Type a name, or describe it: gold orders with revenue by region"
          helperText={`Currently ${currentId}`}
        />
      )}
    />
  );
}
