import { Autocomplete, Chip, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { settingsApi } from '@/shared/api';

export interface RemoteOption {
  value: string;
  label: string;
  description?: string;
}

interface RemoteOptions {
  configured: boolean;
  options: RemoteOption[];
}

/**
 * Where a multiselect's choices come from, keyed by the `optionsFrom`
 * endpoint the setting definition names. Adding a remote list is one entry.
 */
const LOADERS: Record<string, () => Promise<RemoteOptions>> = {
  '/settings/smus/projects': async () => {
    const result = await settingsApi.listSmusProjects();
    return {
      configured: result.configured,
      options: result.projects.map((p) => ({
        value: p.id,
        label: p.name,
        description: p.description,
      })),
    };
  },
};

export interface RemoteMultiSelectProps {
  optionsFrom: string;
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  disabled?: boolean;
  /** Shown under the field when nothing is selected. */
  emptyHint?: string;
}

/**
 * A multiselect whose options are fetched live (SMUS projects, for example).
 * Selected values that the list no longer contains are kept and shown by id,
 * so a stale selection is visible rather than silently dropped.
 */
export function RemoteMultiSelect({
  optionsFrom,
  value,
  onChange,
  label,
  disabled,
  emptyHint,
}: RemoteMultiSelectProps) {
  const loader = LOADERS[optionsFrom];
  const query = useQuery({
    queryKey: ['settings-options', optionsFrom],
    queryFn: () => (loader ? loader() : Promise.resolve({ configured: true, options: [] })),
  });

  const options = query.data?.options ?? [];
  const byValue = new Map(options.map((o) => [o.value, o]));
  const selected: RemoteOption[] = value.map((v) => byValue.get(v) ?? { value: v, label: v });
  const notConfigured = query.data && !query.data.configured;

  return (
    <Autocomplete
      multiple
      options={options}
      value={selected}
      onChange={(_, next) => onChange(next.map((o) => o.value))}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      loading={query.isLoading}
      disabled={disabled || notConfigured}
      size="small"
      renderOption={(props, option) => (
        <li {...props} key={option.value}>
          <span>
            {option.label}
            {option.description && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {option.description}
              </Typography>
            )}
          </span>
        </li>
      )}
      renderValue={(items, getItemProps) =>
        items.map((item, index) => {
          const { key, ...chipProps } = getItemProps({ index });
          return (
            <Chip
              key={key}
              size="small"
              label={item.label}
              color={byValue.has(item.value) ? 'default' : 'warning'}
              {...chipProps}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? 'Search' : undefined}
          error={Boolean(query.error)}
          helperText={
            query.error
              ? 'The options could not be loaded'
              : notConfigured
                ? 'No SMUS domain is configured, so there are no projects to choose from.'
                : value.length === 0
                  ? emptyHint
                  : undefined
          }
        />
      )}
    />
  );
}

export default RemoteMultiSelect;
