import { Autocomplete, TextField } from '@mui/material';

import type { TagFilter } from '../lib/useCatalog';

interface TagOption extends TagFilter {
  count: number;
}

interface DatasetTagsFilterProps {
  available: TagOption[];
  value: TagFilter[];
  onChange: (tags: TagFilter[]) => void;
  loading?: boolean;
}

const label = (t: TagFilter) => `${t.key}: ${t.value}`;
const same = (a: TagFilter, b: TagFilter) => a.key === b.key && a.value === b.value;

/**
 * Secondary filter: keep only assets whose linked QuickSight datasets carry
 * every chosen tag. Tags are the portal's, not SMUS's, so this stays small.
 */
export function DatasetTagsFilter({ available, value, onChange, loading }: DatasetTagsFilterProps) {
  const selected: TagOption[] = value.map(
    (v) => available.find((a) => same(a, v)) ?? { ...v, count: 0 }
  );
  return (
    <Autocomplete<TagOption, true>
      multiple
      size="small"
      options={available}
      value={selected}
      onChange={(_, next) => onChange(next.map(({ key, value: v }) => ({ key, value: v })))}
      getOptionLabel={label}
      isOptionEqualToValue={same}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Dataset tags"
          placeholder={value.length ? undefined : 'Any'}
        />
      )}
    />
  );
}
