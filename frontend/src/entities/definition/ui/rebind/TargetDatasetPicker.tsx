import { Autocomplete, TextField } from '@mui/material';
import { useEffect, useState } from 'react';

import { assetsApi } from '@/shared/api';
import { useDebounce } from '@/shared/lib/useDebounce';

import type { DatasetOption } from '../../lib/useRebindDraft';

interface TargetDatasetPickerProps {
  value: DatasetOption | null;
  onChange: (value: DatasetOption | null) => void;
  /** The dataset currently bound; shown as a hint and excluded from the options. */
  currentId: string;
  disabled?: boolean;
}

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

/**
 * Picks a dataset from the account by name. Ids are never typed: the server
 * resolves the target by id and reads its columns live, so the choice here
 * is only ever something the account actually has.
 */
export function TargetDatasetPicker({
  value,
  onChange,
  currentId,
  disabled,
}: TargetDatasetPickerProps) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<DatasetOption[]>([]);
  const [loading, setLoading] = useState(false);
  const search = useDebounce(input, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    assetsApi
      .getDatasetsPaginated({ search: search || undefined, pageSize: PAGE_SIZE, page: 1 })
      .then((result) => {
        if (!cancelled) {
          setOptions(
            result.datasets
              .filter((d) => d.id !== currentId)
              .map((d) => ({ id: d.id, name: d.name }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [search, currentId]);

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      inputValue={input}
      onInputChange={(_, next) => setInput(next)}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      filterOptions={(x) => x}
      loading={loading}
      disabled={disabled}
      size="small"
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          {option.name}
          <span style={{ opacity: 0.6, marginLeft: 8, fontSize: '0.75em' }}>{option.id}</span>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Read from dataset"
          placeholder="Search datasets by name"
          helperText={`Currently ${currentId}`}
        />
      )}
    />
  );
}
