import { Autocomplete, Chip, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { getApiErrorMessage, settingsApi } from '@/shared/api';

export interface RemoteOption {
  value: string;
  label: string;
  description?: string;
}

interface RemoteOptions {
  configured: boolean;
  options: RemoteOption[];
  /** Shown when the list is empty: how the options were looked for. */
  emptyDetail?: string;
}

/**
 * Where a multiselect's choices come from, keyed by the `optionsFrom`
 * endpoint the setting definition names. Adding a remote list is one entry.
 */
const LOADERS: Record<string, () => Promise<RemoteOptions>> = {
  '/settings/smus/projects': async () => {
    const result = await settingsApi.listSmusProjects();
    const d = result.diagnostics;
    const emptyDetail = d
      ? [
          `Looked in domain ${d.domainId} (${d.region}): ${d.fromListProjects} from ListProjects, ${d.listings} published listings, ${d.publishers} publishers.`,
          d.listProjectsError ? `ListProjects failed: ${d.listProjectsError}` : '',
          d.listingsError ? `SearchListings failed: ${d.listingsError}` : '',
          d.listings === 0 && !d.listingsError
            ? 'No published listings, so there is nothing to derive projects from: check the domain id and region, and that assets are published.'
            : '',
          d.roleArn ? `Calling DataZone as ${d.roleArn} (domain profile: ${d.profileStatus}).` : '',
          d.profileStatus === 'not found'
            ? 'That role has no user profile in the domain, so it is a member of nothing: run `just smus-grant <domain>` or add the role in the SMUS console.'
            : d.fromListProjects === 0 && !d.listProjectsError
              ? 'The role is known to the domain but is a member of no project: add it to the projects it should read.'
              : '',
        ]
          .filter(Boolean)
          .join(' ')
      : undefined;
    return {
      configured: result.configured,
      emptyDetail,
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
              ? getApiErrorMessage(query.error, 'The options could not be loaded')
              : notConfigured
                ? 'No SMUS domain is configured, so there are no projects to choose from.'
                : query.data && query.data.options.length === 0
                  ? (query.data.emptyDetail ??
                    "No projects were found. Check the domain id, region and the portal role's DataZone access.")
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
